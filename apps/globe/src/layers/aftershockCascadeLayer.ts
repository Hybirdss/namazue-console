/**
 * Aftershock Cascade Layer — TripsLayer animation of aftershock migration.
 *
 * When a significant earthquake (M >= 5.0) is selected, generates a synthetic
 * aftershock sequence and animates it using deck.gl TripsLayer. Each aftershock
 * appears as an animated trail radiating from the mainshock epicenter to its
 * predicted location, creating a dramatic "energy migration" visualization.
 *
 * Seismological basis:
 *   - Omori's Law (1894): aftershock rate N(t) ∝ 1/(t+c)^p, p≈1.0
 *     Utsu, T. (1961). "A statistical study on the occurrence of aftershocks."
 *   - Bath's Law: largest aftershock ≈ M_main - 1.2
 *     Bath, M. (1965). "Lateral inhomogeneities of the upper mantle." Tectonophysics 2(6).
 *   - Gutenberg-Richter: log₁₀(N) = a - bM, b≈1.0
 *   - Spatial extent from Wells & Coppersmith (1994): log₁₀(SRL) = -3.22 + 0.69*Mw
 *
 * Two visual layers per call:
 *   - Outer glow trail (wide, dim alpha)
 *   - Core trail (narrow, bright alpha)
 *
 * Animation loops continuously while the event is selected.
 * Deterministic generation (seeded PRNG from event ID).
 */

import { TripsLayer } from '@deck.gl/geo-layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';

// ── Aftershock trip data ─────────────────────────────────────

interface AftershockTrip {
  path: [number, number][];     // [lng, lat] waypoints
  timestamps: number[];          // parallel timestamps in animation seconds
  magnitude: number;
  color: [number, number, number];
  width: number;
}

// ── Cascade state ─────────────────────────────────────────────

export interface AftershockCascadeState {
  trips: AftershockTrip[];
  maxTime: number;   // animation loop duration in seconds
  eventId: string;
}

// ── Seismological constants ──────────────────────────────────

/**
 * Wells & Coppersmith (1994) surface rupture length.
 * log₁₀(SRL_km) = -3.22 + 0.69 * Mw (Table 2A, all fault types)
 */
function ruptureLength(mag: number): number {
  return Math.pow(10, -3.22 + 0.69 * mag);
}

/**
 * Omori time sampling via inverse CDF.
 * For p=1: t = c * ((Tmax+c)/c)^u - c
 *
 * @param u - uniform random [0,1]
 * @param maxTimeDays - maximum time window in days
 * @returns time in days after mainshock
 */
function omoriTimeSample(u: number, maxTimeDays: number): number {
  const c = 0.05; // characteristic time (days)
  return c * Math.pow((maxTimeDays + c) / c, u) - c;
}

/**
 * Gutenberg-Richter magnitude sampling.
 * Favors smaller magnitudes (power-law distribution).
 * Bath's Law: max aftershock ≈ M_main - 1.2
 */
function grMagnitudeSample(mainMag: number, u: number): number {
  const maxAfter = mainMag - 1.2;
  const minAfter = Math.max(2.0, mainMag - 4.0);
  // Power-law: smaller magnitudes much more likely
  return minAfter + (maxAfter - minAfter) * Math.pow(u, 2.5);
}

// ── Deterministic PRNG ───────────────────────────────────────

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ── Color ramp ───────────────────────────────────────────────

/**
 * Cascade trail color: bright amber (large) → cool violet (small).
 * Matches the aftershock zone orange-amber palette.
 */
function cascadeColor(mag: number, mainMag: number): [number, number, number] {
  const range = Math.max(1, mainMag - 2);
  const t = Math.max(0, Math.min(1, (mag - 2) / range));
  return [
    Math.round(140 + 115 * t),   // R: 140 → 255
    Math.round(80 + 120 * t),    // G: 80  → 200
    Math.round(220 - 180 * t),   // B: 220 → 40
  ];
}

// ── Cascade generation ──────────────────────────────────────

// Animation timing
const ANIM_DURATION_SEC = 12;   // total loop duration
const MAX_TIME_DAYS = 3;        // 3 days compressed into 12 seconds
export const AFTERSHOCK_CASCADE_MIN_MAGNITUDE = 5.0;

export function supportsAftershockCascadeMagnitude(magnitude: number | null | undefined): boolean {
  return magnitude != null && magnitude >= AFTERSHOCK_CASCADE_MIN_MAGNITUDE;
}

/**
 * Generate synthetic aftershock cascade from mainshock parameters.
 * Returns null for events below M5.0.
 *
 * Generation is deterministic — same event ID always produces the same pattern.
 */
export function generateAftershockCascade(
  event: EarthquakeEvent,
): AftershockCascadeState | null {
  if (!supportsAftershockCascadeMagnitude(event.magnitude)) return null;

  const rng = seededRandom(hashString(event.id));
  const rupLen = ruptureLength(event.magnitude);
  const cosLat = Math.cos(event.lat * Math.PI / 180);
  const kmToDeg = 1 / 111;

  // Number of aftershocks scales with magnitude
  // M5: ~8, M6: ~25, M7: ~80, M8: ~250 (capped at 80 for perf)
  const numAftershocks = Math.min(80, Math.round(5 * Math.pow(10, 0.5 * (event.magnitude - 4))));

  // Time scale: days → animation seconds
  const timeScale = ANIM_DURATION_SEC / (MAX_TIME_DAYS * 86400);

  // Random fault strike direction (deterministic per event)
  const strikeRad = rng() * Math.PI;
  const cosStrike = Math.cos(strikeRad);
  const sinStrike = Math.sin(strikeRad);

  const trips: AftershockTrip[] = [];

  for (let i = 0; i < numAftershocks; i++) {
    const u1 = rng(); // magnitude
    const u2 = rng(); // along-strike
    const u3 = rng(); // cross-strike
    const u4 = rng(); // time
    const u5 = rng(); // path curve

    // Magnitude (GR distribution, favors smaller)
    const mag = grMagnitudeSample(event.magnitude, u1);

    // Position within rupture zone (gaussian-ish via power transform)
    const alongStrike = (u2 * 2 - 1) * rupLen * 0.6;
    const crossStrike = (u3 * 2 - 1) * rupLen * 0.3;

    // Rotate by fault strike
    const dxKm = alongStrike * cosStrike - crossStrike * sinStrike;
    const dyKm = alongStrike * sinStrike + crossStrike * cosStrike;

    const afterLat = event.lat + dyKm * kmToDeg;
    const afterLng = event.lng + dxKm * kmToDeg / cosLat;

    // Time (Omori's law — earlier aftershocks more likely)
    const timeDays = omoriTimeSample(u4, MAX_TIME_DAYS);
    const timeAnimSec = timeDays * 86400 * timeScale;

    // Travel time: proportional to distance (energy propagation)
    const distKm = Math.sqrt(dxKm * dxKm + dyKm * dyKm);
    const travelSec = Math.min(1.8, 0.3 + distKm / rupLen * 1.2);

    // Midpoint with slight curve for organic look
    const curve = (u5 - 0.5) * rupLen * 0.08;
    const midLat = (event.lat + afterLat) / 2 + curve * kmToDeg;
    const midLng = (event.lng + afterLng) / 2 + curve * kmToDeg / cosLat;

    const color = cascadeColor(mag, event.magnitude);
    const width = Math.max(1, 1.5 * Math.pow(10, 0.18 * (mag - 3)));

    trips.push({
      path: [
        [event.lng, event.lat],
        [midLng, midLat],
        [afterLng, afterLat],
      ],
      timestamps: [
        timeAnimSec,
        timeAnimSec + travelSec * 0.5,
        timeAnimSec + travelSec,
      ],
      magnitude: mag,
      color,
      width,
    });
  }

  return {
    trips,
    maxTime: ANIM_DURATION_SEC,
    eventId: event.id,
  };
}

// ── Layer construction ──────────────────────────────────────

/**
 * Create TripsLayer pair for aftershock cascade animation.
 *
 * @param state - pre-generated cascade state
 * @param currentTime - seconds since cascade start (loops automatically)
 */
export function createAftershockCascadeLayers(
  state: AftershockCascadeState,
  currentTime: number,
): Layer[] {
  if (state.trips.length === 0) return [];

  // Loop the animation
  const t = currentTime % state.maxTime;

  return [
    // Outer glow trail — wide, soft
    new TripsLayer<AftershockTrip>({
      id: 'aftershock-cascade-glow',
      data: state.trips,
      pickable: false,
      getPath: (d) => d.path,
      getTimestamps: (d) => d.timestamps,
      getColor: (d) => [d.color[0], d.color[1], d.color[2], 45],
      getWidth: (d) => d.width * 5,
      widthUnits: 'pixels',
      currentTime: t,
      trailLength: 2.5,
      fadeTrail: true,
      jointRounded: true,
      capRounded: true,
    }) as unknown as Layer,

    // Core trail — narrow, bright
    new TripsLayer<AftershockTrip>({
      id: 'aftershock-cascade-core',
      data: state.trips,
      pickable: false,
      getPath: (d) => d.path,
      getTimestamps: (d) => d.timestamps,
      getColor: (d) => [d.color[0], d.color[1], d.color[2], 190],
      getWidth: (d) => d.width,
      widthUnits: 'pixels',
      currentTime: t,
      trailLength: 1.5,
      fadeTrail: true,
      jointRounded: true,
      capRounded: true,
    }) as unknown as Layer,
  ];
}
