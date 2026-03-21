import type {
  OperatorBundleAvailability,
  OperatorBundleCounter,
  OperatorBundleDomain,
  OperatorBundleDomainOverrides,
  OperatorBundleDomainOverview,
  OperatorBundleId,
  OperatorBundleSignal,
  OperatorBundleTrust,
} from '../readModelTypes';
import type { OpsAsset, OpsAssetClass, OpsAssetExposure, OpsPriority, OpsRegion, OpsSeverity } from '../types';
import { getBundleAssetClasses, getOpsAssetClassDefinition, isOpsAssetClassModeled } from '../assetClassRegistry';
import { t, tf } from '../../i18n';

export function severityRank(severity: OpsSeverity): number {
  switch (severity) {
    case 'critical': return 3;
    case 'priority': return 2;
    case 'watch': return 1;
    case 'clear': return 0;
  }
}

export function maxSeverity(left: OpsSeverity, right: OpsSeverity): OpsSeverity {
  return severityRank(left) >= severityRank(right) ? left : right;
}

export function trustRank(trust: Exclude<OperatorBundleTrust, 'pending'>): number {
  switch (trust) {
    case 'degraded': return 2;
    case 'review': return 1;
    case 'confirmed': return 0;
  }
}

export function maxOperationalTrust(
  left: Exclude<OperatorBundleTrust, 'pending'>,
  right: Exclude<OperatorBundleTrust, 'pending'>,
): Exclude<OperatorBundleTrust, 'pending'> {
  return trustRank(left) >= trustRank(right) ? left : right;
}

export function capModeledTrust(
  trust: Exclude<OperatorBundleTrust, 'pending'>,
): Exclude<OperatorBundleTrust, 'pending'> {
  return trust === 'confirmed' ? 'review' : trust;
}

export function availabilityRank(availability: OperatorBundleAvailability): number {
  switch (availability) {
    case 'live': return 2;
    case 'modeled': return 1;
    case 'planned': return 0;
  }
}

export function formatRegion(region: OpsRegion | null): string {
  if (!region) {
    return 'Japan';
  }

  switch (region) {
    case 'hokkaido': return 'Hokkaido';
    case 'tohoku': return 'Tohoku';
    case 'kanto': return 'Kanto';
    case 'chubu': return 'Chubu';
    case 'kansai': return 'Kansai';
    case 'chugoku': return 'Chugoku';
    case 'shikoku': return 'Shikoku';
    case 'kyushu': return 'Kyushu';
    default: return region;
  }
}

export function getAssetMap(assets: OpsAsset[]): Map<string, OpsAsset> {
  return new Map(assets.map((asset) => [asset.id, asset]));
}

export function selectRelevantPriorities(
  priorities: OpsPriority[],
  assetMap: Map<string, OpsAsset>,
  classes: OpsAssetClass[],
): OpsPriority[] {
  return priorities.filter((priority) => {
    if (!priority.assetId) {
      return false;
    }

    const asset = assetMap.get(priority.assetId);
    return asset ? classes.includes(asset.class) : false;
  });
}

export function selectRelevantExposures(
  exposures: OpsAssetExposure[],
  assetMap: Map<string, OpsAsset>,
  classes: OpsAssetClass[],
): OpsAssetExposure[] {
  return exposures.filter((exposure) => {
    if (exposure.severity === 'clear') {
      return false;
    }

    const asset = assetMap.get(exposure.assetId);
    return asset ? classes.includes(asset.class) : false;
  });
}

export function countRelevantExposures(
  exposures: OpsAssetExposure[],
  assetMap: Map<string, OpsAsset>,
  classes: OpsAssetClass[],
): number {
  return exposures.filter((exposure) => {
    if (exposure.severity === 'clear') {
      return false;
    }

    const asset = assetMap.get(exposure.assetId);
    return asset ? classes.includes(asset.class) : false;
  }).length;
}

export function pickRegion(
  priorities: OpsPriority[],
  assetMap: Map<string, OpsAsset>,
): OpsRegion | null {
  const first = priorities.find((priority) => priority.assetId && assetMap.has(priority.assetId));
  return first?.assetId ? assetMap.get(first.assetId)?.region ?? null : null;
}

export function pickTopAssetClass(
  priorities: OpsPriority[],
  assetMap: Map<string, OpsAsset>,
): OpsAssetClass | null {
  const first = priorities.find((priority) => priority.assetId && assetMap.has(priority.assetId));
  return first?.assetId ? assetMap.get(first.assetId)?.class ?? null : null;
}

export interface BundleOverviewDefinition {
  bundleId: 'lifelines' | 'medical' | 'built-environment';
  classes: OpsAssetClass[];
  defaultMetricLabel: string;
  counterLabel: string;
  regionSignalId: string;
}

export function buildClassCounts(
  exposures: OpsAssetExposure[],
  assetMap: Map<string, OpsAsset>,
  classes: OpsAssetClass[],
): Map<OpsAssetClass, { count: number; tone: OpsSeverity }> {
  const allowed = new Set(classes);
  const counts = new Map<OpsAssetClass, { count: number; tone: OpsSeverity }>();

  for (const exposure of exposures) {
    if (exposure.severity === 'clear') continue;
    const asset = assetMap.get(exposure.assetId);
    if (!asset || !allowed.has(asset.class)) continue;

    const current = counts.get(asset.class);
    counts.set(asset.class, {
      count: (current?.count ?? 0) + 1,
      tone: current && severityRank(current.tone) > severityRank(exposure.severity)
        ? current.tone
        : exposure.severity,
    });
  }

  return counts;
}

export function buildFamilyCounters(
  classCounts: Map<OpsAssetClass, { count: number; tone: OpsSeverity }>,
): OperatorBundleCounter[] {
  if (classCounts.size <= 1) {
    return [];
  }

  return [...classCounts.entries()].map(([assetClass, value]) => {
    const definition = getOpsAssetClassDefinition(assetClass);
    return {
      id: definition.counterLabel.toLowerCase().replace(/\s+/g, '-'),
      label: definition.counterLabel,
      value: value.count,
      tone: value.tone,
    };
  });
}

export function buildCounter(
  id: string,
  label: string,
  value: number,
  tone: OpsSeverity,
): OperatorBundleCounter {
  return { id, label, value, tone };
}

export function buildSignal(
  id: string,
  label: string,
  value: string,
  tone: OpsSeverity,
): OperatorBundleSignal {
  return { id, label, value, tone };
}

export function buildModeledSourceSignal(): OperatorBundleSignal {
  return buildSignal('source', 'Source', 'Modeled from seismic exposure', 'watch');
}

export function mergeCounters(
  primary: OperatorBundleCounter[],
  secondary: OperatorBundleCounter[],
): OperatorBundleCounter[] {
  const merged: OperatorBundleCounter[] = [];
  const seen = new Set<string>();

  for (const counter of [...primary, ...secondary]) {
    if (seen.has(counter.id)) continue;
    seen.add(counter.id);
    merged.push(counter);
  }

  return merged;
}

export function mergeSignals(
  primary: OperatorBundleSignal[],
  secondary: OperatorBundleSignal[],
): OperatorBundleSignal[] {
  const merged: OperatorBundleSignal[] = [];
  const seen = new Set<string>();

  for (const signal of [...primary, ...secondary]) {
    if (seen.has(signal.id)) continue;
    seen.add(signal.id);
    merged.push(signal);
  }

  return merged;
}

export function sortDomainsBySeverity(domains: OperatorBundleDomain[]): OperatorBundleDomain[] {
  return domains
    .map((domain, index) => ({ domain, index }))
    .sort((left, right) =>
      severityRank(right.domain.severity) - severityRank(left.domain.severity) ||
      availabilityRank(right.domain.availability) - availabilityRank(left.domain.availability) ||
      left.index - right.index,
    )
    .map(({ domain }) => domain);
}

export function mergeLiveDomain(
  baseDomain: OperatorBundleDomain | undefined,
  liveDomain: OperatorBundleDomain,
): OperatorBundleDomain {
  if (!baseDomain) {
    return liveDomain;
  }

  const useLive = severityRank(liveDomain.severity) > severityRank(baseDomain.severity)
    || baseDomain.availability !== 'live'
    || baseDomain.severity === 'clear';
  const primary = useLive ? liveDomain : baseDomain;
  const secondary = useLive ? baseDomain : liveDomain;

  return {
    ...primary,
    severity: maxSeverity(baseDomain.severity, liveDomain.severity),
    availability: primary.availability,
    trust: liveDomain.trust,
    counters: mergeCounters(primary.counters, secondary.counters),
    signals: mergeSignals(primary.signals, secondary.signals),
  };
}

export function mergeAuthoritativeDomain(
  baseDomain: OperatorBundleDomain | undefined,
  overrideDomain: OperatorBundleDomain,
): OperatorBundleDomain {
  if (!baseDomain) {
    return overrideDomain;
  }

  return {
    ...overrideDomain,
    severity: maxSeverity(baseDomain.severity, overrideDomain.severity),
    counters: mergeCounters(overrideDomain.counters, baseDomain.counters),
    signals: mergeSignals(overrideDomain.signals, baseDomain.signals),
  };
}

export function shouldPromoteLiveSummary(
  baseOverview: OperatorBundleDomainOverview | undefined,
  domain: OperatorBundleDomain,
): boolean {
  if (!baseOverview) {
    return true;
  }

  if (baseOverview.severity === 'clear') {
    return true;
  }

  const domainSeverity = severityRank(domain.severity);
  const baseSeverity = severityRank(baseOverview.severity);
  if (domainSeverity > baseSeverity) {
    return true;
  }

  if (domainSeverity === baseSeverity) {
    return availabilityRank(domain.availability) > availabilityRank(baseOverview.availability);
  }

  return false;
}

export function withLiveLifelineDomain(input: {
  baseOverview: OperatorBundleDomainOverview | undefined;
  liveDomain: OperatorBundleDomain | undefined;
  trust: Exclude<OperatorBundleTrust, 'pending'>;
  summarySignal?: OperatorBundleSignal;
}): OperatorBundleDomainOverview | undefined {
  if (!input.liveDomain) {
    return input.baseOverview;
  }

  const baseDomains = input.baseOverview?.domains ?? [];
  const baseDomain = baseDomains.find((domain) => domain.id === input.liveDomain?.id);
  const mergedDomain = mergeLiveDomain(baseDomain, input.liveDomain);
  const otherDomains = baseDomains.filter((domain) => domain.id !== mergedDomain.id);
  const domains = sortDomainsBySeverity([mergedDomain, ...otherDomains]);

  if (shouldPromoteLiveSummary(input.baseOverview, mergedDomain)) {
    return {
      metric: mergedDomain.metric,
      detail: mergedDomain.detail,
      severity: mergedDomain.severity,
      availability: mergedDomain.availability,
      trust: mergedDomain.trust,
      counters: mergedDomain.counters,
      signals: mergedDomain.signals,
      domains,
    };
  }

  if (!input.baseOverview) {
    return undefined;
  }

  return {
    ...input.baseOverview,
    availability: input.baseOverview.availability,
    trust: input.baseOverview.trust === 'pending' ? input.trust : input.baseOverview.trust,
    signals: input.summarySignal
      ? mergeSignals(input.baseOverview.signals, [input.summarySignal])
      : input.baseOverview.signals,
    domains,
  };
}

export function withAuthoritativeLifelineDomain(input: {
  baseOverview: OperatorBundleDomainOverview | undefined;
  overrideDomain: OperatorBundleDomain | undefined;
  trust: Exclude<OperatorBundleTrust, 'pending'>;
  summarySignal?: OperatorBundleSignal;
}): OperatorBundleDomainOverview | undefined {
  if (!input.overrideDomain) {
    return input.baseOverview;
  }

  const baseDomains = input.baseOverview?.domains ?? [];
  const baseDomain = baseDomains.find((domain) => domain.id === input.overrideDomain?.id);
  const mergedDomain = mergeAuthoritativeDomain(baseDomain, input.overrideDomain);
  const otherDomains = baseDomains.filter((domain) => domain.id !== mergedDomain.id);
  const domains = sortDomainsBySeverity([mergedDomain, ...otherDomains]);

  if (shouldPromoteLiveSummary(input.baseOverview, mergedDomain)) {
    return {
      metric: mergedDomain.metric,
      detail: mergedDomain.detail,
      severity: mergedDomain.severity,
      availability: mergedDomain.availability,
      trust: mergedDomain.trust,
      counters: mergedDomain.counters,
      signals: mergedDomain.signals,
      domains,
    };
  }

  if (!input.baseOverview) {
    return undefined;
  }

  return {
    ...input.baseOverview,
    availability: input.baseOverview.availability,
    trust: input.baseOverview.trust === 'pending' ? input.trust : input.baseOverview.trust,
    signals: input.summarySignal
      ? mergeSignals(input.baseOverview.signals, [input.summarySignal])
      : input.baseOverview.signals,
    domains,
  };
}

export function buildOverrideOverview(
  domains: OperatorBundleDomain[] | undefined,
): OperatorBundleDomainOverview | undefined {
  if (!domains || domains.length === 0) {
    return undefined;
  }

  const ordered = sortDomainsBySeverity(domains);
  const primary = ordered[0];
  if (!primary) {
    return undefined;
  }

  return {
    metric: primary.metric,
    detail: primary.detail,
    severity: primary.severity,
    availability: primary.availability,
    trust: primary.trust,
    counters: primary.counters,
    signals: primary.signals,
    domains: ordered,
  };
}

export function filterScopedDomainOverrides(input: {
  domainOverrides?: OperatorBundleDomainOverrides;
  selectedEventId?: string | null;
}): OperatorBundleDomainOverrides {
  if (!input.domainOverrides) {
    return {};
  }

  const selectedEventId = input.selectedEventId ?? null;
  const next: OperatorBundleDomainOverrides = {};

  for (const bundleId of Object.keys(input.domainOverrides) as OperatorBundleId[]) {
    const domains = input.domainOverrides[bundleId]?.filter((domain) =>
      domain.eventId == null || domain.eventId === selectedEventId,
    ) ?? [];
    if (domains.length > 0) {
      next[bundleId] = domains;
    }
  }

  return next;
}

export function buildOverview(input: {
  bundleId: 'lifelines' | 'medical' | 'built-environment';
  priorities: OpsPriority[];
  exposures: OpsAssetExposure[];
  assets: OpsAsset[];
  classes: OpsAssetClass[];
  defaultMetricLabel: string;
  counterLabel: string;
  regionSignalId: string;
  trust: Exclude<OperatorBundleTrust, 'pending'>;
}): OperatorBundleDomainOverview | undefined {
  const assetMap = getAssetMap(input.assets);
  const relevantPriorities = selectRelevantPriorities(input.priorities, assetMap, input.classes);

  if (relevantPriorities.length === 0) {
    return undefined;
  }

  const topPriority = relevantPriorities
    .slice()
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))[0] ?? relevantPriorities[0];

  if (!topPriority) {
    return undefined;
  }

  const affectedCount = countRelevantExposures(input.exposures, assetMap, input.classes);
  const region = formatRegion(pickRegion(relevantPriorities, assetMap));
  const distinctClasses = new Set(
    relevantPriorities
      .map((priority) => priority.assetId ? assetMap.get(priority.assetId)?.class ?? null : null)
      .filter((assetClass): assetClass is OpsAssetClass => assetClass !== null),
  );
  const topClass = pickTopAssetClass(relevantPriorities, assetMap);
  const classCounts = buildClassCounts(input.exposures, assetMap, input.classes);
  const metricLabel = distinctClasses.size > 1 || topClass === null
    ? input.defaultMetricLabel
    : getOpsAssetClassDefinition(topClass).domainCheckLabel;
  const modeledTrust = topClass && isOpsAssetClassModeled(topClass)
    ? capModeledTrust(input.trust)
    : input.trust;
  const availability: OperatorBundleAvailability = topClass && isOpsAssetClassModeled(topClass)
    ? 'modeled'
    : 'live';
  const signals: OperatorBundleSignal[] = [
    ...(topClass && isOpsAssetClassModeled(topClass) ? [buildModeledSourceSignal()] : []),
    { id: 'next-check', label: t('overview.signal.nextCheck'), value: topPriority.title, tone: topPriority.severity },
    { id: input.regionSignalId, label: t('overview.signal.region'), value: region, tone: topPriority.severity },
  ];

  if (topClass) {
    signals.push({
      id: 'primary-domain',
      label: t('overview.signal.primaryDomain'),
      value: input.bundleId === 'built-environment'
        ? t('overview.signal.builtEnvironment')
        : getOpsAssetClassDefinition(topClass).familyLabel,
      tone: topPriority.severity,
    });
  }

  return {
    metric: tf('overview.metric.queued', { n: relevantPriorities.length, label: metricLabel }),
    detail: topPriority.title,
    severity: topPriority.severity,
    availability,
    trust: modeledTrust,
    counters: [
      { id: 'checks', label: t('overview.counter.checks'), value: relevantPriorities.length, tone: topPriority.severity },
      { id: input.counterLabel.toLowerCase().replace(/\s+/g, '-'), label: input.counterLabel, value: affectedCount, tone: topPriority.severity },
      ...buildFamilyCounters(classCounts),
    ],
    signals,
  };
}

export const BUNDLE_OVERVIEW_DEFINITIONS: BundleOverviewDefinition[] = [
  {
    bundleId: 'lifelines',
    classes: getBundleAssetClasses('lifelines'),
    defaultMetricLabel: t('overview.defaultMetric.lifeline'),
    counterLabel: t('overview.counterLabel.lifelineSites'),
    regionSignalId: 'lifeline-region',
  },
  {
    bundleId: 'medical',
    classes: getBundleAssetClasses('medical'),
    defaultMetricLabel: t('overview.defaultMetric.medical'),
    counterLabel: t('overview.counterLabel.sites'),
    regionSignalId: 'medical-region',
  },
  {
    bundleId: 'built-environment',
    classes: getBundleAssetClasses('built-environment'),
    defaultMetricLabel: t('overview.defaultMetric.builtEnv'),
    counterLabel: t('overview.counterLabel.buildingClusters'),
    regionSignalId: 'built-environment-region',
  },
];
