/**
 * Asset Exposure Module — Fragility-curve-based damage assessment.
 *
 * Replaces the previous ad-hoc linear scoring (score = intensity * weight + bonuses)
 * with empirically-grounded fragility curves (probit model). Each asset class has
 * calibrated damage state probabilities based on Japanese earthquake damage data.
 *
 * Pipeline: GMPE intensity grid → fragility curves → damage probabilities → severity
 *
 * Performance: Spatial pre-filter eliminates ~85% of assets (those outside the
 * intensity grid) from full computation. NearestAlternativeLookup amortizes
 * index construction across all domain intelligence queries.
 *
 * References:
 * - Si & Midorikawa (1999) — GMPE for intensity estimation
 * - Cabinet Office damage assessment methodology (2013) — damage matrices
 * - HAZUS-MH (FEMA, 2020) — multi-hazard combination
 * - See fragilityCurves.ts for per-class calibration sources
 */

import type { IntensityGrid, TsunamiAssessment } from '../types';
import { t, tf } from '../i18n';
import type { OpsAsset, OpsAssetClass, OpsAssetExposure } from './types';
import { getAssetDisplayName } from './assetDisplayName';
import { getOpsAssetClassDefinition } from './assetClassRegistry';
import {
  computeDamageProbs,
  combineTsunamiProbs,
  probsToSeverity,
  probsToScore,
  type DamageProbs,
} from './fragilityCurves';
import { computeDomainIntel } from './domainIntel';
import { NearestAlternativeLookup } from './nearestAlternative';

function sampleGrid(grid: IntensityGrid, lat: number, lng: number): number {
  const latMin = grid.center.lat - grid.radiusDeg;
  const lngRadiusDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadiusDeg;
  const latStep = (2 * grid.radiusDeg) / (grid.rows - 1);
  const lngStep = (2 * lngRadiusDeg) / (grid.cols - 1);

  const row = Math.round((lat - latMin) / latStep);
  const col = Math.round((lng - lngMin) / lngStep);

  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    return 0;
  }

  return grid.data[row * grid.cols + col];
}

/** Approximate distance in km between two points using flat-earth formula. */
function approxDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = (lat2 - lat1) * 111;
  const dlng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

/**
 * Distance decay factor for tsunami impact.
 * Full effect inside TSUNAMI_FULL_EFFECT_KM, linear taper to
 * TSUNAMI_RESIDUAL_FACTOR at TSUNAMI_TAPER_END_KM, residual beyond.
 *
 * Based on MLIT tsunami propagation modeling — coastal facilities within
 * 100km of epicenter receive full tsunami hazard; distant facilities
 * retain residual risk from reflected/trapped waves.
 */
// MLIT tsunami propagation distance thresholds (km).
const TSUNAMI_FULL_EFFECT_KM = 100;
const TSUNAMI_TAPER_END_KM = 300;
// Residual hazard factor for distant coastal facilities (reflected/trapped waves).
const TSUNAMI_RESIDUAL_FACTOR = 0.3;

function tsunamiDistanceDecay(distanceKm: number): number {
  if (distanceKm < TSUNAMI_FULL_EFFECT_KM) return 1.0;
  if (distanceKm > TSUNAMI_TAPER_END_KM) return TSUNAMI_RESIDUAL_FACTOR;
  const taperRange = TSUNAMI_TAPER_END_KM - TSUNAMI_FULL_EFFECT_KM;
  return 1.0 - (1.0 - TSUNAMI_RESIDUAL_FACTOR) * ((distanceKm - TSUNAMI_FULL_EFFECT_KM) / taperRange);
}

/**
 * Compute final damage probabilities including tsunami hazard combination.
 */
function computeAssetDamageProbs(
  asset: OpsAsset,
  intensity: number,
  tsunamiAssessment: TsunamiAssessment | null,
  grid: IntensityGrid,
): DamageProbs {
  const seismicProbs = computeDamageProbs(intensity, asset.class);

  if (!tsunamiAssessment || tsunamiAssessment.risk === 'none') {
    return seismicProbs;
  }

  const definition = getOpsAssetClassDefinition(asset.class);
  const isCoastalAsset = definition.tsunamiSensitive === true || asset.tags.includes('coastal');
  if (!isCoastalAsset) {
    return seismicProbs;
  }

  const distKm = approxDistanceKm(grid.center.lat, grid.center.lng, asset.lat, asset.lng);
  const decay = tsunamiDistanceDecay(distKm);
  return combineTsunamiProbs(seismicProbs, tsunamiAssessment.risk, decay);
}

/**
 * Build human-readable reasons from damage probabilities and operational concerns.
 */
function buildReasons(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
  tsunamiAssessment: TsunamiAssessment | null,
): string[] {
  const definition = getOpsAssetClassDefinition(asset.class);
  const reasons: string[] = [];

  const hasTsunami = (definition.tsunamiSensitive === true || asset.tags.includes('coastal'))
    && tsunamiAssessment && tsunamiAssessment.risk !== 'none';

  // All probabilities negligible
  if (probs.pDisruption < 0.01 && !hasTsunami) {
    return [t('exposure.reason.belowThreshold')];
  }

  // Damage-state-based descriptions
  if (probs.pCollapse >= 0.20) {
    reasons.push(t('exposure.reason.structuralFailure'));
  }
  if (probs.pDamage >= 0.50) {
    reasons.push(t('exposure.reason.significantDamage'));
  } else if (probs.pDamage >= 0.15) {
    reasons.push(t('exposure.reason.moderateDamage'));
  }
  if (probs.pDisruption >= 0.50) {
    reasons.push(t('exposure.reason.highDisruption'));
  } else if (probs.pDisruption >= 0.10) {
    reasons.push(t('exposure.reason.elevatedDisruption'));
  }

  // Tsunami posture
  if (hasTsunami) {
    reasons.push(tf('exposure.reason.tsunamiPosture', { risk: tsunamiAssessment!.risk }));
  }

  // Domain-specific operational concerns (keys resolved via i18n)
  for (const concern of definition.operationalConcerns) {
    if (intensity >= concern.minIntensity) {
      reasons.push(t(concern.reason));
    }
  }

  return reasons;
}

// ── Lifeline Interdependency ──────────────────────────────────────
//
// HAZUS-MH utility service interaction model (FEMA, 2020, Ch. 8):
// When utility services (power, water) are disrupted in a region,
// dependent facilities face compounded disruption probability.
//
// Cabinet Office (2013) identifies these cascading dependencies:
//   Hospital → power + water (medical equipment, sanitation)
//   Telecom  → power (backup generators have limited fuel)
//   Water    → power (pump stations)
//
// Dependency weight reflects the fraction of a facility's function
// that depends on the upstream utility being operational.

/** Asset classes that act as upstream utility providers. */
type LifelineProvider = 'power_substation' | 'water_facility';

/** Dependency weight: how much a downstream facility relies on the upstream utility. */
interface LifelineDependency {
  upstream: LifelineProvider;
  weight: number;
}

// Cabinet Office cascading failure analysis weights.
const LIFELINE_DEPENDENCIES: Partial<Record<OpsAssetClass, LifelineDependency[]>> = {
  hospital:       [{ upstream: 'power_substation', weight: 0.6 }, { upstream: 'water_facility', weight: 0.4 }],
  telecom_hub:    [{ upstream: 'power_substation', weight: 0.5 }],
  water_facility: [{ upstream: 'power_substation', weight: 0.3 }],
};

/**
 * Compute regional lifeline disruption levels.
 * Groups upstream utility assets by region and returns the maximum
 * damage probability per (region, provider) pair.
 */
function computeRegionalLifelineDisruption(
  assets: OpsAsset[],
  grid: IntensityGrid,
  tsunamiAssessment: TsunamiAssessment | null,
): Map<string, number> {
  const disruption = new Map<string, number>();
  const providers: Set<OpsAssetClass> = new Set(['power_substation', 'water_facility']);

  // Pre-compute grid bounds for spatial skip
  const latMin = grid.center.lat - grid.radiusDeg;
  const latMax = grid.center.lat + grid.radiusDeg;
  const lngRadiusDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadiusDeg;
  const lngMax = grid.center.lng + lngRadiusDeg;

  for (const asset of assets) {
    if (!providers.has(asset.class)) continue;
    // Spatial pre-filter: skip out-of-bounds utility assets
    if (asset.lat < latMin || asset.lat > latMax || asset.lng < lngMin || asset.lng > lngMax) continue;

    const intensity = sampleGrid(grid, asset.lat, asset.lng);
    if (intensity < 0.5) continue;

    const probs = computeAssetDamageProbs(asset, intensity, tsunamiAssessment, grid);
    // Use pDamage as the indicator: structural damage to a utility means
    // downstream facilities lose that service.
    const key = `${asset.region}:${asset.class}`;
    const current = disruption.get(key) ?? 0;
    if (probs.pDamage > current) {
      disruption.set(key, probs.pDamage);
    }
  }

  return disruption;
}

/**
 * Apply lifeline interdependency escalation to an asset's damage probabilities.
 * Uses independent failure combination: P_eff = 1 - (1 - P_base)(1 - P_cascade)
 * where P_cascade = sum(dependency_weight * upstream_pDamage) for the asset's region.
 *
 * Reference: HAZUS-MH Technical Manual Ch. 8, Utility Interaction Model.
 */
function applyLifelineEscalation(
  asset: OpsAsset,
  baseProbs: DamageProbs,
  regionalDisruption: Map<string, number>,
): { probs: DamageProbs; escalated: boolean } {
  const deps = LIFELINE_DEPENDENCIES[asset.class];
  if (!deps || deps.length === 0) {
    return { probs: baseProbs, escalated: false };
  }

  let cascadeDisruption = 0;
  for (const dep of deps) {
    const key = `${asset.region}:${dep.upstream}`;
    const upstreamDamage = regionalDisruption.get(key) ?? 0;
    cascadeDisruption += dep.weight * upstreamDamage;
  }

  // Clamp to [0, 1]
  cascadeDisruption = Math.min(cascadeDisruption, 1);

  if (cascadeDisruption < 0.05) {
    return { probs: baseProbs, escalated: false };
  }

  // Independent combination: effective = 1 - (1 - base)(1 - cascade)
  // Only escalate disruption — structural damage/collapse are intrinsic to the asset.
  return {
    probs: {
      pDisruption: 1 - (1 - baseProbs.pDisruption) * (1 - cascadeDisruption),
      pDamage: baseProbs.pDamage,
      pCollapse: baseProbs.pCollapse,
    },
    escalated: true,
  };
}

export function buildAssetExposures(input: {
  grid: IntensityGrid;
  assets: OpsAsset[];
  tsunamiAssessment: TsunamiAssessment | null;
}): OpsAssetExposure[] {
  const { grid, assets, tsunamiAssessment } = input;

  // ── Spatial pre-filter bounds ──────────────────────────────────────
  // Assets outside the intensity grid have intensity 0 → all probs 0 → severity 'clear'.
  // Skip them entirely: no fragility curves, no reasons, no string formatting.
  // Typically eliminates ~85% of 21K assets (only ~3K are within grid).
  const latMin = grid.center.lat - grid.radiusDeg;
  const latMax = grid.center.lat + grid.radiusDeg;
  const lngRadiusDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadiusDeg;
  const lngMax = grid.center.lng + lngRadiusDeg;

  // Phase 1: compute regional lifeline disruption levels for cascade analysis.
  const regionalDisruption = computeRegionalLifelineDisruption(assets, grid, tsunamiAssessment);

  // Phase 2: compute per-asset exposures with spatial pre-filter + lifeline cascade.
  const intensityCache = new Map<string, number>();
  const probsCache = new Map<string, DamageProbs>();
  const exposures: OpsAssetExposure[] = [];
  const assetById = new Map<string, OpsAsset>();

  for (const asset of assets) {
    assetById.set(asset.id, asset);

    // Fast bounds check — skip assets outside intensity grid entirely.
    // These are guaranteed intensity=0, all probs=0, severity='clear'.
    // Downstream code defaults missing exposures to 'clear'.
    if (asset.lat < latMin || asset.lat > latMax || asset.lng < lngMin || asset.lng > lngMax) {
      continue;
    }

    const intensity = sampleGrid(grid, asset.lat, asset.lng);

    // Sub-threshold intensity: at JMA <0.5, all fragility curves produce
    // negligible probabilities (~0). Skip full computation.
    if (intensity < 0.5) {
      continue;
    }

    // Full computation for assets with meaningful intensity
    const baseProbs = computeAssetDamageProbs(asset, intensity, tsunamiAssessment, grid);
    const { probs, escalated } = applyLifelineEscalation(asset, baseProbs, regionalDisruption);
    const severity = probsToSeverity(probs);
    const score = probsToScore(probs);
    const reasons = buildReasons(asset, intensity, probs, tsunamiAssessment);
    if (escalated) {
      reasons.push(t('exposure.reason.lifelineCascade'));
    }

    intensityCache.set(asset.id, intensity);
    probsCache.set(asset.id, probs);

    exposures.push({
      assetId: asset.id,
      severity,
      score: Math.round(score * 10) / 10,
      summary: tf('exposure.summary', { name: getAssetDisplayName(asset), severity: t(`severity.${severity}`) }),
      reasons,
      damageProbs: probs,
    });
  }

  // Phase 3: domain intelligence for non-clear assets (2nd pass).
  // NearestAlternativeLookup pre-builds by-class index + severity map ONCE,
  // eliminating O(n) Map construction per query (was 500 * Map(21K) = 10M+ ops).
  const altLookup = new NearestAlternativeLookup(assets, exposures);
  const domainContext = {
    findNearest: (target: OpsAsset) => altLookup.find(target),
    tsunamiAssessment,
  };

  for (const exp of exposures) {
    if (exp.severity === 'clear') continue;
    const asset = assetById.get(exp.assetId);
    if (!asset) continue;
    const intensity = intensityCache.get(asset.id) ?? 0;
    const probs = probsCache.get(asset.id);
    if (!probs) continue;

    exp.intensity = intensity;
    exp.domainIntel = computeDomainIntel(asset, intensity, probs, domainContext);
  }

  return exposures.sort((a, b) => b.score - a.score);
}
