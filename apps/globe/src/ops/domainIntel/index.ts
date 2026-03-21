/**
 * Domain Intelligence Engine — Per-asset-class actionable intelligence.
 *
 * Computes domain-specific actions, metrics, and smart rationale for each
 * infrastructure asset class affected by an earthquake. Dispatches to
 * per-class handlers based on fragility curve output and site intensity.
 *
 * All functions are pure — no DOM, no side effects, no framework dependencies.
 *
 * Action urgency levels follow Japan's emergency response doctrine:
 *   immediate  — act within minutes (life-safety or containment)
 *   within_1h  — act within first hour (prevent escalation)
 *   within_6h  — act before end-of-operational-day (logistics, assessment)
 *   monitor    — watch for change in status (no immediate action)
 */

import type { DamageProbs } from '../fragilityCurves';
import type { OpsAsset, DomainIntelligence } from '../types';
import type { DomainContext } from './types';

import { handleHospital, handleNuclearPlant, handleEvacuationSite } from './lifeSafety';
import { handleDam, handlePowerSubstation, handleWaterFacility, handleTelecomHub } from './infrastructure';
import { handleRailHub, handleAirport, handlePort } from './transport';
import { handleGovernmentEoc, handleLngTerminal, handleBuildingCluster } from './facilities';

/**
 * Compute domain-specific actionable intelligence for an infrastructure asset.
 *
 * Dispatches to a per-class handler which produces:
 *   - actions[]           — ordered by urgency (highest first)
 *   - nearestAlternative  — closest same-class asset still operational (if applicable)
 *   - metrics             — domain-specific key/value pairs for the operator panel
 *   - smartRationale      — human-readable summary replacing the generic rationale
 *
 * @param asset       — the OpsAsset being assessed
 * @param intensity   — sampled JMA intensity at the asset's location
 * @param probs       — fragility-curve damage state probabilities
 * @param context     — broader ops context (other assets, exposures, tsunami)
 */
export function computeDomainIntel(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
  context: DomainContext,
): DomainIntelligence {
  switch (asset.class) {
    case 'hospital':
      return handleHospital(asset, intensity, probs, context);
    case 'nuclear_plant':
      return handleNuclearPlant(asset, intensity, probs);
    case 'dam':
      return handleDam(asset, intensity, probs);
    case 'power_substation':
      return handlePowerSubstation(asset, intensity, probs, context);
    case 'rail_hub':
      return handleRailHub(asset, intensity, probs, context);
    case 'airport':
      return handleAirport(asset, intensity, probs, context);
    case 'port':
      return handlePort(asset, intensity, probs, context);
    case 'water_facility':
      return handleWaterFacility(asset, intensity, probs, context);
    case 'telecom_hub':
      return handleTelecomHub(asset, intensity, probs, context);
    case 'government_eoc':
      return handleGovernmentEoc(asset, intensity, probs, context);
    case 'evacuation_site':
      return handleEvacuationSite(asset, intensity, probs, context);
    case 'lng_terminal':
      return handleLngTerminal(asset, intensity, probs);
    case 'building_cluster':
      return handleBuildingCluster(asset, intensity, probs);
  }
}
