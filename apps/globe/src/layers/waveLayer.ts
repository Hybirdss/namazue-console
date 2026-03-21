/**
 * Wave Layer — P-wave and S-wave propagation rings.
 *
 * THE signature visual of namazue.dev.
 *
 * Performance approach:
 * - ONE ScatterplotLayer for P-wave rings, ONE for S-wave rings
 * - Stable data arrays (only rebuild when wave sources change)
 * - Ring expansion via radiusScale uniform (virtually free at 60fps)
 * - Fading via getLineColor with updateTriggers only on data change
 *
 * Each wave source generates 3 P-wave rings and 3 S-wave rings:
 *   - Main ring at full velocity radius
 *   - Two trailing echo rings at fixed km lags behind the main ring
 *
 * Echo alphas (P): main=160, echo1=70, echo2=35
 * Echo alphas (S): main=220, echo1=90, echo2=50
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import { jmaThresholdDistanceKm } from '../engine/gmpe';
import type { FaultType } from '../types';

const VP_KM_S = 6.0;
const VS_KM_S = 3.5;
// FADE_START ratio: fade begins at 40% of max radius
const FADE_START_RATIO = 0.4;

// Echo ring lag distances (km behind the main ring) — mirrors waveSequence.ts
const P_ECHO_LAGS_KM = [25, 55];  // km behind main P ring
const S_ECHO_LAGS_KM = [18, 40];  // km behind main S ring

// Alpha values per ring tier
const P_ALPHAS = [160, 70, 35] as const;   // main, echo1, echo2
const S_ALPHAS = [220, 90, 50] as const;   // main, echo1, echo2

export interface WaveSource {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  faultType: FaultType;
  originTime: number;
}

interface WaveRingDatum {
  position: [number, number];
  radiusMeters: number;
  color: [number, number, number, number];
}

/**
 * Compute a single wave ring at a given surface distance.
 * Returns null if the ring is out of bounds or the elapsed time is invalid.
 *
 * @param surfaceKm - surface propagation distance in km
 * @param source    - wave source parameters
 * @param baseColor - RGB tuple for the ring color
 * @param maxAlpha  - maximum alpha (0-255) at zero fade
 * @param maxRadiusKm - cutoff radius; ring is suppressed beyond this
 */
function computeRingAt(
  surfaceKm: number,
  source: WaveSource,
  baseColor: [number, number, number],
  maxAlpha: number,
  maxRadiusKm: number,
): WaveRingDatum | null {
  if (surfaceKm < 5) return null;
  if (surfaceKm > maxRadiusKm) return null;

  const totalKm = Math.sqrt(surfaceKm * surfaceKm + source.depth_km * source.depth_km);
  const radiusMeters = totalKm * 1000;

  const fadeStartKm = maxRadiusKm * FADE_START_RATIO;
  let opacity = 1.0;
  if (surfaceKm > fadeStartKm) {
    opacity = Math.max(0, 1 - (surfaceKm - fadeStartKm) / (maxRadiusKm - fadeStartKm));
  }
  const magScale = Math.min(1, (source.magnitude - 3) / 4);
  opacity *= Math.max(0.3, magScale);

  return {
    position: [source.lng, source.lat],
    radiusMeters,
    color: [baseColor[0], baseColor[1], baseColor[2], Math.round(opacity * maxAlpha)],
  };
}

// Pre-allocated arrays to avoid GC pressure
let pWaveData: WaveRingDatum[] = [];
let sWaveData: WaveRingDatum[] = [];

/**
 * Recompute wave ring data for current time.
 * Called at controlled intervals (not every frame).
 *
 * For each source, generates up to 3 P-wave rings and 3 S-wave rings:
 *   ring 0: main front
 *   ring 1: echo 1 (lag behind main)
 *   ring 2: echo 2 (further lag)
 */
export function updateWaveData(sources: WaveSource[], currentTime: number): void {
  const pRings: WaveRingDatum[] = [];
  const sRings: WaveRingDatum[] = [];

  for (const source of sources) {
    const maxRKm = jmaThresholdDistanceKm(source.magnitude, source.depth_km, source.faultType);
    const elapsedSec = (currentTime - source.originTime) / 1000;
    if (elapsedSec < 0 || elapsedSec > maxRKm / VS_KM_S + 10) continue;

    const pMainKm = VP_KM_S * elapsedSec;
    const sMainKm = VS_KM_S * elapsedSec;

    // P-wave: main ring
    const pMain = computeRingAt(pMainKm, source, [125, 211, 252], P_ALPHAS[0], maxRKm);
    if (pMain) pRings.push(pMain);

    // P-wave: echo rings
    for (let i = 0; i < P_ECHO_LAGS_KM.length; i++) {
      const echoKm = pMainKm - P_ECHO_LAGS_KM[i];
      const echo = computeRingAt(echoKm, source, [125, 211, 252], P_ALPHAS[i + 1], maxRKm);
      if (echo) pRings.push(echo);
    }

    // S-wave: main ring
    const sMain = computeRingAt(sMainKm, source, [251, 191, 36], S_ALPHAS[0], maxRKm);
    if (sMain) sRings.push(sMain);

    // S-wave: echo rings
    for (let i = 0; i < S_ECHO_LAGS_KM.length; i++) {
      const echoKm = sMainKm - S_ECHO_LAGS_KM[i];
      const echo = computeRingAt(echoKm, source, [251, 191, 36], S_ALPHAS[i + 1], maxRKm);
      if (echo) sRings.push(echo);
    }
  }

  pWaveData = pRings;
  sWaveData = sRings;
}

/**
 * Create the two wave layers. Call after updateWaveData().
 */
export function createWaveLayers(): ScatterplotLayer[] {
  const layers: ScatterplotLayer[] = [];

  if (pWaveData.length > 0) {
    layers.push(new ScatterplotLayer<WaveRingDatum>({
      id: 'wave-p',
      data: pWaveData,
      pickable: false,
      stroked: true,
      filled: false,
      radiusUnits: 'meters',
      lineWidthUnits: 'pixels',
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusMeters,
      getLineColor: (d) => d.color,
      getLineWidth: 2,
      updateTriggers: {
        getRadius: [pWaveData],
        getLineColor: [pWaveData],
      },
    }));
  }

  if (sWaveData.length > 0) {
    layers.push(new ScatterplotLayer<WaveRingDatum>({
      id: 'wave-s',
      data: sWaveData,
      pickable: false,
      stroked: true,
      filled: false,
      radiusUnits: 'meters',
      lineWidthUnits: 'pixels',
      getPosition: (d) => d.position,
      getRadius: (d) => d.radiusMeters,
      getLineColor: (d) => d.color,
      getLineWidth: 3.5,
      updateTriggers: {
        getRadius: [sWaveData],
        getLineColor: [sWaveData],
      },
    }));
  }

  return layers;
}
