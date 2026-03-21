/**
 * Earthquake Layer — ScatterplotLayer for seismic events.
 *
 * Performance rules (deck.gl official guidance):
 * - data ref must be STABLE — same array object when data hasn't changed
 * - accessors (getRadius, getColor) must NOT depend on animation state
 * - animation uses radiusScale (uniform prop, ~0 cost at 60fps)
 * - updateTriggers only fire on real data changes (selectedId, data swap)
 *
 * Visual rules:
 * - Size scales with magnitude — AREA proportional to seismic energy
 *   Energy: E ∝ 10^(1.5M)  →  radius ∝ 10^(0.75M)
 *   Reference: Kanamori (1977), USGS map conventions
 * - Color encodes depth: shallow=warm, deep=cool (USGS/IRIS convention)
 * - Selected event: bright ice blue highlight ring
 *
 * See docs/current/VISUALIZATION-STANDARDS.md §1 for full rationale.
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';

type RGBA = [number, number, number, number];

function depthColor(depth_km: number): RGBA {
  if (depth_km < 30)  return [255,  60,  60, 230];  // crustal: vivid red
  if (depth_km < 70)  return [255, 180,  40, 215];  // shallow slab: warm amber
  if (depth_km < 150) return [255, 230,  60, 200];  // intermediate: gold
  if (depth_km < 300) return [ 80, 210, 240, 190];  // deep slab: cyan
  if (depth_km < 500) return [100, 130, 255, 180];  // very deep: blue
  return [160, 120, 200, 165];                       // ultra-deep: purple
}

// ── Magnitude → radius (cube-root-of-energy scaling) ────────
//
// Seismic energy: E ∝ 10^(1.5M)  (Kanamori 1977)
// Full energy-proportional (radius ∝ 10^0.75M) is too extreme for
// visualization — M5 would be 32× larger than M3, filling the screen.
//
// Standard cartographic compression (Bertin 1967): apply cube root
// to the energy ratio, giving area ∝ E^(1/3) = 10^(0.5M).
// This means: radius ∝ 10^(0.25M).
//
// Result: each magnitude step ≈ 1.78× radius increase (vs 5.6× raw).
// Consistent with USGS/EMSC/JMA map circle conventions.
//
// See docs/current/VISUALIZATION-STANDARDS.md §1.
const MAG_REF = 3;
const MAG_BASE_PX = 3;
const MAG_RADIUS_MIN = 3;
const MAG_RADIUS_MAX = 55;

function magToRadius(mag: number): number {
  const r = MAG_BASE_PX * Math.pow(10, 0.25 * (mag - MAG_REF));
  return Math.max(MAG_RADIUS_MIN, Math.min(MAG_RADIUS_MAX, r));
}

/**
 * Glow radius scales — two-ring halo system.
 * Inner: tighter, brighter (1.4×). Outer: wider, softer (2.5×).
 */
const INNER_GLOW_SCALE = 1.4;
const OUTER_GLOW_SCALE = 2.5;
const GLOW_RADIUS_MIN = 6;

function innerGlowRadius(mag: number): number {
  const r = MAG_BASE_PX * INNER_GLOW_SCALE * Math.pow(10, 0.25 * (mag - MAG_REF));
  return Math.max(GLOW_RADIUS_MIN, Math.min(MAG_RADIUS_MAX * INNER_GLOW_SCALE, r));
}

function outerGlowRadius(mag: number): number {
  const r = MAG_BASE_PX * OUTER_GLOW_SCALE * Math.pow(10, 0.25 * (mag - MAG_REF));
  return Math.max(GLOW_RADIUS_MIN * 2, Math.min(MAG_RADIUS_MAX * OUTER_GLOW_SCALE, r));
}

function innerGlowAlpha(event: EarthquakeEvent): number {
  const ageHours = (Date.now() - event.time) / 3600_000;
  if (ageHours > 48) return 0;
  // Fade from 55 to 0 over 48 hours
  return Math.round(55 * Math.max(0, 1 - ageHours / 48));
}

function outerGlowAlpha(event: EarthquakeEvent): number {
  const ageHours = (Date.now() - event.time) / 3600_000;
  if (ageHours > 24) return 0;
  // Fade from 20 to 0 over 24 hours
  return Math.round(20 * Math.max(0, 1 - ageHours / 24));
}

// ── Density-adaptive scaling ─────────────────────────────────
// Show ALL events but shrink dots + reduce alpha when dense.
// This keeps the spatial pattern readable without hiding data.

function densityScale(count: number): { radius: number; alpha: number } {
  if (count < 200)  return { radius: 1.0,  alpha: 1.0  };
  if (count < 500)  return { radius: 0.75, alpha: 0.85 };
  if (count < 1500) return { radius: 0.55, alpha: 0.7  };
  if (count < 4000) return { radius: 0.4,  alpha: 0.55 };
  return                      { radius: 0.3,  alpha: 0.45 };
}

export function createEarthquakeLayer(
  events: EarthquakeEvent[],
  selectedId: string | null,
  radiusScale: number = 1,
): ScatterplotLayer<EarthquakeEvent> {
  const ds = densityScale(events.length);
  return new ScatterplotLayer<EarthquakeEvent>({
    id: 'earthquakes',
    data: events,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 140],
    stroked: true,
    filled: true,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    radiusMinPixels: Math.max(1, MAG_RADIUS_MIN * ds.radius),
    radiusMaxPixels: MAG_RADIUS_MAX * ds.radius,
    // radiusScale animated by compositor for calm pulse — uniform prop, ~0 GPU cost
    radiusScale,

    getPosition: (d) => [d.lng, d.lat],
    getRadius: (d) => magToRadius(d.magnitude) * ds.radius,

    getFillColor: (d) => {
      if (d.id === selectedId) return [255, 255, 255, 255];
      const c = depthColor(d.depth_km);
      return [c[0], c[1], c[2], Math.round(c[3] * ds.alpha)] as RGBA;
    },

    getLineColor: (d) => {
      if (d.id === selectedId) return [125, 211, 252, 255];
      const c = depthColor(d.depth_km);
      return [
        Math.min(255, c[0] + 40),
        Math.min(255, c[1] + 40),
        Math.min(255, c[2] + 40),
        Math.round(70 * ds.alpha),
      ] as RGBA;
    },

    getLineWidth: (d) => (d.id === selectedId ? 3 : 0.8),

    updateTriggers: {
      getFillColor: [selectedId, events.length],
      getLineColor: [selectedId, events.length],
      getRadius: [events.length],
      getLineWidth: [selectedId],
    },
  });
}

/**
 * Age decay ring layer — subtle outer rings encoding event age.
 * Recent events get tight bright rings; older events get wider, dimmer rings.
 * Makes the temporal dimension visible on the map.
 * Only shows events within the last 72 hours.
 */
export function createEarthquakeAgeRingLayer(
  events: EarthquakeEvent[],
): Layer | null {
  const now = Date.now();
  const cutoff72h = now - 72 * 3600_000;
  const recent = events.filter((e) => e.time > cutoff72h);
  if (recent.length === 0) return null;

  function ageRingRadius(ageHours: number): number {
    if (ageHours < 1) return 8;
    if (ageHours < 6) return 12;
    if (ageHours < 24) return 18;
    return 24;
  }

  function ageRingAlpha(ageHours: number): number {
    if (ageHours < 1) return 60;
    if (ageHours < 6) return 40;
    if (ageHours < 24) return 25;
    return 12;
  }

  return new ScatterplotLayer<EarthquakeEvent>({
    id: 'earthquake-age-rings',
    data: recent,
    pickable: false,
    stroked: true,
    filled: false,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    lineWidthMinPixels: 1,
    getPosition: (d) => [d.lng, d.lat],
    getRadius: (d) => {
      const ageHours = (now - d.time) / 3600_000;
      return ageRingRadius(ageHours);
    },
    getLineColor: (d) => {
      const ageHours = (now - d.time) / 3600_000;
      return [255, 255, 255, ageRingAlpha(ageHours)];
    },
    getLineWidth: 1,
    updateTriggers: {
      getRadius: [events.length],
      getLineColor: [events.length],
    },
  });
}

/**
 * Inner glow layer — tight, bright halo anchored close to the dot.
 * Fades over 48 hours. Uses the depth color of each event.
 * Only shows events < 48h old with M >= 3.5.
 */
export function createEarthquakeInnerGlowLayer(
  events: EarthquakeEvent[],
): Layer | null {
  const cutoff = Date.now() - 48 * 3600_000;
  const recent = events.filter((e) => e.time > cutoff && e.magnitude >= 3.5);
  if (recent.length === 0) return null;

  return new ScatterplotLayer<EarthquakeEvent>({
    id: 'earthquake-glow-inner',
    data: recent,
    pickable: false,
    stroked: false,
    filled: true,
    radiusUnits: 'pixels',
    radiusMinPixels: GLOW_RADIUS_MIN,
    radiusMaxPixels: Math.round(MAG_RADIUS_MAX * INNER_GLOW_SCALE),
    getPosition: (d) => [d.lng, d.lat],
    getRadius: (d) => innerGlowRadius(d.magnitude),
    getFillColor: (d) => {
      const c = depthColor(d.depth_km);
      return [c[0], c[1], c[2], innerGlowAlpha(d)];
    },
    updateTriggers: {
      getFillColor: [events.length],
    },
  });
}

/**
 * Outer glow layer — wide, soft halo for a diffuse ambient presence.
 * Fades over 24 hours. Uses the depth color of each event.
 * Only shows events < 24h old with M >= 3.5.
 */
export function createEarthquakeOuterGlowLayer(
  events: EarthquakeEvent[],
): Layer | null {
  const cutoff = Date.now() - 24 * 3600_000;
  const recent = events.filter((e) => e.time > cutoff && e.magnitude >= 3.5);
  if (recent.length === 0) return null;

  return new ScatterplotLayer<EarthquakeEvent>({
    id: 'earthquake-glow-outer',
    data: recent,
    pickable: false,
    stroked: false,
    filled: true,
    radiusUnits: 'pixels',
    radiusMinPixels: GLOW_RADIUS_MIN * 2,
    radiusMaxPixels: Math.round(MAG_RADIUS_MAX * OUTER_GLOW_SCALE),
    getPosition: (d) => [d.lng, d.lat],
    getRadius: (d) => outerGlowRadius(d.magnitude),
    getFillColor: (d) => {
      const c = depthColor(d.depth_km);
      return [c[0], c[1], c[2], outerGlowAlpha(d)];
    },
    updateTriggers: {
      getFillColor: [events.length],
    },
  });
}
