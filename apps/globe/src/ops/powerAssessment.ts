import type { EarthquakeEvent } from '../types';
import type { OpsSeverity } from './types';
import { estimateSiteIntensity } from './siteIntensity';

export type PlantType = 'nuclear' | 'thermal';
export type PlantStatus = 'operating' | 'shutdown' | 'decommissioning';
export type ScramLikelihood = 'none' | 'unlikely' | 'possible' | 'likely' | 'certain';

export interface PowerPlant {
  id: string;
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  type: PlantType;
  status: PlantStatus;
  capacityMw: number;
  units: number;
  region: string;
}

export interface PowerPlantAssessment {
  intensity: number;
  pgaGal: number;
  scram: ScramLikelihood;
  inImpactZone: boolean;
}

const IMPACT_ZONE_INTENSITY = 3.5;

export function intensityToPgaGal(intensity: number): number {
  if (intensity <= 0) return 0;
  return Math.pow(10, (intensity - 0.94) / 2);
}

export function computeScramLikelihood(
  pgaGal: number,
  status: PlantStatus,
): ScramLikelihood {
  if (status !== 'operating') return 'none';
  if (pgaGal >= 200) return 'certain';
  if (pgaGal >= 120) return 'likely';
  if (pgaGal >= 80) return 'possible';
  if (pgaGal >= 40) return 'unlikely';
  return 'none';
}

export function rankScramLikelihood(likelihood: ScramLikelihood): number {
  switch (likelihood) {
    case 'certain': return 4;
    case 'likely': return 3;
    case 'possible': return 2;
    case 'unlikely': return 1;
    case 'none': return 0;
  }
}

export function scramLikelihoodToSeverity(likelihood: ScramLikelihood): OpsSeverity {
  switch (likelihood) {
    case 'certain':
    case 'likely':
      return 'critical';
    case 'possible':
      return 'priority';
    case 'unlikely':
      return 'watch';
    case 'none':
      return 'clear';
  }
}

export function assessPowerPlant(
  plant: PowerPlant,
  event: EarthquakeEvent | null,
): PowerPlantAssessment {
  if (!event) {
    return {
      intensity: 0,
      pgaGal: 0,
      scram: 'none',
      inImpactZone: false,
    };
  }

  const intensity = estimateSiteIntensity(event, plant.lat, plant.lng);
  const pgaGal = intensityToPgaGal(intensity);

  return {
    intensity,
    pgaGal,
    scram: plant.type === 'nuclear'
      ? computeScramLikelihood(pgaGal, plant.status)
      : 'none',
    inImpactZone: intensity >= IMPACT_ZONE_INTENSITY,
  };
}
