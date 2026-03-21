/**
 * Impact Intelligence — Core actionable intelligence derived from GMPE,
 * infrastructure catalogs, and real-time vessel data.
 *
 * This module aggregates seismic engine output, infrastructure exposure,
 * tsunami assessment, and response protocol timelines into the numbers
 * that operators actually need to make decisions.
 *
 * All computations are pure functions — no side effects, no DOM access.
 */

import type {
  EarthquakeEvent,
  HazardFieldSource,
  IntensityGrid,
  JmaClass,
  TsunamiArrivalEstimate,
  TsunamiSummary,
} from '../types';
import { haversine, toJmaClass } from '../engine/gmpe';
import { t } from '../i18n';
import {
  MUNICIPALITIES,
  JAPAN_TOTAL_POPULATION,
  CATALOGED_POPULATION,
  type Municipality,
} from '../data/municipalities';
import { HOSPITALS, type HospitalPosture } from '../layers/hospitalLayer';
import { POWER_PLANTS } from './powerCatalog';
import { RAIL_ROUTES, type RailRoute } from '../layers/railLayer';
import { computeMaritimeExposure } from '../layers/aisLayer';
import { haversineKm, impactRadiusKm } from '../layers/impactZone';
import type { Vessel } from '../data/aisManager';
import { assessPowerPlant } from './powerAssessment';
import { MAJOR_PORTS, RESPONSE_MILESTONE_TEMPLATES } from './impactPlaybook';
import { estimateSiteIntensity } from './siteIntensity';
import { assessMunicipalityIntensity } from './municipalityIntensity';

// ============================================================
// 1. Peak JMA Intensity
// ============================================================

export interface PeakIntensity {
  /** Continuous JMA instrumental intensity (e.g. 5.8) */
  value: number;
  /** Display class (e.g. '6-') */
  jmaClass: JmaClass;
  /** Location of the peak intensity cell */
  location: { lat: number; lng: number };
}

/** Peak intensity on land (at the most-affected municipality) */
export interface LandPeakIntensity {
  /** Continuous JMA instrumental intensity at the most-affected city */
  value: number;
  /** Display class */
  jmaClass: JmaClass;
  /** City name (Japanese) */
  cityName: string;
  /** City name (English) */
  cityNameEn: string;
  /** Population of the most-affected municipality */
  population: number;
}

/**
 * Extract the maximum intensity value and its location from an IntensityGrid.
 */
export function computePeakIntensity(grid: IntensityGrid): PeakIntensity {
  let maxVal = 0;
  let maxIdx = 0;

  for (let i = 0; i < grid.data.length; i++) {
    if (grid.data[i] > maxVal) {
      maxVal = grid.data[i];
      maxIdx = i;
    }
  }

  const row = Math.floor(maxIdx / grid.cols);
  const col = maxIdx % grid.cols;
  const lngRadiusDeg = grid.radiusLngDeg ?? grid.radiusDeg;

  const lat =
    (grid.center.lat - grid.radiusDeg) +
    row * (2 * grid.radiusDeg / (grid.rows - 1));
  const lng =
    (grid.center.lng - lngRadiusDeg) +
    col * (2 * lngRadiusDeg / (grid.cols - 1));

  return {
    value: maxVal,
    jmaClass: toJmaClass(maxVal),
    location: { lat, lng },
  };
}

function inferHazardFieldSource(
  event: EarthquakeEvent,
  override?: HazardFieldSource,
): HazardFieldSource {
  if (override) return override;
  if (event.scenarioKind === 'historical_replay') return 'scenario_official';
  if (event.scenarioId) return 'scenario_modeled';
  return 'gmpe_grid';
}

/**
 * Compute the peak JMA intensity ON LAND by checking all cataloged municipalities.
 * Returns null if no municipality is significantly affected (JMA < 0.5).
 */
export function computeLandPeakIntensity(
  grid: IntensityGrid | null,
  municipalities: readonly Municipality[] = MUNICIPALITIES,
): LandPeakIntensity | null {
  if (!grid) return null;

  let bestCity: Municipality | null = null;
  let bestIntensity = 0;

  for (const city of municipalities) {
    const intensity = assessMunicipalityIntensity(grid, city).peakIntensity;
    if (intensity > bestIntensity) {
      bestIntensity = intensity;
      bestCity = city;
    }
  }

  if (!bestCity || bestIntensity < 2.5) return null;

  return {
    value: bestIntensity,
    jmaClass: toJmaClass(bestIntensity),
    cityName: bestCity.name,
    cityNameEn: bestCity.nameEn,
    population: bestCity.population,
  };
}

// ============================================================
// 2. Intensity Area Statistics
// ============================================================

export interface IntensityAreaStats {
  /** km^2 at JMA 4 or higher (intensity >= 3.5) */
  jma4plus: number;
  /** km^2 at JMA 5- or higher (intensity >= 4.5) */
  jma5minus: number;
  /** km^2 at JMA 5+ or higher (intensity >= 5.0) */
  jma5plus: number;
  /** km^2 at JMA 6- or higher (intensity >= 5.5) */
  jma6minus: number;
  /** km^2 at JMA 6+ or higher (intensity >= 6.0) */
  jma6plus: number;
  /** km^2 at JMA 7 (intensity >= 6.5) */
  jma7: number;
  /** Raw modeled grid coverage, includes ocean cells when no land mask is available. */
  modeledFieldAreaKm2?: number;
  /** Main panel should only show numeric area when this is land-only. */
  coverageKind?: 'land' | 'modeled_field';
  hazardFieldSource?: HazardFieldSource;
}

/**
 * Compute area (km^2) above each JMA intensity threshold from an IntensityGrid.
 *
 * Each grid cell covers approximately:
 *   (latStep_deg * 111 km) * (lngStep_deg * 111 km * cos(lat_rad))
 */
export function computeIntensityAreaStats(grid: IntensityGrid): IntensityAreaStats {
  const lngRadiusDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const latStep = (2 * grid.radiusDeg) / (grid.rows - 1);
  const lngStep = (2 * lngRadiusDeg) / (grid.cols - 1);

  const KM_PER_DEG = 111.0;

  let jma4plus = 0;
  let jma5minus = 0;
  let jma5plus = 0;
  let jma6minus = 0;
  let jma6plus = 0;
  let jma7 = 0;
  let modeledFieldAreaKm2 = 0;

  for (let row = 0; row < grid.rows; row++) {
    const lat = (grid.center.lat - grid.radiusDeg) + row * latStep;
    const cosLat = Math.cos(lat * Math.PI / 180);
    const cellAreaKm2 = (latStep * KM_PER_DEG) * (lngStep * KM_PER_DEG * cosLat);

    for (let col = 0; col < grid.cols; col++) {
      const intensity = grid.data[row * grid.cols + col];
      modeledFieldAreaKm2 += cellAreaKm2;

      if (intensity >= 6.5) {
        jma7 += cellAreaKm2;
        jma6plus += cellAreaKm2;
        jma6minus += cellAreaKm2;
        jma5plus += cellAreaKm2;
        jma5minus += cellAreaKm2;
        jma4plus += cellAreaKm2;
      } else if (intensity >= 6.0) {
        jma6plus += cellAreaKm2;
        jma6minus += cellAreaKm2;
        jma5plus += cellAreaKm2;
        jma5minus += cellAreaKm2;
        jma4plus += cellAreaKm2;
      } else if (intensity >= 5.5) {
        jma6minus += cellAreaKm2;
        jma5plus += cellAreaKm2;
        jma5minus += cellAreaKm2;
        jma4plus += cellAreaKm2;
      } else if (intensity >= 5.0) {
        jma5plus += cellAreaKm2;
        jma5minus += cellAreaKm2;
        jma4plus += cellAreaKm2;
      } else if (intensity >= 4.5) {
        jma5minus += cellAreaKm2;
        jma4plus += cellAreaKm2;
      } else if (intensity >= 3.5) {
        jma4plus += cellAreaKm2;
      }
    }
  }

  return {
    jma4plus: Math.round(jma4plus),
    jma5minus: Math.round(jma5minus),
    jma5plus: Math.round(jma5plus),
    jma6minus: Math.round(jma6minus),
    jma6plus: Math.round(jma6plus),
    jma7: Math.round(jma7),
    modeledFieldAreaKm2: Math.round(modeledFieldAreaKm2),
    coverageKind: 'modeled_field',
  };
}

// ============================================================
// 3. Population Exposure
// ============================================================

export type PopulationThreshold = '7' | '6+' | '6-' | '5+' | '5-' | '4+' | '3+';

export interface MunicipalityExposure {
  name: string;
  nameEn: string;
  population: number;
  exposedPopulation?: number;
  intensity: number;
  jmaClass: JmaClass;
}

export interface PopulationExposure {
  /** Population in areas with JMA 7 (intensity >= 6.5) */
  jma7: number;
  /** Population in areas with JMA 6+ or higher (intensity >= 6.0) */
  jma6plus: number;
  /** Population in areas with JMA 6- or higher (intensity >= 5.5) */
  jma6minus: number;
  /** Population in areas with JMA 5+ or higher (intensity >= 5.0) */
  jma5plus: number;
  /** Population in areas with JMA 5- or higher (intensity >= 4.5) */
  jma5minus: number;
  /** Population in areas with JMA 4 or higher (intensity >= 3.5) */
  jma4plus: number;
  /** Population in areas with JMA 3 or higher (intensity >= 2.5) */
  jma3plus: number;
  /** Administrative units assessed against the intensity field */
  assessedUnits?: number;
  /** Total cataloged population assessed */
  catalogedPopulation: number;
  /** Japan total resident population */
  totalPopulation: number;
  /** Top affected municipalities with their intensity */
  topAffected: MunicipalityExposure[];
  cumulativeByThreshold?: Record<PopulationThreshold, number>;
  discreteByClass?: Partial<Record<JmaClass, number>>;
  topMunicipalitiesByThreshold?: Record<PopulationThreshold, MunicipalityExposure[]>;
  coverage?: {
    catalogedPopulation: number;
    totalPopulation: number;
    ratio: number;
  };
  warnings?: string[];
  hazardFieldSource?: HazardFieldSource;
}

/**
 * Compute population exposure by JMA intensity class.
 *
 * For each municipality in the catalog, sample an occupied-footprint proxy
 * against the authoritative hazard field and distribute population by the
 * share of sampled points above each threshold.
 *
 * Population data: 総務省 e-Stat 住民基本台帳人口 (2025-01-01).
 */
export function computePopulationExposure(
  grid: IntensityGrid | null,
  hazardFieldSource: HazardFieldSource,
  municipalities: readonly Municipality[] = MUNICIPALITIES,
): PopulationExposure | null {
  if (!grid) return null;

  const cumulativeByThreshold = {
    '7': 0,
    '6+': 0,
    '6-': 0,
    '5+': 0,
    '5-': 0,
    '4+': 0,
    '3+': 0,
  } satisfies Record<PopulationThreshold, number>;
  const discreteByClass: Partial<Record<JmaClass, number>> = {};
  const affected: MunicipalityExposure[] = [];
  const municipalityAssessments = municipalities.map((city) => ({
    city,
    assessment: assessMunicipalityIntensity(grid, city),
  }));

  for (const { city, assessment } of municipalityAssessments) {
    const exposedPopulation3plus = city.population * assessment.thresholdShares['3+'];
    if (exposedPopulation3plus < 1) continue;

    for (const jmaClass of Object.keys(assessment.discreteShares) as JmaClass[]) {
      const share = assessment.discreteShares[jmaClass] ?? 0;
      discreteByClass[jmaClass] = (discreteByClass[jmaClass] ?? 0) + (city.population * share);
    }

    for (const threshold of Object.keys(cumulativeByThreshold) as PopulationThreshold[]) {
      cumulativeByThreshold[threshold] += city.population * assessment.thresholdShares[threshold];
    }

    affected.push({
      name: city.name,
      nameEn: city.nameEn,
      population: city.population,
      exposedPopulation: Math.round(exposedPopulation3plus),
      intensity: assessment.representativeIntensity,
      jmaClass: assessment.representativeJmaClass,
    });
  }

  affected.sort((a, b) => {
    const exposureDiff = (b.exposedPopulation ?? 0) - (a.exposedPopulation ?? 0);
    return exposureDiff || b.intensity - a.intensity || b.population - a.population;
  });

  const topMunicipalitiesByThreshold = {
    '7': [] as MunicipalityExposure[],
    '6+': [] as MunicipalityExposure[],
    '6-': [] as MunicipalityExposure[],
    '5+': [] as MunicipalityExposure[],
    '5-': [] as MunicipalityExposure[],
    '4+': [] as MunicipalityExposure[],
    '3+': [] as MunicipalityExposure[],
  } satisfies Record<PopulationThreshold, MunicipalityExposure[]>;

  for (const { city, assessment } of municipalityAssessments) {
    for (const threshold of Object.keys(topMunicipalitiesByThreshold) as PopulationThreshold[]) {
      const exposedPopulation = Math.round(city.population * assessment.thresholdShares[threshold]);
      if (exposedPopulation <= 0) continue;
      topMunicipalitiesByThreshold[threshold].push({
        name: city.name,
        nameEn: city.nameEn,
        population: city.population,
        exposedPopulation,
        intensity: assessment.representativeIntensity,
        jmaClass: assessment.representativeJmaClass,
      });
    }
  }

  for (const threshold of Object.keys(topMunicipalitiesByThreshold) as PopulationThreshold[]) {
    topMunicipalitiesByThreshold[threshold].sort((a, b) => {
      const exposureDiff = (b.exposedPopulation ?? 0) - (a.exposedPopulation ?? 0);
      return exposureDiff || b.intensity - a.intensity || b.population - a.population;
    });
    topMunicipalitiesByThreshold[threshold] = topMunicipalitiesByThreshold[threshold].slice(0, 10);
  }

  const roundedCumulativeByThreshold = {
    '7': Math.round(cumulativeByThreshold['7']),
    '6+': Math.round(cumulativeByThreshold['6+']),
    '6-': Math.round(cumulativeByThreshold['6-']),
    '5+': Math.round(cumulativeByThreshold['5+']),
    '5-': Math.round(cumulativeByThreshold['5-']),
    '4+': Math.round(cumulativeByThreshold['4+']),
    '3+': Math.round(cumulativeByThreshold['3+']),
  } satisfies Record<PopulationThreshold, number>;
  roundedCumulativeByThreshold['6+'] = Math.max(roundedCumulativeByThreshold['6+'], roundedCumulativeByThreshold['7']);
  roundedCumulativeByThreshold['6-'] = Math.max(roundedCumulativeByThreshold['6-'], roundedCumulativeByThreshold['6+']);
  roundedCumulativeByThreshold['5+'] = Math.max(roundedCumulativeByThreshold['5+'], roundedCumulativeByThreshold['6-']);
  roundedCumulativeByThreshold['5-'] = Math.max(roundedCumulativeByThreshold['5-'], roundedCumulativeByThreshold['5+']);
  roundedCumulativeByThreshold['4+'] = Math.max(roundedCumulativeByThreshold['4+'], roundedCumulativeByThreshold['5-']);
  roundedCumulativeByThreshold['3+'] = Math.max(roundedCumulativeByThreshold['3+'], roundedCumulativeByThreshold['4+']);

  const roundedDiscreteByClass = Object.fromEntries(
    Object.entries(discreteByClass).map(([jmaClass, population]) => [jmaClass, Math.round(population)]),
  ) as Partial<Record<JmaClass, number>>;

  return {
    jma7: roundedCumulativeByThreshold['7'],
    jma6plus: roundedCumulativeByThreshold['6+'],
    jma6minus: roundedCumulativeByThreshold['6-'],
    jma5plus: roundedCumulativeByThreshold['5+'],
    jma5minus: roundedCumulativeByThreshold['5-'],
    jma4plus: roundedCumulativeByThreshold['4+'],
    jma3plus: roundedCumulativeByThreshold['3+'],
    assessedUnits: municipalities.length,
    catalogedPopulation: CATALOGED_POPULATION,
    totalPopulation: JAPAN_TOTAL_POPULATION,
    topAffected: affected.slice(0, 10),
    cumulativeByThreshold: roundedCumulativeByThreshold,
    discreteByClass: roundedDiscreteByClass,
    topMunicipalitiesByThreshold,
    coverage: {
      catalogedPopulation: CATALOGED_POPULATION,
      totalPopulation: JAPAN_TOTAL_POPULATION,
      ratio: CATALOGED_POPULATION / JAPAN_TOTAL_POPULATION,
    },
    warnings: [],
    hazardFieldSource,
  };
}

// ============================================================
// 4. Infrastructure Impact Summary
// ============================================================

export interface InfraImpactSummary {
  hospitalsCompromised: number;
  hospitalsDisrupted: number;
  hospitalsOperational: number;
  dmatBasesDeployable: number;
  nuclearScramLikely: number;
  nuclearScramPossible: number;
  railLinesSuspended: number;
  railLinesAffected: number;
  vesselsInZone: number;
  /** Passenger + tanker vessels in impact zone */
  vesselsHighPriority: number;
}

/**
 * Compute hospital posture from GMPE intensity at site.
 * Mirrors hospitalLayer.ts computeHospitalPosture logic.
 */
function computeHospitalPosture(intensity: number): HospitalPosture {
  if (intensity < 4.5) return 'operational';
  if (intensity < 5.5) return 'disrupted';
  if (intensity < 6.0) return 'assessment-needed';
  return 'compromised';
}

/**
 * Approximate PGA (gal) from JMA instrumental intensity.
 *
 * Uses the empirical relationship between JMA intensity and peak ground
 * acceleration. The JMA intensity scale is defined as:
 *   I_JMA = 2 * log10(a_filtered) + 0.94
 * where a_filtered is the vector sum of filtered accelerations (not raw PGA).
 *
 * For approximate PGA estimation, we use the inverse:
 *   PGA_approx ≈ 10^((I - 0.94) / 2)
 *
 * This gives values consistent with Midorikawa et al. (1999) empirical
 * PGA-intensity relationship and JMA published intensity-acceleration tables:
 *   JMA 5- (I=4.5): ~105 gal   (JMA range: 80-110)
 *   JMA 6- (I=5.5): ~190 gal   (JMA range: 180-250)
 *   JMA 6+ (I=6.0): ~338 gal   (JMA range: 250-400)
 *
 * Reference: JMA "計測震度の算出方法" (Method of computing instrumental intensity)
 * https://www.data.jma.go.jp/eqev/data/kyoshin/kaisetsu/calc_sindo.html
 *
 * Mirrors powerLayer.ts intensityToPgaGal logic.
 */
/**
 * Estimate SCRAM (automatic reactor shutdown) likelihood from PGA.
 *
 * Japanese nuclear plants have seismic automatic shutdown systems (地震感知器)
 * that trigger reactor trip when observed ground acceleration exceeds a
 * design-specific setpoint.
 *
 * Historical SCRAM trigger levels (NRA 原子力規制委員会):
 *   - Pre-2006 (S1 design basis): ~120 gal horizontal at reactor building base
 *   - Post-2006 (Ss design basis): 450-993 gal depending on plant
 *     (e.g., Sendai: 620 gal, Ohi: 856 gal, Mihama: 993 gal)
 *   - Actual seismic SCRAM setpoints are typically lower than Ss, around
 *     120-200 gal for most plants.
 *
 * Historical events:
 *   - 2007 NCO earthquake: Kashiwazaki-Kariwa, 680 gal observed, all 7 units tripped
 *   - 2011 Tohoku: Onagawa, ~540 gal observed, safe automatic shutdown
 *   - 2016 Kumamoto: Sendai, ~8 gal observed (distant), no SCRAM
 *
 * Reference: NRA "新規制基準の概要" (Overview of New Regulatory Requirements);
 * each plant's "設置変更許可申請書" (Installation Change Permit Application)
 * documents the specific Ss and SCRAM setpoint values.
 *
 * The thresholds below are conservative approximations for the visualization.
 * Actual SCRAM decisions depend on plant-specific setpoints and observed
 * acceleration at the reactor building, not at the free-field surface.
 *
 * Mirrors powerLayer.ts computeScramLikelihood logic.
 */
/**
 * Check if a rail route is affected by the earthquake using impact radius.
 * Mirrors railLayer.ts isRouteAffected logic.
 */
function isRouteAffected(route: RailRoute, event: EarthquakeEvent): boolean {
  const radius = impactRadiusKm(event.magnitude, event.depth_km, event.faultType);
  return route.path.some(([lng, lat]) =>
    haversineKm(lat, lng, event.lat, event.lng) <= radius,
  );
}

/**
 * Compute the GMPE intensity at a specific site given an earthquake event.
 * Returns clamped non-negative JMA intensity.
 */
function computeSiteIntensity(
  siteLat: number,
  siteLng: number,
  event: EarthquakeEvent,
  grid?: IntensityGrid | null,
): number {
  return estimateSiteIntensity(event, siteLat, siteLng, grid);
}

/**
 * Compute aggregate infrastructure impact from an earthquake event.
 *
 * Assesses hospitals, nuclear plants, rail lines, and maritime vessels
 * using the same GMPE and impact zone logic as the layer modules.
 */
export function computeInfraImpact(
  event: EarthquakeEvent,
  vessels: Vessel[],
): InfraImpactSummary {
  // ── Hospitals ──
  let hospitalsCompromised = 0;
  let hospitalsDisrupted = 0;
  let hospitalsOperational = 0;
  let dmatBasesDeployable = 0;

  for (const h of HOSPITALS) {
    const intensity = computeSiteIntensity(h.lat, h.lng, event);
    const posture = computeHospitalPosture(intensity);

    if (posture === 'compromised') {
      hospitalsCompromised++;
    } else if (posture === 'disrupted' || posture === 'assessment-needed') {
      hospitalsDisrupted++;
    } else {
      hospitalsOperational++;
    }

    // DMAT base that is operational can deploy teams
    if (h.dmat && posture === 'operational') {
      dmatBasesDeployable++;
    }
  }

  // ── Nuclear Plants ──
  let nuclearScramLikely = 0;
  let nuclearScramPossible = 0;

  const nuclearPlants = POWER_PLANTS.filter((p) => p.type === 'nuclear');
  for (const plant of nuclearPlants) {
    const scram = assessPowerPlant(plant, event).scram;

    if (scram === 'likely' || scram === 'certain') {
      nuclearScramLikely++;
    } else if (scram === 'possible') {
      nuclearScramPossible++;
    }
  }

  // ── Rail Lines ──
  let railLinesSuspended = 0;
  let railLinesAffected = 0;

  for (const route of RAIL_ROUTES) {
    if (isRouteAffected(route, event)) {
      // Shinkansen has UrEDAS auto-stop — suspended immediately
      if (route.type === 'shinkansen') {
        railLinesSuspended++;
      } else {
        railLinesAffected++;
      }
    }
  }

  // ── Maritime ──
  const exposure = computeMaritimeExposure(vessels, event);

  return {
    hospitalsCompromised,
    hospitalsDisrupted,
    hospitalsOperational,
    dmatBasesDeployable,
    nuclearScramLikely,
    nuclearScramPossible,
    railLinesSuspended,
    railLinesAffected,
    vesselsInZone: exposure.totalInZone,
    vesselsHighPriority: exposure.passengerCount + exposure.tankerCount,
  };
}

// ============================================================
// 4. Tsunami ETA at Major Ports
// ============================================================

export type TsunamiETA = TsunamiArrivalEstimate;

/**
 * Blended tsunami propagation speed (km/h).
 *
 * Deep ocean: sqrt(g * 4000m) ~ 198 m/s ~ 713 km/h
 * Continental shelf: sqrt(g * 200m) ~ 44 m/s ~ 160 km/h
 * Blended estimate for rough ETA: 500 km/h
 */
const TSUNAMI_SPEED_KMH = 500;

/**
 * Determine whether an event warrants tsunami ETA computation.
 */
function hasTsunamiRisk(event: EarthquakeEvent): boolean {
  if (event.tsunami) return true;
  if (event.magnitude >= 7.0 && event.faultType !== 'crustal') return true;
  return false;
}

/**
 * Compute estimated tsunami arrival times at Japan's 10 major ports.
 *
 * Only computed for events with tsunami risk (event.tsunami === true
 * or M >= 7.0 with non-crustal fault type).
 *
 * Results are sorted by arrival time (nearest first).
 */
export function computeTsunamiETAs(event: EarthquakeEvent): TsunamiETA[] {
  if (!hasTsunamiRisk(event)) return [];

  const etas: TsunamiETA[] = MAJOR_PORTS.map((port) => {
    const distanceKm = haversine(event.lat, event.lng, port.lat, port.lng);
    const estimatedMinutes = (distanceKm / TSUNAMI_SPEED_KMH) * 60;

    return {
      portName: port.name,
      portNameJa: port.nameJa,
      distanceKm: Math.round(distanceKm),
      estimatedMinutes: Math.round(estimatedMinutes),
      lat: port.lat,
      lng: port.lng,
    };
  });

  // Sort by arrival time (nearest first)
  etas.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);

  return etas;
}

export function computeTsunamiSummary(event: EarthquakeEvent | null): TsunamiSummary | null {
  if (!event || !hasTsunamiRisk(event)) {
    return null;
  }

  return {
    risk: event.tsunami
      ? (event.magnitude >= 7.5 ? 'high' : event.magnitude >= 6.5 ? 'moderate' : 'low')
      : 'low',
    status: event.scenarioKind === 'historical_replay' ? 'official' : 'modeled',
    source: event.scenarioKind === 'historical_replay'
      ? 'scenario_official'
      : event.scenarioKind
        ? 'scenario_modeled'
        : 'gmpe_grid',
    arrivalEstimatesMin: computeTsunamiETAs(event),
    heightMeters: event.scenarioKind === 'historical_replay' && event.magnitude >= 8.5
      ? 40.5
      : event.magnitude >= 8.0
        ? 27
        : null,
    confidence: event.tsunami ? 'high' : 'medium',
    factors: event.tsunami ? ['event tsunami flag'] : ['magnitude-based estimate'],
  };
}

// ============================================================
// 5. Response Protocol Timeline
// ============================================================

export interface ResponseMilestone {
  /** Minutes after earthquake origin */
  minutesAfter: number;
  label: string;
  labelJa: string;
  description: string;
  /** True if this event's magnitude/conditions warrant this response */
  triggered: boolean;
}

/**
 * Compute Japan's post-earthquake response protocol milestones.
 *
 * Timings based on documented government response protocols and
 * observed performance in historical earthquakes:
 *
 *   T+0s   UrEDAS: Nakamura, Y. (1988). "On the Urgent Earthquake Detection
 *           and Alarm System (UrEDAS)." Proc. 9th WCEE. Triggers at M≥4.0
 *           within 1-3 seconds via P-wave detection.
 *   T+3m   JMA 震度速報: JMA operational target is <3 minutes for automatic
 *           seismic intensity report. Observed: 2011 Tohoku, first report at
 *           14:49 JST (~3 min after origin).
 *   T+5m   NHK: Emergency broadcast within 3-5 minutes. 2011 Tohoku: NHK
 *           broke programming at 14:49 JST (~3 min).
 *   T+10m  Tsunami warning: JMA target <3 min for major tsunami warnings.
 *           2011 Tohoku: first tsunami warning at 14:49 (3 min). 10 min is
 *           conservative for updated warnings with magnitude revision.
 *   T+15m  DMAT: MHLW "DMAT活動要領" (DMAT Activity Guidelines) specifies
 *           standby notification within 15-30 minutes for major earthquakes.
 *   T+30m  FDMA: 消防庁防災業務計画 requires HQ establishment within 30 min
 *           for events with expected JMA 6+ intensity.
 *   T+60m  SDF: 2016 Kumamoto: SDF dispatch ordered ~45 min after mainshock.
 *           2011 Tohoku: immediate dispatch under 災害派遣要請.
 *   T+90m  Wide-area transport: 広域医療搬送計画 activates 1-2 hours after
 *           confirmation of catastrophic damage.
 *   T+180m Cabinet: 2011 Tohoku: Emergency cabinet meeting at 15:37 (~1.5h).
 *           2016 Kumamoto: ~2 hours. 3 hours is the statutory upper bound.
 *   T+360m International: 2011 Tohoku: International rescue teams arrived
 *           within 24h, but formal request issued within ~6 hours.
 *
 * Each milestone has a magnitude threshold that determines whether
 * the response protocol is triggered for this specific event.
 */
export function computeResponseTimeline(event: EarthquakeEvent): ResponseMilestone[] {
  const M = event.magnitude;
  const tsunamiRisk = hasTsunamiRisk(event);

  return RESPONSE_MILESTONE_TEMPLATES.map((milestone) => ({
    minutesAfter: milestone.minutesAfter,
    label: t(milestone.translationKey),
    labelJa: milestone.labelJa,
    description: t(`${milestone.translationKey}.desc`),
    triggered: milestone.tsunamiRiskRequired
      ? tsunamiRisk
      : milestone.minMagnitude === null
        ? true
        : M >= milestone.minMagnitude,
  }));
}

// ============================================================
// 6. Main Aggregate Export
// ============================================================

export interface ImpactIntelligence {
  peakIntensity: PeakIntensity | null;
  /** Peak intensity at nearest populated area (municipality-based) */
  landPeakIntensity: LandPeakIntensity | null;
  populationExposure: PopulationExposure | null;
  areaStats: IntensityAreaStats | null;
  infraSummary: InfraImpactSummary | null;
  tsunamiSummary?: TsunamiSummary | null;
  tsunamiETAs: TsunamiETA[];
  responseTimeline: ResponseMilestone[];
  hazardFieldSource?: HazardFieldSource;
}

/**
 * Compute the full impact intelligence picture from an earthquake event,
 * intensity grid, and current vessel positions.
 *
 * This is the single entry point that aggregates all sub-computations
 * into the actionable intelligence operators need.
 */
export function computeImpactIntelligence(input: {
  event: EarthquakeEvent | null;
  grid: IntensityGrid | null;
  vessels: Vessel[];
  hazardFieldSource?: HazardFieldSource;
}): ImpactIntelligence {
  const { event, grid, vessels } = input;

  // No event selected — return empty intelligence
  if (!event) {
    return {
      peakIntensity: null,
      landPeakIntensity: null,
      populationExposure: null,
      areaStats: null,
      infraSummary: null,
      tsunamiSummary: null,
      tsunamiETAs: [],
      responseTimeline: [],
      hazardFieldSource: undefined,
    };
  }

  const hazardFieldSource = inferHazardFieldSource(event, input.hazardFieldSource);

  // Peak intensity and area stats require an intensity grid
  const peakIntensity = grid ? computePeakIntensity(grid) : null;
  const areaStats = grid
    ? {
        ...computeIntensityAreaStats(grid),
        hazardFieldSource,
      }
    : null;

  // Land peak intensity — max intensity at populated municipalities
  const landPeakIntensity = computeLandPeakIntensity(grid);

  // Population exposure — sampled from the same intensity truth used on the map.
  const populationExposure = computePopulationExposure(grid, hazardFieldSource);

  // Infrastructure impact is computed directly from the event + catalogs
  const infraSummary = computeInfraImpact(event, vessels);

  // Tsunami ETAs — only for events with tsunami risk
  const tsunamiSummary = computeTsunamiSummary(event);
  const tsunamiETAs = tsunamiSummary?.arrivalEstimatesMin ?? [];

  // Response protocol timeline
  const responseTimeline = computeResponseTimeline(event);

  return {
    peakIntensity,
    landPeakIntensity,
    populationExposure,
    areaStats,
    infraSummary,
    tsunamiSummary,
    tsunamiETAs,
    responseTimeline,
    hazardFieldSource,
  };
}
