import type {
  OperatorBundleAvailability,
  OperatorBundleCounter,
  OperatorBundleDomain,
  OperatorBundleDomainOverview,
  OperatorBundleSignal,
  OperatorBundleTrust,
  RealtimeComponentStatus,
} from '../readModelTypes';
import type { OpsAsset, OpsAssetClass, OpsAssetExposure, OpsPriority, OpsRegion, OpsSeverity } from '../types';
import { POWER_PLANTS } from '../powerCatalog';
import { assessPowerPlant, rankScramLikelihood, scramLikelihoodToSeverity } from '../powerAssessment';
import { estimateSiteIntensity } from '../siteIntensity';
import type { EarthquakeEvent, RailLineStatus, RailOperationStatus } from '../../types';
import { t, tf } from '../../i18n';
import {
  buildCounter,
  buildModeledSourceSignal,
  buildSignal,
  capModeledTrust,
  formatRegion,
  getAssetMap,
  maxOperationalTrust,
  maxSeverity,
  selectRelevantExposures,
  selectRelevantPriorities,
  severityRank,
  withLiveLifelineDomain,
  countRelevantExposures,
} from './shared';

// --- Rail ---

const RAIL_LINE_LABELS: Record<string, string> = {
  tokaido: 'Tokaido Shinkansen',
  sanyo: 'Sanyo Shinkansen',
  tohoku: 'Tohoku Shinkansen',
  hokkaido: 'Hokkaido Shinkansen',
  joetsu: 'Joetsu Shinkansen',
  hokuriku: 'Hokuriku Shinkansen',
  kyushu: 'Kyushu Shinkansen',
  'nishi-kyushu': 'Nishi-Kyushu Shinkansen',
};

function railStatusRank(status: RailOperationStatus): number {
  switch (status) {
    case 'suspended': return 4;
    case 'partial': return 3;
    case 'delayed': return 2;
    case 'unknown': return 1;
    case 'normal': return 0;
  }
}

function railStatusToSeverity(status: RailOperationStatus): OpsSeverity {
  switch (status) {
    case 'suspended': return 'critical';
    case 'partial': return 'priority';
    case 'delayed':
    case 'unknown':
      return 'watch';
    case 'normal':
      return 'clear';
  }
}

function formatRailLineLabel(lineId: string): string {
  return RAIL_LINE_LABELS[lineId] ?? lineId
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatRailStatusLabel(status: RailOperationStatus): string {
  switch (status) {
    case 'suspended': return t('rail.status.suspended');
    case 'partial': return t('rail.status.partial');
    case 'delayed': return t('rail.status.delayed');
    case 'unknown': return t('rail.status.pending');
    case 'normal': return t('rail.status.nominal');
  }
}

function summarizeRailNetworkState(statuses: RailLineStatus[]): string {
  if (statuses.some((status) => status.status === 'suspended')) {
    return t('rail.status.suspended');
  }
  if (statuses.some((status) => status.status === 'partial')) {
    return t('rail.status.partial');
  }
  if (statuses.some((status) => status.status === 'delayed')) {
    return t('rail.status.delayed');
  }
  if (statuses.some((status) => status.status === 'unknown')) {
    return t('rail.status.pending');
  }
  return t('rail.status.nominal');
}

function formatFeedSourceLabel(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    return t('rail.feed.defaultSource');
  }

  if (trimmed.length <= 4) {
    return trimmed.toUpperCase();
  }

  return trimmed
    .split(/[_\-\s]+/)
    .map((segment) => segment.length <= 4
      ? segment.toUpperCase()
      : segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function railComponentToSeverity(state: RealtimeComponentStatus['state']): OpsSeverity {
  switch (state) {
    case 'down': return 'critical';
    case 'degraded': return 'priority';
    case 'stale':
    case 'unknown':
      return 'watch';
    case 'live':
      return 'clear';
  }
}

function railComponentToTrust(state: RealtimeComponentStatus['state']): Exclude<OperatorBundleTrust, 'pending'> {
  switch (state) {
    case 'down':
    case 'degraded':
      return 'degraded';
    case 'stale':
    case 'unknown':
      return 'review';
    case 'live':
      return 'confirmed';
  }
}

function buildRailFeedValue(component: RealtimeComponentStatus | undefined): string {
  const source = formatFeedSourceLabel(component?.source ?? 'odpt');
  if (!component) {
    return tf('rail.feed.live', { source });
  }

  switch (component.state) {
    case 'stale': return tf('rail.feed.stale', { source });
    case 'degraded': return tf('rail.feed.degraded', { source });
    case 'down': return tf('rail.feed.down', { source });
    case 'unknown': return tf('rail.feed.unknown', { source });
    case 'live': return tf('rail.feed.live', { source });
  }
}

function buildRailFeedMessage(component: RealtimeComponentStatus, hasStatuses: boolean): string {
  if (component.message) {
    return component.message;
  }

  switch (component.state) {
    case 'stale':
      return hasStatuses
        ? t('rail.telemetry.staleWith')
        : t('rail.telemetry.staleWithout');
    case 'degraded':
      return hasStatuses
        ? t('rail.telemetry.degradedWith')
        : t('rail.telemetry.degradedWithout');
    case 'down':
      return hasStatuses
        ? t('rail.telemetry.downWith')
        : t('rail.telemetry.downWithout');
    case 'unknown':
      return hasStatuses
        ? t('rail.telemetry.unknownWith')
        : t('rail.telemetry.unknownWithout');
    case 'live':
      return '';
  }
}

function buildRailFeedOnlyDomain(
  component: RealtimeComponentStatus,
  trust: Exclude<OperatorBundleTrust, 'pending'>,
): OperatorBundleDomain {
  const severity = railComponentToSeverity(component.state);
  const effectiveTrust = maxOperationalTrust(trust, railComponentToTrust(component.state));

  return {
    id: 'rail',
    label: t('rail.label'),
    metric: component.state === 'down'
      ? t('rail.metric.down')
      : component.state === 'degraded'
        ? t('rail.metric.degraded')
        : component.state === 'unknown'
          ? t('rail.metric.pending')
          : t('rail.metric.stale'),
    detail: buildRailFeedMessage(component, false),
    severity,
    availability: 'live',
    trust: effectiveTrust,
    counters: [],
    signals: [
      buildSignal('rail-feed', t('rail.signal.feed'), buildRailFeedValue(component), severity),
    ],
  };
}

function buildRailDomain(
  statuses: RailLineStatus[],
  trust: Exclude<OperatorBundleTrust, 'pending'>,
  railComponent?: RealtimeComponentStatus,
): OperatorBundleDomain | undefined {
  if (statuses.length === 0) {
    return railComponent && railComponent.state !== 'live'
      ? buildRailFeedOnlyDomain(railComponent, trust)
      : undefined;
  }

  const suspendedCount = statuses.filter((status) => status.status === 'suspended').length;
  const partialCount = statuses.filter((status) => status.status === 'partial').length;
  const delayedCount = statuses.filter((status) => status.status === 'delayed').length;
  const unknownCount = statuses.filter((status) => status.status === 'unknown').length;
  const topStatus = statuses
    .slice()
    .sort((left, right) =>
      railStatusRank(right.status) - railStatusRank(left.status) ||
      right.updatedAt - left.updatedAt,
    )[0];

  if (!topStatus) {
    return undefined;
  }

  const operationalSeverity = railStatusToSeverity(topStatus.status);
  const feedSeverity = railComponent ? railComponentToSeverity(railComponent.state) : 'clear';
  const severity = maxSeverity(operationalSeverity, feedSeverity);
  const effectiveTrust = railComponent
    ? maxOperationalTrust(trust, railComponentToTrust(railComponent.state))
    : trust;
  const primaryLine = formatRailLineLabel(topStatus.lineId);
  const primaryStatus = formatRailStatusLabel(topStatus.status);

  let metric: string;
  let detail: string;

  if (suspendedCount > 0) {
    metric = tf('rail.metric.corridorsSuspended', { n: suspendedCount });
    detail = topStatus.cause
      ? tf('rail.detail.suspendedCause', { line: primaryLine, cause: topStatus.cause })
      : tf('rail.detail.suspended', { line: primaryLine });
  } else if (partialCount > 0) {
    metric = tf('rail.metric.corridorsPartial', { n: partialCount });
    detail = topStatus.cause
      ? tf('rail.detail.partialCause', { line: primaryLine, cause: topStatus.cause })
      : tf('rail.detail.partial', { line: primaryLine });
  } else if (delayedCount > 0) {
    metric = tf('rail.metric.corridorsDelayed', { n: delayedCount });
    detail = topStatus.cause
      ? tf('rail.detail.delayedCause', { line: primaryLine, cause: topStatus.cause })
      : tf('rail.detail.delayed', { line: primaryLine });
  } else if (unknownCount > 0) {
    metric = tf('rail.metric.corridorsPending', { n: unknownCount });
    detail = tf('rail.detail.pendingUpdate', { line: primaryLine });
  } else {
    metric = tf('rail.metric.corridorsNominal', { n: statuses.length });
    detail = t('rail.detail.nominal');
  }

  if (railComponent && railComponent.state !== 'live') {
    detail = `${detail} ${buildRailFeedMessage(railComponent, true)}`.trim();
  }

  const counters: OperatorBundleCounter[] = [
    buildCounter('rail-monitored', t('rail.counter.monitored'), statuses.length, 'clear'),
  ];

  if (suspendedCount > 0) {
    counters.push(buildCounter('rail-suspended', t('rail.counter.suspended'), suspendedCount, 'critical'));
  }
  if (partialCount > 0) {
    counters.push(buildCounter('rail-partial', t('rail.counter.partial'), partialCount, 'priority'));
  }
  if (delayedCount > 0) {
    counters.push(buildCounter('rail-delayed', t('rail.counter.delayed'), delayedCount, 'watch'));
  }
  if (unknownCount > 0) {
    counters.push(buildCounter('rail-pending', t('rail.counter.pending'), unknownCount, 'watch'));
  }

  const signals: OperatorBundleSignal[] = [
    buildSignal('rail-feed', t('rail.signal.feed'), buildRailFeedValue(railComponent), feedSeverity === 'clear' ? operationalSeverity : feedSeverity),
    buildSignal('rail-network-state', t('rail.signal.networkState'), summarizeRailNetworkState(statuses), severity),
    buildSignal('rail-primary-line', t('rail.signal.primaryCorridor'), primaryLine, severity),
  ];

  if (topStatus.cause) {
    signals.push(buildSignal('rail-cause', t('rail.signal.reportedCause'), topStatus.cause, severity));
  } else {
    signals.push(buildSignal('rail-primary-status', t('rail.signal.primaryStatus'), primaryStatus, severity));
  }

  return {
    id: 'rail',
    label: t('rail.label'),
    metric,
    detail,
    severity,
    availability: 'live',
    trust: effectiveTrust,
    counters,
    signals,
  };
}

export function withRailDomain(
  baseOverview: OperatorBundleDomainOverview | undefined,
  railStatuses: RailLineStatus[] | undefined,
  trust: Exclude<OperatorBundleTrust, 'pending'>,
  railComponent?: RealtimeComponentStatus,
): OperatorBundleDomainOverview | undefined {
  const railDomain = buildRailDomain(railStatuses ?? [], trust, railComponent);
  const effectiveTrust: Exclude<OperatorBundleTrust, 'pending'> =
    railDomain?.trust && railDomain.trust !== 'pending'
      ? railDomain.trust
      : trust;
  return withLiveLifelineDomain({
    baseOverview,
    liveDomain: railDomain,
    trust: effectiveTrust,
    summarySignal: railDomain
      ? railComponent && railComponent.state !== 'live'
        ? buildSignal('rail-feed', t('rail.signal.feed'), buildRailFeedValue(railComponent), railDomain.severity)
        : buildSignal('rail-network', t('rail.signal.network'), summarizeRailNetworkState(railStatuses ?? []), railDomain.severity)
      : undefined,
  });
}

// --- Power ---

function buildPowerDomain(input: {
  selectedEvent: EarthquakeEvent | null | undefined;
  priorities: OpsPriority[];
  exposures: OpsAssetExposure[];
  assets: OpsAsset[];
  trust: Exclude<OperatorBundleTrust, 'pending'>;
}): OperatorBundleDomain | undefined {
  const effectiveTrust = capModeledTrust(input.trust);
  const assetMap = getAssetMap(input.assets);
  const powerClasses: OpsAssetClass[] = ['power_substation'];
  const powerExposures = selectRelevantExposures(input.exposures, assetMap, powerClasses)
    .slice()
    .sort((left, right) =>
      severityRank(right.severity) - severityRank(left.severity) || right.score - left.score,
    );
  const powerPriorities = selectRelevantPriorities(input.priorities, assetMap, powerClasses)
    .slice()
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
  const topPowerPriority = powerPriorities[0];
  const topPowerExposure = powerExposures[0];
  const powerNodeCount = countRelevantExposures(input.exposures, assetMap, powerClasses);
  const powerNodeSeverity = topPowerPriority?.severity ?? topPowerExposure?.severity ?? 'clear';
  const powerNodeDetail = topPowerPriority?.title ?? topPowerExposure?.summary ?? null;
  const topPowerAsset = topPowerPriority?.assetId
    ? assetMap.get(topPowerPriority.assetId) ?? null
    : topPowerExposure
      ? assetMap.get(topPowerExposure.assetId) ?? null
      : null;

  const plantAssessments = input.selectedEvent
    ? POWER_PLANTS.map((plant) => ({
        plant,
        assessment: assessPowerPlant(plant, input.selectedEvent ?? null),
      }))
    : [];
  const scramLikely = plantAssessments.filter(({ plant, assessment }) =>
    plant.type === 'nuclear' && (assessment.scram === 'likely' || assessment.scram === 'certain'),
  );
  const scramPossible = plantAssessments.filter(({ plant, assessment }) =>
    plant.type === 'nuclear' && assessment.scram === 'possible',
  );
  const plantsInZone = plantAssessments.filter(({ assessment }) => assessment.inImpactZone);
  const topPlant = [...plantAssessments]
    .sort((left, right) =>
      rankScramLikelihood(right.assessment.scram) - rankScramLikelihood(left.assessment.scram) ||
      Number(right.assessment.inImpactZone) - Number(left.assessment.inImpactZone) ||
      right.assessment.pgaGal - left.assessment.pgaGal ||
      right.plant.capacityMw - left.plant.capacityMw,
    )[0];

  const plantSeverity = topPlant
    ? maxSeverity(
        scramLikelihoodToSeverity(topPlant.assessment.scram),
        topPlant.assessment.inImpactZone ? 'watch' : 'clear',
      )
    : 'clear';
  const severity = maxSeverity(powerNodeSeverity, plantSeverity);

  if (severity === 'clear' && powerNodeCount === 0 && plantsInZone.length === 0) {
    return undefined;
  }

  let metric: string;
  let detail: string;

  if (scramLikely.length > 0 && topPlant) {
    metric = scramLikely.length === 1
      ? tf('power.metric.scramLikely', { n: scramLikely.length })
      : tf('power.metric.scramRisks', { n: scramLikely.length });
    detail = tf('power.detail.nearScram', { plant: topPlant.plant.nameEn, pga: Math.round(topPlant.assessment.pgaGal) });
  } else if (scramPossible.length > 0 && topPlant) {
    metric = tf('power.metric.siteReview', { n: scramPossible.length });
    detail = tf('power.detail.gridVerify', { plant: topPlant.plant.nameEn, intensity: topPlant.assessment.intensity.toFixed(1) });
  } else if (powerNodeCount > 0 && powerNodeDetail) {
    metric = tf('power.metric.nodesElevated', { n: powerNodeCount });
    detail = powerNodeDetail;
  } else if (plantsInZone.length > 0 && topPlant) {
    metric = tf('power.metric.sitesInZone', { n: plantsInZone.length });
    detail = tf('power.detail.continuity', { plant: topPlant.plant.nameEn });
  } else {
    return undefined;
  }

  const counters: OperatorBundleCounter[] = [];
  if (powerNodeCount > 0) {
    counters.push(buildCounter('power-nodes', t('power.counter.nodes'), powerNodeCount, powerNodeSeverity));
  }
  if (scramLikely.length > 0) {
    counters.push(buildCounter('scram-likely', t('power.counter.scramLikely'), scramLikely.length, 'critical'));
  }
  if (scramPossible.length > 0) {
    counters.push(buildCounter('scram-review', t('power.counter.scramReview'), scramPossible.length, 'priority'));
  }
  if (plantsInZone.length > 0) {
    counters.push(buildCounter('plants-in-zone', t('power.counter.plantsInZone'), plantsInZone.length, plantSeverity));
  }

  const signals: OperatorBundleSignal[] = [];
  signals.push(buildModeledSourceSignal());
  if (topPlant) {
    signals.push(buildSignal('primary-plant', t('power.signal.primaryPlant'), topPlant.plant.nameEn, plantSeverity));
    signals.push(buildSignal('power-region', t('power.signal.region'), formatRegion(topPlant.plant.region as OpsRegion), plantSeverity));
    if (topPlant.assessment.pgaGal > 0) {
      signals.push(buildSignal('estimated-pga', t('power.signal.pga'), `~${Math.round(topPlant.assessment.pgaGal)} gal`, plantSeverity));
    }
  }
  if (topPowerAsset) {
    signals.push(buildSignal('grid-node', t('power.signal.gridNode'), topPowerAsset.name, powerNodeSeverity));
  }

  // Nuclear SCRAM assessments use physics-based PGA estimation, not generic
  // fragility exposure — treat as 'live' to ensure promotion over generic summaries.
  const availability: OperatorBundleAvailability = scramLikely.length > 0 || scramPossible.length > 0
    ? 'live'
    : 'modeled';

  return {
    id: 'power',
    label: t('power.label'),
    metric,
    detail,
    severity,
    availability,
    trust: effectiveTrust,
    counters,
    signals,
  };
}

export function withPowerDomain(input: {
  baseOverview: OperatorBundleDomainOverview | undefined;
  selectedEvent: EarthquakeEvent | null | undefined;
  priorities: OpsPriority[];
  exposures: OpsAssetExposure[];
  assets: OpsAsset[];
  trust: Exclude<OperatorBundleTrust, 'pending'>;
}): OperatorBundleDomainOverview | undefined {
  const powerDomain = buildPowerDomain({
    selectedEvent: input.selectedEvent,
    priorities: input.priorities,
    exposures: input.exposures,
    assets: input.assets,
    trust: input.trust,
  });

  return withLiveLifelineDomain({
    baseOverview: input.baseOverview,
    liveDomain: powerDomain,
    trust: input.trust,
    summarySignal: powerDomain
      ? buildSignal('power-posture', t('power.signal.posture'), powerDomain.metric, powerDomain.severity)
      : undefined,
  });
}

// --- Water ---

function waterIntensityToSeverity(intensity: number): OpsSeverity {
  if (intensity >= 5.5) {
    return 'critical';
  }
  if (intensity >= 4.5) {
    return 'priority';
  }
  if (intensity >= 3.5) {
    return 'watch';
  }
  return 'clear';
}

function formatWaterPosture(severity: OpsSeverity): string {
  switch (severity) {
    case 'critical': return t('water.posture.outageRisk');
    case 'priority': return t('water.posture.continuityReview');
    case 'watch': return t('water.posture.verification');
    case 'clear': return t('water.posture.nominal');
  }
}

function buildWaterDomain(input: {
  selectedEvent: EarthquakeEvent | null | undefined;
  priorities: OpsPriority[];
  exposures: OpsAssetExposure[];
  assets: OpsAsset[];
  trust: Exclude<OperatorBundleTrust, 'pending'>;
}): OperatorBundleDomain | undefined {
  const effectiveTrust = capModeledTrust(input.trust);
  const assetMap = getAssetMap(input.assets);
  const waterClasses: OpsAssetClass[] = ['water_facility'];
  const waterExposures = selectRelevantExposures(input.exposures, assetMap, waterClasses)
    .slice()
    .sort((left, right) =>
      severityRank(right.severity) - severityRank(left.severity) || right.score - left.score,
    );
  const waterPriorities = selectRelevantPriorities(input.priorities, assetMap, waterClasses)
    .slice()
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
  const topWaterPriority = waterPriorities[0];
  const topWaterExposure = waterExposures[0];
  const selectedEvent = input.selectedEvent ?? null;
  const assessedWaterSites = selectedEvent
    ? input.assets
      .filter((asset) => asset.class === 'water_facility')
      .map((asset) => {
        const intensity = estimateSiteIntensity(selectedEvent, asset.lat, asset.lng);
        return {
          asset,
          intensity,
          severity: waterIntensityToSeverity(intensity),
        };
      })
      .filter((assessment) => assessment.severity !== 'clear')
      .sort((left, right) =>
        severityRank(right.severity) - severityRank(left.severity) || right.intensity - left.intensity,
      )
    : [];
  const criticalSites = assessedWaterSites.filter((assessment) => assessment.severity === 'critical');
  const reviewSites = assessedWaterSites.filter((assessment) => assessment.severity === 'priority');
  const verificationSites = assessedWaterSites.filter((assessment) => assessment.severity === 'watch');
  const topWaterAssessment = assessedWaterSites[0];
  const waterSiteCount = Math.max(waterExposures.length, assessedWaterSites.length);
  const waterSeverity = topWaterPriority?.severity
    ?? topWaterExposure?.severity
    ?? topWaterAssessment?.severity
    ?? 'clear';
  const waterDetail = topWaterPriority?.title ?? topWaterExposure?.summary ?? null;
  const topWaterAsset = topWaterAssessment?.asset
    ?? (topWaterPriority?.assetId
      ? assetMap.get(topWaterPriority.assetId) ?? null
      : topWaterExposure
        ? assetMap.get(topWaterExposure.assetId) ?? null
        : null);

  if (waterSeverity === 'clear' && waterSiteCount === 0) {
    return undefined;
  }

  let metric: string;
  let detail: string;

  if (criticalSites.length > 0 && topWaterAssessment) {
    metric = tf('water.metric.outageRisk', { n: criticalSites.length });
    detail = tf('water.detail.outageRisk', { site: topWaterAssessment.asset.name, intensity: topWaterAssessment.intensity.toFixed(1) });
  } else if (reviewSites.length > 0 && topWaterAssessment) {
    metric = tf('water.metric.continuityReview', { n: reviewSites.length });
    detail = tf('water.detail.continuityReview', { site: topWaterAssessment.asset.name, intensity: topWaterAssessment.intensity.toFixed(1) });
  } else if (waterSiteCount > 0 && waterDetail) {
    metric = tf('water.metric.elevated', { n: waterSiteCount });
    detail = waterDetail;
  } else if (verificationSites.length > 0 && topWaterAssessment) {
    metric = tf('water.metric.verification', { n: verificationSites.length });
    detail = tf('water.detail.verification', { site: topWaterAssessment.asset.name });
  } else {
    return undefined;
  }

  const counters: OperatorBundleCounter[] = [];
  if (waterSiteCount > 0) {
    counters.push(buildCounter('water-sites', t('water.counter.sites'), waterSiteCount, waterSeverity));
  }
  if (criticalSites.length > 0) {
    counters.push(buildCounter('water-outage-risk', t('water.counter.outageRisk'), criticalSites.length, 'critical'));
  }
  if (reviewSites.length > 0) {
    counters.push(buildCounter('water-review', t('water.counter.review'), reviewSites.length, 'priority'));
  }
  if (verificationSites.length > 0) {
    counters.push(buildCounter('water-verify', t('water.counter.verify'), verificationSites.length, 'watch'));
  }

  const signals: OperatorBundleSignal[] = [];
  signals.push(buildModeledSourceSignal());
  if (topWaterAsset) {
    signals.push(buildSignal('primary-facility', t('water.signal.primaryFacility'), topWaterAsset.name, waterSeverity));
    signals.push(buildSignal('water-region', t('water.signal.region'), formatRegion(topWaterAsset.region), waterSeverity));
  }
  if (topWaterAssessment) {
    signals.push(buildSignal('estimated-intensity', t('water.signal.intensity'), `JMA ${topWaterAssessment.intensity.toFixed(1)}`, topWaterAssessment.severity));
    signals.push(buildSignal('network-posture', t('water.signal.posture'), formatWaterPosture(topWaterAssessment.severity), topWaterAssessment.severity));
  }

  return {
    id: 'water',
    label: t('water.label'),
    metric,
    detail,
    severity: waterSeverity,
    availability: 'modeled',
    trust: effectiveTrust,
    counters,
    signals,
  };
}

export function withWaterDomain(input: {
  baseOverview: OperatorBundleDomainOverview | undefined;
  selectedEvent: EarthquakeEvent | null | undefined;
  priorities: OpsPriority[];
  exposures: OpsAssetExposure[];
  assets: OpsAsset[];
  trust: Exclude<OperatorBundleTrust, 'pending'>;
}): OperatorBundleDomainOverview | undefined {
  const waterDomain = buildWaterDomain({
    selectedEvent: input.selectedEvent,
    priorities: input.priorities,
    exposures: input.exposures,
    assets: input.assets,
    trust: input.trust,
  });

  return withLiveLifelineDomain({
    baseOverview: input.baseOverview,
    liveDomain: waterDomain,
    trust: input.trust,
    summarySignal: waterDomain
      ? buildSignal('water-posture', t('water.signal.waterPosture'), waterDomain.metric, waterDomain.severity)
      : undefined,
  });
}
