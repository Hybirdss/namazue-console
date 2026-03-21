/**
 * Infrastructure domain handlers: Dam, Power Substation, Water Facility, Telecom Hub.
 *
 * Utility infrastructure whose failure cascades into service disruption
 * across wide areas.
 */

import type { DamageProbs } from '../fragilityCurves';
import type { OpsAsset, DomainIntelligence, DomainAction } from '../types';
import { t } from '../../i18n';
import { getAssetDisplayName } from '../assetDisplayName';
import type { DomainContext } from './types';
import { action, topActionLabel } from './helpers';

// ── Dam ──────────────────────────────────────────────────────────────────────

export function handleDam(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  if (probs.pCollapse >= 0.2) {
    actions.push(action('immediate', 'domain.dam.downstreamEvac'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('immediate', 'domain.dam.bodyInspection'));
  }
  if (probs.pDisruption >= 0.5) {
    actions.push(action('within_1h', 'domain.dam.spillwayCheck'));
  }
  if (intensity >= 4.0) {
    actions.push(action('within_6h', 'domain.dam.reservoirLevel'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('monitor', 'domain.dam.seepageMonitor'));
  }

  const downstreamRisk =
    probs.pCollapse >= 0.2 ? 'evacuation'
    : probs.pDamage >= 0.15 ? 'alert'
    : 'monitoring';

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.dam.seepageMonitor');
  const smartRationale = `${name}: ${t(`domain.value.${downstreamRisk}`)} — ${topAction}`;

  return {
    actions,
    nearestAlternative: null,
    metrics: { downstream_risk: downstreamRisk },
    smartRationale,
  };
}

// ── Power Substation ─────────────────────────────────────────────────────────

export function handlePowerSubstation(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
  ctx: DomainContext,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  if (probs.pDamage >= 0.5) {
    actions.push(action('immediate', 'domain.power.gridIsolation'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('within_1h', 'domain.power.transformerInspect'));
  }
  if (probs.pDisruption >= 0.5) {
    actions.push(action('within_1h', 'domain.power.loadShedding'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('within_6h', 'domain.power.backupActivation'));
  }
  if (intensity >= 4.0) {
    actions.push(action('monitor', 'domain.power.gridMonitor'));
  }

  const outageRisk =
    probs.pDamage >= 0.5 ? 'blackout'
    : probs.pDisruption >= 0.5 ? 'partial'
    : 'stable';

  const nearestAlternative = ctx.findNearest(asset);

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.power.gridMonitor');
  const altPart = nearestAlternative ? `. ${t('domain.nearestAlt')}: ${nearestAlternative.name}` : '';
  const smartRationale =
    `${name}: ${t(`domain.value.${outageRisk}`)} — ${topAction}${altPart}`;

  return {
    actions,
    nearestAlternative,
    metrics: { outage_risk: outageRisk },
    smartRationale,
  };
}

// ── Water Facility ───────────────────────────────────────────────────────────

export function handleWaterFacility(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
  ctx: DomainContext,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  if (probs.pDamage >= 0.5) {
    actions.push(action('immediate', 'domain.water.shutoff'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('within_1h', 'domain.water.pipelineCheck'));
  }
  if (probs.pDisruption >= 0.5) {
    actions.push(action('within_1h', 'domain.water.turbidityMonitor'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('within_6h', 'domain.water.truckDispatch'));
  }
  if (intensity >= 4.0) {
    actions.push(action('monitor', 'domain.water.pressureMonitor'));
  }

  const serviceStatus =
    probs.pDamage >= 0.5 ? 'outage'
    : probs.pDisruption >= 0.5 ? 'disrupted'
    : 'operational';

  const nearestAlternative = ctx.findNearest(asset);

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.water.pressureMonitor');
  const smartRationale =
    `${name}: ${t(`domain.value.${serviceStatus}`)} — ${topAction}`;

  return {
    actions,
    nearestAlternative,
    metrics: { service_status: serviceStatus },
    smartRationale,
  };
}

// ── Telecom Hub ──────────────────────────────────────────────────────────────

export function handleTelecomHub(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
  ctx: DomainContext,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  if (probs.pDamage >= 0.5) {
    actions.push(action('immediate', 'domain.telecom.mobileBts'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('within_1h', 'domain.telecom.equipmentCheck'));
  }
  if (probs.pDisruption >= 0.5) {
    actions.push(action('within_1h', 'domain.telecom.batteryVerify'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('within_6h', 'domain.telecom.disasterBoard'));
  }
  if (intensity >= 4.0) {
    actions.push(action('monitor', 'domain.telecom.trafficMonitor'));
  }

  const commsStatus =
    probs.pDamage >= 0.5 ? 'down'
    : probs.pDisruption >= 0.5 ? 'degraded'
    : 'operational';

  const backupHours =
    commsStatus === 'down' ? '<4h'
    : commsStatus === 'degraded' ? '4-8h'
    : '8';

  const nearestAlternative = ctx.findNearest(asset);

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.telecom.trafficMonitor');
  const smartRationale =
    `${name}: ${t(`domain.value.${commsStatus}`)} — ${topAction}`;

  return {
    actions,
    nearestAlternative,
    metrics: { comms_status: commsStatus, backup_hours: backupHours },
    smartRationale,
  };
}
