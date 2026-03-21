/**
 * Bearing Lines — Epicenter to Critical Asset directional indicators.
 *
 * Military analysis visualization: straight lines from the epicenter to
 * affected infrastructure assets, annotated with bearing angle and distance.
 *
 * Strategy:
 *   1. Show all non-clear severity assets (up to 8)
 *   2. If fewer than 3 non-clear, backfill with nearest assets within 200km
 *      to always give spatial context around the epicenter
 *
 * Severity color-coding:
 *   critical  -> red (bright)
 *   priority  -> amber
 *   watch     -> blue
 *   clear     -> white (faint, proximity only)
 */

import { LineLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';
import type { OpsAssetExposure, OpsSeverity } from '../ops/types';
import { OPS_ASSETS } from '../ops/assetCatalog';
import { haversineKm } from './impactZone';

// ── Types ────────────────────────────────────────────────────

interface BearingLineDatum {
  sourcePosition: [number, number];
  targetPosition: [number, number];
  severity: OpsSeverity;
  label: string;
  midpoint: [number, number];
  assetName: string;
}

// ── Severity ordering (higher = more severe) ─────────────────

const SEVERITY_RANK: Record<OpsSeverity, number> = {
  critical: 3,
  priority: 2,
  watch: 1,
  clear: 0,
};

// ── Severity colors — more visible than before ───────────────

const SEVERITY_LINE_COLOR: Record<OpsSeverity, [number, number, number, number]> = {
  critical: [239, 68, 68, 120],
  priority: [251, 191, 36, 90],
  watch: [96, 165, 250, 70],
  clear: [160, 200, 230, 40],
};

// ── Compass direction lookup ─────────────────────────────────

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE',
  'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW',
  'W', 'WNW', 'NW', 'NNW',
] as const;

function toCompassDirection(angleDeg: number): string {
  const index = Math.round(angleDeg / 22.5) % 16;
  return COMPASS_POINTS[index];
}

// ── Bearing computation ──────────────────────────────────────

function computeBearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const PI = Math.PI;
  const deltaLat = lat2 - lat1;
  const deltaLng = lng2 - lng1;
  const rad = Math.atan2(
    deltaLng * Math.cos(lat1 * PI / 180),
    deltaLat,
  );
  return ((rad * 180 / PI) + 360) % 360;
}

// ── Main Factory ─────────────────────────────────────────────

const MAX_LINES = 8;
const MIN_CONTEXT_LINES = 3;
const PROXIMITY_RADIUS_KM = 200;

// Max bearing line distance scales with magnitude
function maxLineDistKm(mag: number): number {
  // M5→150km, M6→300km, M7→450km, M8→600km, M9→750km (cap 800)
  return Math.min(150 * (mag - 4), 800);
}

export function createBearingLineLayers(
  event: EarthquakeEvent,
  exposures: OpsAssetExposure[],
): Layer[] {
  const assetMap = new Map(OPS_ASSETS.map((a) => [a.id, a]));
  const maxDist = maxLineDistKm(event.magnitude);

  // 1. Collect non-clear severity exposures within distance limit (sorted by severity)
  const nonClear = exposures
    .filter((e) => {
      if (e.severity === 'clear') return false;
      const asset = assetMap.get(e.assetId);
      if (!asset) return false;
      return haversineKm(event.lat, event.lng, asset.lat, asset.lng) <= maxDist;
    })
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, MAX_LINES);

  const selectedIds = new Set(nonClear.map((e) => e.assetId));

  // 2. If fewer than MIN_CONTEXT_LINES, backfill with nearest assets
  const backfillRadius = Math.min(PROXIMITY_RADIUS_KM, maxDist);
  if (nonClear.length < MIN_CONTEXT_LINES) {
    const needed = MIN_CONTEXT_LINES - nonClear.length;
    const nearbyAssets = OPS_ASSETS
      .filter((a) => !selectedIds.has(a.id))
      .map((a) => ({
        asset: a,
        distKm: haversineKm(event.lat, event.lng, a.lat, a.lng),
      }))
      .filter((a) => a.distKm <= backfillRadius)
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, needed);

    for (const { asset } of nearbyAssets) {
      nonClear.push({
        assetId: asset.id,
        severity: 'clear',
        score: 0,
        summary: '',
        reasons: [],
      });
    }
  }

  if (nonClear.length === 0) return [];

  // 3. Build line data
  const data: BearingLineDatum[] = [];

  for (const exposure of nonClear) {
    const asset = assetMap.get(exposure.assetId);
    if (!asset) continue;

    const bearing = computeBearing(event.lat, event.lng, asset.lat, asset.lng);
    const compass = toCompassDirection(bearing);
    const distKm = haversineKm(event.lat, event.lng, asset.lat, asset.lng);
    const label = `${compass} ${Math.round(bearing)}\u00B0 \u00B7 ${Math.round(distKm)}km`;

    data.push({
      sourcePosition: [event.lng, event.lat],
      targetPosition: [asset.lng, asset.lat],
      severity: exposure.severity,
      label,
      midpoint: [
        (event.lng + asset.lng) / 2,
        (event.lat + asset.lat) / 2,
      ],
      assetName: asset.name,
    });
  }

  if (data.length === 0) return [];

  return [
    new LineLayer<BearingLineDatum>({
      id: 'bearing-lines',
      data,
      pickable: false,
      getSourcePosition: (d) => d.sourcePosition,
      getTargetPosition: (d) => d.targetPosition,
      getColor: (d) => SEVERITY_LINE_COLOR[d.severity],
      getWidth: (d) => d.severity === 'critical' ? 2 : d.severity === 'clear' ? 0.8 : 1.5,
      widthUnits: 'pixels',
      updateTriggers: {
        getSourcePosition: [event.id],
        getTargetPosition: [event.id],
        getColor: [event.id],
        getWidth: [event.id],
      },
    }),
    new TextLayer<BearingLineDatum>({
      id: 'bearing-labels',
      data,
      pickable: false,
      getPosition: (d) => d.midpoint,
      getText: (d) => d.label,
      getSize: 9,
      getColor: [255, 255, 255, 140],
      fontFamily: '"IBM Plex Mono", "SF Mono", monospace',
      getTextAnchor: 'middle' as const,
      getAlignmentBaseline: 'center' as const,
      outlineWidth: 2.5,
      outlineColor: [10, 14, 20, 220],
      updateTriggers: {
        getPosition: [event.id],
        getText: [event.id],
      },
    }),
  ];
}
