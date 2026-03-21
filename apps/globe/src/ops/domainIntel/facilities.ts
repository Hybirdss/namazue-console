/**
 * Facility domain handlers: Government EOC, LNG Terminal, Building Cluster.
 *
 * Facilities that serve as coordination hubs, hazardous material sites,
 * or represent aggregate structural risk.
 */

import type { DamageProbs } from '../fragilityCurves';
import type { OpsAsset, DomainIntelligence, DomainAction } from '../types';
import { t } from '../../i18n';
import { getAssetDisplayName } from '../assetDisplayName';
import type { DomainContext } from './types';
import { action, topActionLabel } from './helpers';

// ── Government EOC ───────────────────────────────────────────────────────────

export function handleGovernmentEoc(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
  ctx: DomainContext,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  if (intensity >= 6.0) {
    actions.push(action('immediate', 'domain.eoc.hqActivation'));
  }
  if (intensity >= 5.0) {
    actions.push(action('within_1h', 'domain.eoc.alertMode'));
  }
  if (intensity >= 4.0) {
    actions.push(action('within_6h', 'domain.eoc.infoGathering'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('immediate', 'domain.eoc.alternateActivate'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('monitor', 'domain.eoc.commsCheck'));
  }

  const activationLevel =
    intensity >= 6.0 ? 'L3'
    : intensity >= 5.0 ? 'L2'
    : intensity >= 4.0 ? 'L1'
    : 'standby';

  const nearestAlternative = ctx.findNearest(asset);

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.eoc.commsCheck');
  const smartRationale =
    `${name}: ${t('domain.metric.activationLevel')} ${activationLevel} — ${topAction}`;

  return {
    actions,
    nearestAlternative,
    metrics: { activation_level: activationLevel },
    smartRationale,
  };
}

// ── LNG Terminal ─────────────────────────────────────────────────────────────

export function handleLngTerminal(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  if (probs.pDamage >= 0.5) {
    actions.push(action('immediate', 'domain.lng.emergencyShutdown'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('immediate', 'domain.lng.pipelineIsolate'));
  }
  if (probs.pDisruption >= 0.5) {
    actions.push(action('within_1h', 'domain.lng.fireWatch'));
  }
  if (intensity >= 4.0) {
    actions.push(action('within_1h', 'domain.lng.gasDetection'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('within_6h', 'domain.lng.supplyAssess'));
  }

  const containment =
    probs.pDamage >= 0.5 ? 'emergency'
    : probs.pDamage >= 0.15 ? 'isolated'
    : 'monitoring';

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.lng.supplyAssess');
  const smartRationale =
    `${name}: ${t(`domain.value.${containment}`)} — ${topAction}`;

  return {
    actions,
    nearestAlternative: null,
    metrics: { containment },
    smartRationale,
  };
}

// ── Building Cluster ─────────────────────────────────────────────────────────

export function handleBuildingCluster(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  if (probs.pCollapse >= 0.2) {
    actions.push(action('immediate', 'domain.building.rescueStandby'));
  }
  if (probs.pDamage >= 0.5) {
    actions.push(action('immediate', 'domain.building.entryRestrict'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('within_1h', 'domain.building.rapidAssessment'));
  }
  if (intensity >= 5.5) {
    actions.push(action('within_1h', 'domain.building.glassHazard'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('within_6h', 'domain.building.inspectionTeam'));
  }

  const damageLevel =
    probs.pCollapse >= 0.2 ? 'severe'
    : probs.pDamage >= 0.5 ? 'significant'
    : probs.pDamage >= 0.15 ? 'moderate'
    : 'minor';

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.building.inspectionTeam');
  const smartRationale =
    `${name}: ${t(`domain.value.${damageLevel}`)} — ${topAction}`;

  return {
    actions,
    nearestAlternative: null,
    metrics: { damage_level: damageLevel },
    smartRationale,
  };
}
