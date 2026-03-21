import type { IntensityGrid, JmaClass } from '../types';
import { toJmaClass } from '../engine/gmpe';
import type { Municipality } from '../data/municipalities';

const GRID_KM_PER_DEG = 111;

const FOOTPRINT_SAMPLES = [
  { radial: 0, bearingDeg: 0, weight: 0.35 },
  { radial: 0.45, bearingDeg: 0, weight: 0.10 },
  { radial: 0.45, bearingDeg: 90, weight: 0.10 },
  { radial: 0.45, bearingDeg: 180, weight: 0.10 },
  { radial: 0.45, bearingDeg: 270, weight: 0.10 },
  { radial: 0.90, bearingDeg: 0, weight: 0.03125 },
  { radial: 0.90, bearingDeg: 45, weight: 0.03125 },
  { radial: 0.90, bearingDeg: 90, weight: 0.03125 },
  { radial: 0.90, bearingDeg: 135, weight: 0.03125 },
  { radial: 0.90, bearingDeg: 180, weight: 0.03125 },
  { radial: 0.90, bearingDeg: 225, weight: 0.03125 },
  { radial: 0.90, bearingDeg: 270, weight: 0.03125 },
  { radial: 0.90, bearingDeg: 315, weight: 0.03125 },
] as const;

const POPULATION_THRESHOLDS = [
  { key: '7', minIntensity: 6.5 },
  { key: '6+', minIntensity: 6.0 },
  { key: '6-', minIntensity: 5.5 },
  { key: '5+', minIntensity: 5.0 },
  { key: '5-', minIntensity: 4.5 },
  { key: '4+', minIntensity: 3.5 },
  { key: '3+', minIntensity: 2.5 },
] as const;

export type PopulationThresholdKey = typeof POPULATION_THRESHOLDS[number]['key'];

export interface MunicipalityIntensityAssessment {
  representativeIntensity: number;
  peakIntensity: number;
  representativeJmaClass: JmaClass;
  peakJmaClass: JmaClass;
  thresholdShares: Record<PopulationThresholdKey, number>;
  discreteShares: Partial<Record<JmaClass, number>>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function inferMunicipalityKind(name: string): 'ward' | 'city' | 'town' | 'village' | 'other' {
  if (name.endsWith('区')) return 'ward';
  if (name.endsWith('市')) return 'city';
  if (name.endsWith('町')) return 'town';
  if (name.endsWith('村')) return 'village';
  return 'other';
}

function estimateOccupiedRadiusKm(municipality: Municipality): number {
  const kind = inferMunicipalityKind(municipality.name);
  const densityPerKm2 = (() => {
    switch (kind) {
      case 'ward':
        return 14_000;
      case 'city':
        if (municipality.population >= 1_000_000) return 4_500;
        if (municipality.population >= 300_000) return 2_200;
        return 1_200;
      case 'town':
        return 450;
      case 'village':
        return 160;
      default:
        return 800;
    }
  })();

  const occupiedAreaKm2 = municipality.population / densityPerKm2;
  const rawRadiusKm = Math.sqrt(occupiedAreaKm2 / Math.PI);

  switch (kind) {
    case 'ward':
      return clamp(rawRadiusKm, 2, 10);
    case 'city':
      return clamp(rawRadiusKm, 3, 20);
    case 'town':
      return clamp(rawRadiusKm, 2, 14);
    case 'village':
      return clamp(rawRadiusKm, 2, 12);
    default:
      return clamp(rawRadiusKm, 2, 14);
  }
}

function offsetPoint(lat: number, lng: number, distanceKm: number, bearingDeg: number): { lat: number; lng: number } {
  const bearingRad = bearingDeg * Math.PI / 180;
  const northKm = Math.cos(bearingRad) * distanceKm;
  const eastKm = Math.sin(bearingRad) * distanceKm;
  const latOffsetDeg = northKm / GRID_KM_PER_DEG;
  const cosLat = Math.max(0.2, Math.cos(lat * Math.PI / 180));
  const lngOffsetDeg = eastKm / (GRID_KM_PER_DEG * cosLat);

  return {
    lat: lat + latOffsetDeg,
    lng: lng + lngOffsetDeg,
  };
}

export function sampleGridIntensity(grid: IntensityGrid, lat: number, lng: number): number {
  const lngRadiusDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const latMin = grid.center.lat - grid.radiusDeg;
  const latMax = grid.center.lat + grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadiusDeg;
  const lngMax = grid.center.lng + lngRadiusDeg;

  if (lat < latMin || lat > latMax || lng < lngMin || lng > lngMax) {
    return 0;
  }

  const rowPos = ((lat - latMin) / (latMax - latMin)) * (grid.rows - 1);
  const colPos = ((lng - lngMin) / (lngMax - lngMin)) * (grid.cols - 1);

  const row0 = Math.floor(rowPos);
  const col0 = Math.floor(colPos);
  const row1 = Math.min(grid.rows - 1, row0 + 1);
  const col1 = Math.min(grid.cols - 1, col0 + 1);
  const rowT = rowPos - row0;
  const colT = colPos - col0;

  const topLeft = grid.data[row0 * grid.cols + col0] ?? 0;
  const topRight = grid.data[row0 * grid.cols + col1] ?? 0;
  const bottomLeft = grid.data[row1 * grid.cols + col0] ?? 0;
  const bottomRight = grid.data[row1 * grid.cols + col1] ?? 0;

  const top = topLeft + (topRight - topLeft) * colT;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * colT;
  return top + (bottom - top) * rowT;
}

export function assessMunicipalityIntensity(
  grid: IntensityGrid,
  municipality: Municipality,
): MunicipalityIntensityAssessment {
  const occupiedRadiusKm = estimateOccupiedRadiusKm(municipality);
  const thresholdShares = {
    '7': 0,
    '6+': 0,
    '6-': 0,
    '5+': 0,
    '5-': 0,
    '4+': 0,
    '3+': 0,
  } satisfies Record<PopulationThresholdKey, number>;
  const discreteShares: Partial<Record<JmaClass, number>> = {};

  let representativeIntensity = 0;
  let peakIntensity = 0;

  for (const sample of FOOTPRINT_SAMPLES) {
    const point = sample.radial === 0
      ? { lat: municipality.lat, lng: municipality.lng }
      : offsetPoint(municipality.lat, municipality.lng, occupiedRadiusKm * sample.radial, sample.bearingDeg);
    const intensity = sampleGridIntensity(grid, point.lat, point.lng);

    representativeIntensity += intensity * sample.weight;
    peakIntensity = Math.max(peakIntensity, intensity);

    const jmaClass = toJmaClass(intensity);
    discreteShares[jmaClass] = (discreteShares[jmaClass] ?? 0) + sample.weight;

    for (const threshold of POPULATION_THRESHOLDS) {
      if (intensity >= threshold.minIntensity) {
        thresholdShares[threshold.key] += sample.weight;
      }
    }
  }

  return {
    representativeIntensity,
    peakIntensity,
    representativeJmaClass: toJmaClass(representativeIntensity),
    peakJmaClass: toJmaClass(peakIntensity),
    thresholdShares,
    discreteShares,
  };
}
