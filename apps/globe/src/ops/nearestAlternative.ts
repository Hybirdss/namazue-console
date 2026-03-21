/**
 * Nearest Operational Alternative — finds the closest same-class asset
 * that is still operational when a given asset is compromised.
 *
 * Operational = severity is 'clear' or 'watch'.
 * Uses flat-earth approximation (sufficient for <2,000 km ranges).
 */

import type { OpsAsset, OpsAssetClass, OpsAssetExposure, NearestAlternative, OpsSeverity } from './types';
import { getAssetDisplayName } from './assetDisplayName';

const OPERATIONAL: ReadonlySet<OpsSeverity> = new Set(['clear', 'watch']);

/** Approximate distance in km using flat-earth formula. */
function approxDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = (lat2 - lat1) * 111;
  const dlng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

/** Bearing from point 1 to point 2 in degrees (0=N, 90=E, 180=S, 270=W). */
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = lat2 - lat1;
  const dlng = (lng2 - lng1) * Math.cos((lat1 * Math.PI) / 180);
  const rad = Math.atan2(dlng, dlat);
  return ((rad * 180) / Math.PI + 360) % 360;
}

/**
 * Pre-built spatial index for nearest-alternative lookups.
 *
 * Amortizes O(n) index construction across all queries — without this,
 * each findNearestAlternative call rebuilds a Map(21K) + scans 21K assets.
 * With 500 non-clear assets, that's 500 * 21K = 10M+ wasted iterations.
 *
 * This class builds once:
 *   - byClass: Map<class, asset[]> for same-class filtering
 *   - severityMap: Map<assetId, severity> for operational check
 * Then each .find() only scans the ~1-7K same-class candidates.
 */
export class NearestAlternativeLookup {
  private readonly byClass: Map<OpsAssetClass, OpsAsset[]>;
  private readonly severityMap: Map<string, OpsSeverity>;

  constructor(allAssets: OpsAsset[], exposures: OpsAssetExposure[]) {
    // Group assets by class — O(n) once
    this.byClass = new Map();
    for (const asset of allAssets) {
      let list = this.byClass.get(asset.class);
      if (!list) {
        list = [];
        this.byClass.set(asset.class, list);
      }
      list.push(asset);
    }

    // Build severity lookup — O(n) once
    // Assets missing from exposures default to 'clear' (out-of-bounds = operational)
    this.severityMap = new Map();
    for (const exp of exposures) {
      this.severityMap.set(exp.assetId, exp.severity);
    }
  }

  /**
   * Find the nearest same-class operational asset.
   * Scans only candidates of the same class (~1-7K) instead of all 21K.
   */
  find(target: OpsAsset): NearestAlternative | null {
    const candidates = this.byClass.get(target.class);
    if (!candidates) return null;

    let bestAsset: OpsAsset | null = null;
    let bestDist = Infinity;

    for (const candidate of candidates) {
      if (candidate.id === target.id) continue;
      const severity = this.severityMap.get(candidate.id) ?? 'clear';
      if (!OPERATIONAL.has(severity)) continue;

      const dist = approxDistanceKm(target.lat, target.lng, candidate.lat, candidate.lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestAsset = candidate;
      }
    }

    if (!bestAsset) return null;

    return {
      assetId: bestAsset.id,
      name: getAssetDisplayName(bestAsset),
      distanceKm: Math.round(bestDist * 10) / 10,
      bearing: Math.round(bearing(target.lat, target.lng, bestAsset.lat, bestAsset.lng)),
      severity: this.severityMap.get(bestAsset.id) ?? 'clear',
    };
  }
}
