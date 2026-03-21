/**
 * Fragility Curve Module — Evidence-based infrastructure damage assessment.
 *
 * Uses probit (normal CDF) fragility functions to compute damage state
 * exceedance probabilities from JMA seismic intensity. This is the standard
 * approach used in Japanese earthquake damage assessment.
 *
 * Fragility parameters are calibrated against empirical damage data from:
 * - 1995 Kobe (M7.3, max JMA 7): lifeline disruption rates, building damage
 * - 2004 Niigata-Chuetsu (M6.8, max JMA 7): dam/slope failures
 * - 2011 Tohoku (M9.0, max JMA 7): nuclear, port, lifeline damage
 * - 2016 Kumamoto (M7.3, max JMA 7): hospital/water/building damage
 * - 2024 Noto (M7.6, max JMA 7): rural infrastructure damage
 *
 * References:
 * - Cabinet Office (2013) "Shutochokka Jishin no Higai Sotei" damage matrices
 * - Cabinet Office (2012) "Nankai Trough Kyodai Jishin" damage estimates
 * - NRA: New Regulatory Requirements (Ss seismic design basis)
 * - MLIT: Port/rail/airport facility design standards
 * - METI: High-pressure gas / power grid facility standards
 * - JSCE: Dam seismic assessment guidelines
 * - HAZUS-MH Technical Manual (FEMA, 2020) — multi-hazard combination
 */

import type { OpsAssetClass, OpsSeverity } from './types';

// ── Types ────────────────────────────────────────────────────────

/** Damage state probabilities for a given intensity. */
export interface DamageProbs {
  /** P(operational disruption) — inspection/service interruption needed */
  pDisruption: number;
  /** P(significant damage) — major structural/functional impairment */
  pDamage: number;
  /** P(severe/collapse) — loss of function, potential structural failure */
  pCollapse: number;
}

/** Fragility parameters for one damage state. */
interface FragilityParams {
  /** Median JMA intensity for 50% exceedance probability */
  mu: number;
  /** Standard deviation (dispersion) in JMA intensity units */
  beta: number;
}

/** Fragility curve set defining three damage states. */
export interface AssetFragility {
  disruption: FragilityParams;
  damage: FragilityParams;
  collapse: FragilityParams;
}

// ── Normal CDF ───────────────────────────────────────────────────

/**
 * Standard normal CDF approximation.
 * Abramowitz & Stegun (1964) rational approximation, eq. 26.2.17.
 * Maximum absolute error: |epsilon| < 7.5 x 10^-8.
 *
 * We use normal CDF (probit model) rather than lognormal because
 * JMA intensity is already on a quasi-logarithmic scale — it represents
 * log-transformed ground motion.
 */
// Abramowitz & Stegun (1964) eq. 26.2.17 rational polynomial coefficients.
const AS_P = 0.2316419;
const AS_B1 = 0.319381530;
const AS_B2 = -0.356563782;
const AS_B3 = 1.781477937;
const AS_B4 = -1.453152027;
const AS_B5 = 1.061405429;
const INV_SQRT_2PI = 0.3989422804014327; // 1 / sqrt(2 * pi)

function normalCDF(x: number): number {
  if (x < -10) return 0;
  if (x > 10) return 1;

  const a = Math.abs(x);
  const t = 1 / (1 + AS_P * a);
  const prob = INV_SQRT_2PI * Math.exp(-0.5 * a * a)
    * (t * (AS_B1
      + t * (AS_B2
        + t * (AS_B3
          + t * (AS_B4
            + t * AS_B5)))));

  return x >= 0 ? 1 - prob : prob;
}

/** Compute exceedance probability for a single damage state. */
function exceedanceProb(intensity: number, params: FragilityParams): number {
  return normalCDF((intensity - params.mu) / params.beta);
}

// ── Fragility Parameters ─────────────────────────────────────────
//
// Each asset class has three damage states with (mu, beta) pairs.
// mu = median JMA intensity at which 50% of similar facilities
//      historically experienced that damage level.
// beta = dispersion reflecting variability in construction quality,
//        site conditions, and damage observation.
//
// Lower mu = more fragile at that damage state.
// Lower beta = sharper transition (more deterministic).

const FRAGILITY_TABLE: Record<OpsAssetClass, AssetFragility> = {
  // Nuclear: NRA auto-SCRAM at ~120 gal (JMA ~4). Inspection protocol starts JMA 3.
  // Beyond-design-basis events at JMA ~6. Core damage territory at JMA ~7.
  // Reference: NRA New Regulatory Requirements, Fukushima Daiichi analysis.
  // Disruption = regulatory inspection/status check (low threshold by law).
  nuclear_plant: {
    disruption: { mu: 3.0, beta: 0.6 },
    damage:     { mu: 5.8, beta: 0.4 },
    collapse:   { mu: 6.8, beta: 0.3 },
  },

  // Dam: JSCE seismic assessment guidelines.
  // Dam safety inspection triggered at moderate shaking (JMA 3.5+).
  // 2004 Chuetsu: Yamakoshi landslide dam failures at JMA 6+.
  dam: {
    disruption: { mu: 3.8, beta: 0.6 },
    damage:     { mu: 5.8, beta: 0.4 },
    collapse:   { mu: 6.8, beta: 0.35 },
  },

  // LNG Terminal: METI high-pressure gas facility standards.
  // Auto isolation valve check at JMA 3.5+. Pipeline walk-down at JMA 4+.
  // 2011 Tohoku: Sendai/Chiba LNG facilities — pipeline damage at JMA 5+.
  lng_terminal: {
    disruption: { mu: 3.5, beta: 0.6 },
    damage:     { mu: 5.5, beta: 0.45 },
    collapse:   { mu: 6.5, beta: 0.35 },
  },

  // Port: MLIT port facility design standards.
  // Harbor inspection/vessel movement restriction at JMA 3.5+.
  // 1995 Kobe port: total quay collapse at JMA 7.
  port: {
    disruption: { mu: 3.5, beta: 0.6 },
    damage:     { mu: 5.3, beta: 0.5 },
    collapse:   { mu: 6.3, beta: 0.45 },
  },

  // Airport: MLIT aviation facility standards.
  // Runway inspection required at JMA 3.5+. Temporary closure at JMA 4+.
  // 2011 Tohoku: Sendai Airport — runway damage and flooding at JMA 6.
  airport: {
    disruption: { mu: 3.5, beta: 0.6 },
    damage:     { mu: 5.5, beta: 0.45 },
    collapse:   { mu: 6.5, beta: 0.4 },
  },

  // Power substation: METI grid facility standards.
  // Grid inspection/protection relay check at JMA 3.5+.
  // 1995 Kobe: 260万 outages at JMA 6-7. 2016 Kumamoto: 47.6万 outages.
  power_substation: {
    disruption: { mu: 3.5, beta: 0.6 },
    damage:     { mu: 5.3, beta: 0.45 },
    collapse:   { mu: 6.3, beta: 0.4 },
  },

  // Rail hub: MLIT railway structure design standards.
  // UrEDAS auto-stop at ~40 gal (JMA ~3). Track inspection at JMA 3+.
  // Shinkansen emergency brake at JMA 3+. Speed restriction JMA 2.5+.
  // 1995 Kobe: elevated rail collapse at JMA 7.
  rail_hub: {
    disruption: { mu: 3.0, beta: 0.6 },
    damage:     { mu: 5.2, beta: 0.45 },
    collapse:   { mu: 6.3, beta: 0.4 },
  },

  // Hospital: MHLW medical facility seismic guidelines.
  // Equipment safety check at JMA 3.5+. Elevator inspection at JMA 4+.
  // 2016 Kumamoto: Kumamoto City Hospital lost function at JMA 6+.
  hospital: {
    disruption: { mu: 3.8, beta: 0.6 },
    damage:     { mu: 5.5, beta: 0.45 },
    collapse:   { mu: 6.5, beta: 0.4 },
  },

  // Water facility: MHLW water supply seismic standards.
  // Pipeline pressure check at JMA 3.5+. Turbidity monitoring at JMA 3+.
  // Cabinet Office: JMA 5+: ~3%, JMA 6-: ~10%, JMA 6+: ~30%, JMA 7: ~60%.
  water_facility: {
    disruption: { mu: 3.5, beta: 0.6 },
    damage:     { mu: 5.5, beta: 0.45 },
    collapse:   { mu: 6.5, beta: 0.4 },
  },

  // Telecom hub: MIC telecommunications facility standards.
  // Equipment rack check at JMA 3.5+. Battery backup verification.
  telecom_hub: {
    disruption: { mu: 3.5, beta: 0.6 },
    damage:     { mu: 5.5, beta: 0.45 },
    collapse:   { mu: 6.5, beta: 0.4 },
  },

  // Building cluster: Cabinet Office damage matrices (mixed 木造/非木造).
  // Structural inspection trigger at JMA 4.5+.
  // JMA 6-: ~5% partially damaged. JMA 6+: ~20% destroyed. JMA 7: ~60%.
  building_cluster: {
    disruption: { mu: 4.5, beta: 0.6 },
    damage:     { mu: 5.8, beta: 0.5 },
    collapse:   { mu: 6.5, beta: 0.45 },
  },

  // Government EOC: Seismically hardened (disaster management function).
  // Activation protocol at JMA 3.5+. Full disaster HQ at JMA 5+.
  government_eoc: {
    disruption: { mu: 3.8, beta: 0.6 },
    damage:     { mu: 5.8, beta: 0.4 },
    collapse:   { mu: 6.8, beta: 0.35 },
  },

  // Evacuation site: Schools, community centers — mixed construction quality.
  // Safety inspection at JMA 4.5+. May need to close if damage suspected.
  evacuation_site: {
    disruption: { mu: 4.5, beta: 0.6 },
    damage:     { mu: 5.8, beta: 0.5 },
    collapse:   { mu: 6.5, beta: 0.45 },
  },
};

// ── Tsunami Damage Probabilities ─────────────────────────────────
//
// Tsunami damage depends on inundation depth. Risk levels from the
// JMA/MLIT tsunami warning system correspond to expected wave heights:
//   high    = expected inundation >= 3m (major/great tsunami warning)
//   moderate = expected inundation 1-3m (tsunami warning)
//   low     = expected inundation < 1m (tsunami advisory)
//
// Damage probabilities are derived from MLIT tsunami damage curves
// (Suppasri et al., 2013) and Cabinet Office Nankai Trough estimates.

const TSUNAMI_DAMAGE_PROBS: Record<'high' | 'moderate' | 'low', DamageProbs> = {
  high:     { pDisruption: 0.70, pDamage: 0.45, pCollapse: 0.20 },
  moderate: { pDisruption: 0.35, pDamage: 0.15, pCollapse: 0.05 },
  low:      { pDisruption: 0.10, pDamage: 0.03, pCollapse: 0.01 },
};

// ── Public API ───────────────────────────────────────────────────

/**
 * Compute damage state probabilities from JMA intensity.
 * Uses probit (normal CDF) fragility curves calibrated per asset class.
 */
export function computeDamageProbs(intensity: number, assetClass: OpsAssetClass): DamageProbs {
  const fragility = FRAGILITY_TABLE[assetClass];
  return {
    pDisruption: exceedanceProb(intensity, fragility.disruption),
    pDamage: exceedanceProb(intensity, fragility.damage),
    pCollapse: exceedanceProb(intensity, fragility.collapse),
  };
}

/**
 * Combine seismic and tsunami damage probabilities.
 * Uses independent hazard combination: P_combined = 1 - (1 - P_eq)(1 - P_ts)
 *
 * Reference: HAZUS-MH Multi-Hazard Loss Estimation Methodology (FEMA, 2020).
 *
 * @param distanceDecay — decay factor (0-1) based on distance from epicenter.
 */
export function combineTsunamiProbs(
  seismic: DamageProbs,
  tsunamiRisk: 'high' | 'moderate' | 'low',
  distanceDecay: number,
): DamageProbs {
  const tsunami = TSUNAMI_DAMAGE_PROBS[tsunamiRisk];
  return {
    pDisruption: 1 - (1 - seismic.pDisruption) * (1 - tsunami.pDisruption * distanceDecay),
    pDamage: 1 - (1 - seismic.pDamage) * (1 - tsunami.pDamage * distanceDecay),
    pCollapse: 1 - (1 - seismic.pCollapse) * (1 - tsunami.pCollapse * distanceDecay),
  };
}

/**
 * Map damage probabilities to operational severity.
 *
 * Decision thresholds follow emergency management practice
 * (Cabinet Office disaster response doctrine):
 * - Critical: >= 50% chance of significant damage OR >= 20% collapse risk
 * - Priority: >= 50% chance of disruption OR >= 15% damage risk
 * - Watch:    >= 10% chance of operational disruption
 * - Clear:    all probabilities below thresholds
 */
// Severity decision thresholds (Cabinet Office disaster response doctrine).
// Critical: significant structural damage likely or measurable collapse risk.
// Priority: operational disruption likely or moderate damage risk.
// Watch: detectable chance of any disruption to operations.
const CRITICAL_DAMAGE = 0.50;
const CRITICAL_COLLAPSE = 0.20;
const PRIORITY_DISRUPTION = 0.50;
const PRIORITY_DAMAGE = 0.15;
const WATCH_DISRUPTION = 0.10;

export function probsToSeverity(probs: DamageProbs): OpsSeverity {
  if (probs.pDamage >= CRITICAL_DAMAGE || probs.pCollapse >= CRITICAL_COLLAPSE) return 'critical';
  if (probs.pDisruption >= PRIORITY_DISRUPTION || probs.pDamage >= PRIORITY_DAMAGE) return 'priority';
  if (probs.pDisruption >= WATCH_DISRUPTION) return 'watch';
  return 'clear';
}

/**
 * Convert damage probabilities to a 0-100 composite score.
 *
 * Score = 30 * P(disruption) + 40 * P(damage) + 30 * P(collapse)
 *
 * Weighted to emphasize significant damage as the primary operational
 * concern. The 30/40/30 weighting reflects that:
 * - Disruption drives immediate response (30%)
 * - Structural damage determines recovery timeline (40%)
 * - Collapse risk determines life-safety urgency (30%)
 */
// Composite score weights: disruption (immediate response), damage (recovery
// timeline), collapse (life-safety urgency). Sums to 100.
const W_DISRUPTION = 30;
const W_DAMAGE = 40;
const W_COLLAPSE = 30;

export function probsToScore(probs: DamageProbs): number {
  return W_DISRUPTION * probs.pDisruption + W_DAMAGE * probs.pDamage + W_COLLAPSE * probs.pCollapse;
}

/** Get fragility parameters for an asset class. */
export function getFragilityParams(assetClass: OpsAssetClass): AssetFragility {
  return FRAGILITY_TABLE[assetClass];
}
