/**
 * Life-safety domain handlers: Hospital, Nuclear Plant, Evacuation Site.
 *
 * These asset classes have direct life-safety implications requiring
 * the most urgent and specific operator actions.
 */

import type { DamageProbs } from '../fragilityCurves';
import type { OpsAsset, DomainIntelligence, DomainAction } from '../types';
import { t } from '../../i18n';
import { getAssetDisplayName } from '../assetDisplayName';
import type { DomainContext } from './types';
import { action, topActionLabel } from './helpers';

// ── Hospital ─────────────────────────────────────────────────────────────────

export function handleHospital(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
  ctx: DomainContext,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  if (probs.pDamage >= 0.5 || probs.pCollapse >= 0.2) {
    actions.push(action('immediate', 'domain.hospital.patientTransfer'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('within_1h', 'domain.hospital.surgeryHalt'));
  }
  if (probs.pDisruption >= 0.5) {
    actions.push(action('within_1h', 'domain.hospital.emergencyPower'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('within_6h', 'domain.hospital.dmatStandby'));
  }
  if (intensity >= 4.0) {
    actions.push(action('monitor', 'domain.hospital.accessRoute'));
  }

  const posture =
    probs.pDamage >= 0.5 ? 'compromised'
    : probs.pDisruption >= 0.5 ? 'disrupted'
    : probs.pDisruption >= 0.1 ? 'degraded'
    : 'operational';

  const nearestAlternative = ctx.findNearest(asset);

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.hospital.accessRoute');
  const altPart = nearestAlternative
    ? ` ${t('domain.nearestAlt')}: ${nearestAlternative.name} (${nearestAlternative.distanceKm.toFixed(0)}km)`
    : '';
  const smartRationale = `${name}: ${t(`domain.value.${posture}`)} — ${topAction}.${altPart}`;

  return {
    actions,
    nearestAlternative,
    metrics: { posture },
    smartRationale,
  };
}

// ── Nuclear Plant ────────────────────────────────────────────────────────────

export function handleNuclearPlant(
  asset: OpsAsset,
  intensity: number,
  probs: DamageProbs,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  const isOperating = asset.tags.includes('operating');
  const isSuspended =
    asset.tags.includes('suspended') || asset.tags.includes('decommissioning');

  // NRA auto-SCRAM threshold
  if (intensity >= 3.5) {
    actions.push(action('immediate', 'domain.nuclear.scramVerify'));
  }
  if (intensity >= 5.0) {
    actions.push(action('immediate', 'domain.nuclear.spentFuelPool'));
  }
  if (intensity >= 5.8) {
    actions.push(action('immediate', 'domain.nuclear.beyondDesignBasis'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('immediate', 'domain.nuclear.coolingVerify'));
  }
  if (intensity >= 3.5) {
    actions.push(action('within_1h', 'domain.nuclear.upzNotify'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('within_6h', 'domain.nuclear.nraReport'));
  }

  // Escalate / de-escalate based on plant operating status
  if (isOperating && actions.length > 0 && actions[0].urgency !== 'immediate') {
    actions[0] = { ...actions[0], urgency: 'immediate' };
  }
  if (isSuspended) {
    const spentFuelKeys = new Set([
      'domain.nuclear.spentFuelPool',
      'domain.nuclear.scramVerify',
      'domain.nuclear.nraReport',
    ]);
    actions.splice(
      0,
      actions.length,
      ...actions.filter((a) => spentFuelKeys.has(a.action)),
    );
    if (actions.length > 0) {
      actions[0] = { ...actions[0], urgency: 'within_1h' };
    }
  }

  // PGA approximation: JMA intensity definition inversion
  const pgaGal = Math.round(Math.pow(10, (intensity - 0.94) / 2));

  const scramLikelihood =
    intensity >= 4.0 ? 'likely'
    : intensity >= 3.5 ? 'possible'
    : 'unlikely';

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.nuclear.nraReport');
  const smartRationale =
    `${name}: SCRAM ${scramLikelihood} at JMA ${intensity.toFixed(1)}. ${topAction}.`;

  return {
    actions,
    nearestAlternative: null,
    metrics: {
      pga_gal: pgaGal,
      scram_likelihood: scramLikelihood,
    },
    smartRationale,
  };
}

// ── Evacuation Site ──────────────────────────────────────────────────────────

export function handleEvacuationSite(
  asset: OpsAsset,
  _intensity: number,
  probs: DamageProbs,
  ctx: DomainContext,
): DomainIntelligence {
  const actions: DomainAction[] = [];

  if (probs.pDamage >= 0.5) {
    actions.push(action('immediate', 'domain.evac.doNotOpen'));
  }
  if (probs.pDamage >= 0.15) {
    actions.push(action('within_1h', 'domain.evac.safetyCheck'));
  }
  if (probs.pDisruption >= 0.5) {
    actions.push(action('within_1h', 'domain.evac.limitedCapacity'));
  }
  if (probs.pDisruption >= 0.1) {
    actions.push(action('within_6h', 'domain.evac.prepareOpen'));
  }
  actions.push(action('monitor', 'domain.evac.standbyReady'));

  const usability =
    probs.pDamage >= 0.5 ? 'unsafe'
    : probs.pDamage >= 0.15 ? 'inspect-first'
    : probs.pDisruption >= 0.5 ? 'limited'
    : 'ready';

  const nearestAlternative = ctx.findNearest(asset);

  const name = getAssetDisplayName(asset);
  const topAction = topActionLabel(actions, 'domain.evac.standbyReady');
  const usabilityKey = usability === 'inspect-first' ? 'inspectFirst' : usability;
  const altPart = nearestAlternative
    ? `. ${t('domain.nearestAlt')}: ${nearestAlternative.name}`
    : '';
  const smartRationale =
    `${name}: ${t(`domain.value.${usabilityKey}`)} — ${topAction}${altPart}`;

  return {
    actions,
    nearestAlternative,
    metrics: { usability },
    smartRationale,
  };
}
