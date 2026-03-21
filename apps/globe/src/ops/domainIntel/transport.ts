/**
 * Transport domain handlers: Rail Hub, Airport, Port.
 *
 * Transport hubs where service continuity and passenger/cargo
 * diversion decisions are critical.
 */

import type { DamageProbs } from '../fragilityCurves';
import type { OpsAsset, DomainIntelligence, DomainAction } from '../types';
import { t } from '../../i18n';
import { getAssetDisplayName } from '../assetDisplayName';
import type { DomainContext } from './types';
import { action, topActionLabel } from './helpers';

// ── Rail Hub ─────────────────────────────────────────────────────────────────

export function handleRailHub(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
  ctx: DomainContext,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  const isShinkansen =
    asset.tags.includes('shinkansen') ||
    asset.name.toLowerCase().includes('shinkansen') ||
    (asset.nameJa ?? '').includes('新幹線');

  // UrEDAS auto-stop for Shinkansen
  if (intensity >= 3.0 && isShinkansen) {
    actions.push(action('immediate', 'domain.rail.autoStop'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('within_1h', 'domain.rail.trackInspection'));
  }
  if (intensity >= 4.0) {
    actions.push(action('within_1h', 'domain.rail.passengerEvac'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('within_6h', 'domain.rail.serviceResume'));
  }
  actions.push(action('monitor', 'domain.rail.statusMonitor'));

  const stopType =
    intensity >= 3.0 && isShinkansen ? 'auto'
    : intensity >= 4.0 ? 'manual'
    : 'normal';

  const lineType = isShinkansen ? 'shinkansen' : 'conventional';

  const nearestAlternative = ctx.findNearest(asset);

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.rail.statusMonitor');
  const smartRationale =
    `${name}: ${t(`domain.value.${stopType}`)} — ${topAction}`;

  return {
    actions,
    nearestAlternative,
    metrics: { stop_type: stopType, line_type: lineType },
    smartRationale,
  };
}

// ── Airport ──────────────────────────────────────────────────────────────────

export function handleAirport(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
  ctx: DomainContext,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  if (probs.pDamage >= 0.5) {
    actions.push(action('immediate', 'domain.airport.closure'));
  }
  if (intensity >= 4.0) {
    actions.push(action('within_1h', 'domain.airport.runwayInspect'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('within_1h', 'domain.airport.terminalCheck'));
  }
  if (intensity >= 4.0) {
    actions.push(action('within_1h', 'domain.airport.notam'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('within_6h', 'domain.airport.diversionPlan'));
  }

  const inspectionEst =
    probs.pDamage >= 0.15 ? '2-4h'
    : probs.pDisruption >= 0.5 ? '1-2h'
    : '<1h';

  const nearestAlternative = ctx.findNearest(asset);

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.airport.diversionPlan');
  const altPart = nearestAlternative
    ? `. ${t('domain.nearestAlt')}: ${nearestAlternative.name}`
    : '';
  const smartRationale =
    `${name}: ${t('domain.metric.inspectionEst')} ${inspectionEst} — ${topAction}${altPart}`;

  return {
    actions,
    nearestAlternative,
    metrics: { inspection_est: inspectionEst },
    smartRationale,
  };
}

// ── Port ─────────────────────────────────────────────────────────────────────

export function handlePort(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
  ctx: DomainContext,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  if (probs.pDamage >= 0.5) {
    actions.push(action('immediate', 'domain.port.closure'));
  }
  // Tsunami prep is highest immediate action when assessment exists
  if (ctx.tsunamiAssessment && ctx.tsunamiAssessment.risk !== 'none') {
    actions.push(action('immediate', 'domain.port.tsunamiPrep'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('within_1h', 'domain.port.quayInspect'));
  }
  if (intensity >= 4.2) {
    actions.push(action('within_1h', 'domain.port.liquefactionCheck'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('within_6h', 'domain.port.cargoDiversion'));
  }

  // De-duplicate: ensure tsunami prep appears first if both closure and tsunami
  const seen = new Set<string>();
  const deduped = actions.filter((a) => {
    if (seen.has(a.action)) return false;
    seen.add(a.action);
    return true;
  });
  actions.splice(0, actions.length, ...deduped);

  const portStatus =
    probs.pDamage >= 0.5 ? 'closed'
    : probs.pDisruption >= 0.5 ? 'restricted'
    : 'operational';

  const nearestAlternative = ctx.findNearest(asset);

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.port.cargoDiversion');
  const altPart = nearestAlternative
    ? `. ${t('domain.nearestAlt')}: ${nearestAlternative.name}`
    : '';
  const smartRationale =
    `${name}: ${t(`domain.value.${portStatus}`)} — ${topAction}${altPart}`;

  return {
    actions,
    nearestAlternative,
    metrics: { port_status: portStatus },
    smartRationale,
  };
}
