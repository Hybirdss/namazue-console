/**
 * Catalog Loader — Viewport + time-range earthquake data fetcher.
 *
 * Loads historical earthquake data from the Worker API based on:
 *   - Current viewport bounds (lat/lng)
 *   - Selected time range (since/until)
 *   - Zoom-based magnitude threshold
 *
 * Results go into consoleStore.catalogEvents, which the seismicDepthLayer
 * and other layers merge with live events for rendering.
 *
 * Debounced at 400ms to avoid API spam during slider/viewport drag.
 */

import { consoleStore } from '../core/store';
import { serverEventToEq } from './eventFeed';
import type { EarthquakeEvent } from '../types';
import type { ServerEventRecord } from './eventFeed';

const FETCH_TIMEOUT_MS = 15_000;  // 15s for historical (larger payloads)
const DEBOUNCE_MS = 400;

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL as string;
  if (import.meta.env.PROD) return 'https://api.namazue.dev';
  return '';
})();

interface CatalogQuery {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  since: number;  // epoch ms
  until: number;  // epoch ms
  zoom: number;
}

/**
 * Zoom-based magnitude threshold — prevents loading millions of tiny events
 * at global zoom levels. Follows USGS/IRIS cartographic conventions.
 */
function zoomToMinMag(zoom: number): number {
  if (zoom >= 8) return 2.5;   // street level: show everything
  if (zoom >= 6) return 3.5;   // city/region: M3.5+
  if (zoom >= 4) return 4.5;   // country: M4.5+
  if (zoom >= 2) return 5.5;   // continent: M5.5+
  return 6.0;                   // world: M6+ only
}

/**
 * Zoom-based limit — more events at closer zoom.
 */
function zoomToLimit(zoom: number): number {
  if (zoom >= 7) return 5000;
  if (zoom >= 5) return 3000;
  if (zoom >= 3) return 2000;
  return 1000;
}

async function fetchCatalog(query: CatalogQuery): Promise<EarthquakeEvent[]> {
  if (!API_BASE) return [];

  const minMag = zoomToMinMag(query.zoom);
  const limit = zoomToLimit(query.zoom);

  const params = new URLSearchParams({
    lat_min: String(query.latMin),
    lat_max: String(query.latMax),
    lng_min: String(query.lngMin),
    lng_max: String(query.lngMax),
    mag_min: String(minMag),
    since: new Date(query.since).toISOString(),
    until: new Date(query.until).toISOString(),
    limit: String(limit),
  });

  const url = `${API_BASE}/api/events?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { events: ServerEventRecord[] } = await res.json();

    if (!Array.isArray(data.events)) return [];

    return data.events
      .map(serverEventToEq)
      .filter((e): e is EarthquakeEvent => e !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

// ── Debounced loader ──────────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let loadGeneration = 0;

export async function loadCatalog(): Promise<void> {
  const timeRange = consoleStore.get('catalogTimeRange');
  if (!timeRange) {
    consoleStore.set('catalogEvents', []);
    return;
  }

  const viewport = consoleStore.get('viewport');
  const [lngMin, latMin, lngMax, latMax] = viewport.bounds;

  const gen = ++loadGeneration;

  const events = await fetchCatalog({
    latMin, latMax, lngMin, lngMax,
    since: timeRange.since,
    until: timeRange.until,
    zoom: viewport.zoom,
  });

  // Stale check — another load may have started while we were fetching
  if (gen !== loadGeneration) return;

  consoleStore.set('catalogEvents', events);
}

export function loadCatalogDebounced(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    loadCatalog();
  }, DEBOUNCE_MS);
}

/**
 * Start watching for viewport and time range changes.
 * Returns cleanup function.
 */
export function startCatalogLoader(): () => void {
  const unsub1 = consoleStore.subscribe('catalogTimeRange', () => {
    loadCatalogDebounced();
  });

  const unsub2 = consoleStore.subscribe('viewport', () => {
    // Only reload if we're in historical mode
    if (consoleStore.get('catalogTimeRange')) {
      loadCatalogDebounced();
    }
  });

  return () => {
    unsub1();
    unsub2();
    if (debounceTimer) clearTimeout(debounceTimer);
  };
}
