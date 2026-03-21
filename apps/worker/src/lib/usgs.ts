/**
 * USGS server-side earthquake poller.
 *
 * Fetches the USGS 7-day M2.5+ GeoJSON feed and returns parsed events
 * for Japan region ingestion into the DB.
 */

const USGS_FEED_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson';
const USGS_DETAIL_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';
const FETCH_TIMEOUT_MS = 15_000;

interface USGSFeature {
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    tsunami: number;
    magType: string;
    status: string;
    detail?: string; // URL to full event detail GeoJSON
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [lng, lat, depth_km]
  };
}

// ── Plate Boundary Segments (Japan region) ──────────────────
// Bounding boxes for major subduction zones used to distinguish
// interface vs crustal events at depth ≤ 60 km.
const PLATE_BOUNDARY_SEGMENTS = [
  // Japan Trench (Pacific Plate)
  { latMin: 34, latMax: 41, lngMin: 140, lngMax: 145 },
  // Nankai Trough (Philippine Sea Plate)
  { latMin: 30, latMax: 35, lngMin: 131, lngMax: 140 },
  // Sagami Trough
  { latMin: 34, latMax: 36, lngMin: 138, lngMax: 141 },
  // Ryukyu Trench
  { latMin: 24, latMax: 31, lngMin: 126, lngMax: 132 },
  // Izu-Bonin arc
  { latMin: 27, latMax: 35, lngMin: 139, lngMax: 143 },
  // Kuril Trench
  { latMin: 42, latMax: 46, lngMin: 144, lngMax: 150 },
];

function isNearPlateBoundary(lat: number, lng: number): boolean {
  return PLATE_BOUNDARY_SEGMENTS.some(
    (seg) => lat >= seg.latMin && lat <= seg.latMax && lng >= seg.lngMin && lng <= seg.lngMax,
  );
}

type FaultType = 'crustal' | 'interface' | 'intraslab';

/**
 * Classify fault type from depth and location (heuristic fallback).
 * Used when moment tensor is not available.
 */
export function classifyFaultType(depth_km: number, lat: number, lng: number): FaultType {
  if (depth_km > 60) return 'intraslab';
  if (isNearPlateBoundary(lat, lng)) return 'interface';
  return 'crustal';
}

/**
 * Classify fault type from rake angle (authoritative, from moment tensor).
 * Uses Aki & Richards convention:
 *   |rake| < 45° or |rake| > 135° → strike-slip → 'crustal'
 *   45° ≤ rake ≤ 135° → reverse/thrust → 'interface' or 'intraslab' (by depth)
 *   -135° ≤ rake ≤ -45° → normal → 'intraslab' (typically)
 */
function classifyFromRake(rake: number, depth_km: number, lat: number, lng: number): FaultType {
  const absRake = Math.abs(rake);
  if (absRake >= 45 && absRake <= 135) {
    // Reverse/thrust or normal faulting
    if (rake > 0) {
      // Thrust — interface if shallow near plate boundary, intraslab if deep
      if (depth_km > 60) return 'intraslab';
      if (isNearPlateBoundary(lat, lng)) return 'interface';
      return 'crustal';
    }
    // Normal faulting — typically intraslab or crustal extension
    if (depth_km > 40) return 'intraslab';
    return 'crustal';
  }
  // Strike-slip — generally crustal
  return depth_km > 60 ? 'intraslab' : 'crustal';
}

export interface UsgsQuake {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: string;
  place: string;
  source: 'usgs';
  mag_type: string;
  tsunami: boolean;
  data_status: string;
  fault_type: FaultType;
}

/** Moment tensor data from USGS focal mechanism product. */
export interface MomentTensor {
  strike1: number;
  dip1: number;
  rake1: number;
  strike2: number;
  dip2: number;
  rake2: number;
  fault_type: FaultType;
}

function isJapanRegion(lat: number, lng: number): boolean {
  return lat >= 20 && lat <= 50 && lng >= 120 && lng <= 155;
}

/**
 * Fetch recent Japan-region earthquakes from USGS weekly feed.
 * Returns M2.5+ events within Japan bbox.
 */
export async function fetchUsgsQuakes(): Promise<UsgsQuake[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(USGS_FEED_URL, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      throw new Error(`USGS API ${resp.status}`);
    }

    const data = await resp.json() as { features: USGSFeature[] };
    if (!Array.isArray(data.features)) return [];

    const results: UsgsQuake[] = [];

    for (const f of data.features) {
      const [lng, lat, depth] = f.geometry.coordinates;
      if (!isJapanRegion(lat, lng)) continue;
      if (!Number.isFinite(f.properties.mag) || f.properties.mag < 2.5) continue;
      if (f.properties.status === 'deleted') continue;

      const depthClamped = Math.max(0, depth);
      results.push({
        id: f.id,
        lat,
        lng,
        depth_km: depthClamped,
        magnitude: f.properties.mag,
        time: new Date(f.properties.time).toISOString(),
        place: f.properties.place ?? '',
        source: 'usgs',
        mag_type: f.properties.magType ?? 'ml',
        tsunami: f.properties.tsunami === 1,
        data_status: f.properties.status ?? 'automatic',
        fault_type: classifyFaultType(depthClamped, lat, lng),
      });
    }

    return results;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch moment tensor from USGS detail endpoint for a specific event.
 * Returns null if no focal mechanism/moment tensor product is available.
 *
 * USGS provides moment tensors for most M5.0+ events, typically
 * 30-120 minutes after the initial report.
 *
 * Sources tried (in priority order):
 *   1. moment-tensor (GCMT, USGS W-phase, etc.)
 *   2. focal-mechanism (first-motion, regional CMT)
 */
export async function fetchUsgsMomentTensor(
  eventId: string,
  depth_km: number,
  lat: number,
  lng: number,
): Promise<MomentTensor | null> {
  const url = `${USGS_DETAIL_URL}?eventid=${encodeURIComponent(eventId)}&format=geojson`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    if (!resp.ok) return null;

    const detail = await resp.json() as {
      properties?: {
        products?: {
          'moment-tensor'?: Array<{ properties?: Record<string, string> }>;
          'focal-mechanism'?: Array<{ properties?: Record<string, string> }>;
        };
      };
    };

    const products = detail?.properties?.products;
    if (!products) return null;

    // Try moment-tensor first (more authoritative), then focal-mechanism
    const mtProduct = products['moment-tensor']?.[0]?.properties;
    const fmProduct = products['focal-mechanism']?.[0]?.properties;
    const source = mtProduct ?? fmProduct;
    if (!source) return null;

    // USGS stores nodal planes as: nodal-plane-1-strike, nodal-plane-1-dip, etc.
    const s1 = parseFloat(source['nodal-plane-1-strike'] ?? '');
    const d1 = parseFloat(source['nodal-plane-1-dip'] ?? '');
    const r1 = parseFloat(source['nodal-plane-1-rake'] ?? source['nodal-plane-1-slip'] ?? '');
    const s2 = parseFloat(source['nodal-plane-2-strike'] ?? '');
    const d2 = parseFloat(source['nodal-plane-2-dip'] ?? '');
    const r2 = parseFloat(source['nodal-plane-2-rake'] ?? source['nodal-plane-2-slip'] ?? '');

    if (!Number.isFinite(s1) || !Number.isFinite(d1) || !Number.isFinite(r1)) return null;

    return {
      strike1: s1,
      dip1: d1,
      rake1: r1,
      strike2: Number.isFinite(s2) ? s2 : 0,
      dip2: Number.isFinite(d2) ? d2 : 0,
      rake2: Number.isFinite(r2) ? r2 : 0,
      fault_type: classifyFromRake(r1, depth_km, lat, lng),
    };
  } catch {
    return null; // Network error, timeout, or parse failure
  } finally {
    clearTimeout(timeout);
  }
}
