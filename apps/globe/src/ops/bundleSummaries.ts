import type { EarthquakeEvent } from '../types';
import { t, tf } from '../i18n';
import type {
  OperatorBundleAvailability,
  OperatorBundleDomain,
  OperatorBundleDomainOverview,
  OperatorBundleDomainOverviews,
  OperatorBundleId,
  OperationalOverview,
  OperatorBundleCounter,
  OperatorBundleSignal,
  OperatorBundleSummary,
  OperatorBundleSummaries,
  OperatorBundleTrust,
} from './readModelTypes';
import type { OpsAsset, OpsAssetClass, OpsAssetExposure, OpsSeverity } from './types';
import { getBundleAssetClasses, getOpsAssetClassDefinition, isOpsAssetClassModeled } from './assetClassRegistry';
import { severityRank, formatRegion } from './severityUtils';

export interface MaritimeTelemetryOverview {
  totalTracked: number;
  highPriorityTracked: number;
  underwayCount: number;
  anchoredCount: number;
  summary: string;
}

interface BuildOperatorBundleSummariesInput {
  selectedEvent: EarthquakeEvent | null;
  assets: OpsAsset[];
  exposures: OpsAssetExposure[];
  operationalOverview: OperationalOverview;
  maritimeOverview?: MaritimeTelemetryOverview | null;
  domainOverviews?: OperatorBundleDomainOverviews;
  trustLevel?: Exclude<OperatorBundleTrust, 'pending'>;
}

function summarizeClassExposure(
  assetClass: OpsAssetClass,
  assets: OpsAsset[],
  exposures: OpsAssetExposure[],
): {
  count: number;
  topSeverity: OpsSeverity;
  topAssets: OpsAsset[];
} {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const matching: Array<{ entry: OpsAssetExposure; asset: OpsAsset }> = [];

  for (const entry of exposures) {
    if (entry.severity === 'clear') continue;
    const asset = assetById.get(entry.assetId);
    if (!asset || asset.class !== assetClass) continue;
    matching.push({ entry, asset });
  }

  matching
    .sort((left, right) =>
      severityRank(right.entry.severity) - severityRank(left.entry.severity) ||
      right.entry.score - left.entry.score,
    );

  return {
    count: matching.length,
    topSeverity: matching[0]?.entry.severity ?? 'clear',
    topAssets: matching.slice(0, 2).map((entry) => entry.asset),
  };
}

function summarizeBundleExposure(
  bundleId: Extract<OperatorBundleId, 'lifelines' | 'medical' | 'built-environment'>,
  assets: OpsAsset[],
  exposures: OpsAssetExposure[],
): {
  count: number;
  topSeverity: OpsSeverity;
  topAssets: OpsAsset[];
} {
  const classes = new Set(getBundleAssetClasses(bundleId));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const matching: Array<{ entry: OpsAssetExposure; asset: OpsAsset }> = [];

  for (const entry of exposures) {
    if (entry.severity === 'clear') continue;
    const asset = assetById.get(entry.assetId);
    if (!asset || !classes.has(asset.class)) continue;
    matching.push({ entry, asset });
  }

  matching
    .sort((left, right) =>
      severityRank(right.entry.severity) - severityRank(left.entry.severity) ||
      right.entry.score - left.entry.score,
    );

  return {
    count: matching.length,
    topSeverity: matching[0]?.entry.severity ?? 'clear',
    topAssets: matching.slice(0, 2).map((entry) => entry.asset),
  };
}

function summarizeBundleFamilies(
  bundleId: Extract<OperatorBundleId, 'lifelines' | 'medical' | 'built-environment'>,
  assets: OpsAsset[],
  exposures: OpsAssetExposure[],
): Array<{ assetClass: OpsAssetClass; count: number; tone: OpsSeverity; topAssets: OpsAsset[] }> {
  const classes = new Set(getBundleAssetClasses(bundleId));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const grouped = new Map<OpsAssetClass, { count: number; tone: OpsSeverity; assets: OpsAsset[] }>();

  for (const entry of exposures) {
    if (entry.severity === 'clear') continue;
    const asset = assetById.get(entry.assetId);
    if (!asset || !classes.has(asset.class)) continue;

    const current = grouped.get(asset.class);
    const existingAssets = current?.assets ?? [];
    grouped.set(asset.class, {
      count: (current?.count ?? 0) + 1,
      tone: current && severityRank(current.tone) > severityRank(entry.severity)
        ? current.tone
        : entry.severity,
      assets: existingAssets.some((candidate) => candidate.id === asset.id)
        ? existingAssets
        : [...existingAssets, asset],
    });
  }

  return [...grouped.entries()].map(([assetClass, value]) => ({
    assetClass,
    count: value.count,
    tone: value.tone,
    topAssets: value.assets.slice(0, 2),
  }));
}

function availabilityRank(availability: OperatorBundleAvailability): number {
  switch (availability) {
    case 'live': return 2;
    case 'modeled': return 1;
    case 'planned': return 0;
  }
}

function resolveBundleTrust(
  availability: OperatorBundleAvailability,
  trustLevel: Exclude<OperatorBundleTrust, 'pending'> | undefined,
): OperatorBundleTrust {
  if (availability === 'planned') {
    return 'pending';
  }

  if (availability === 'modeled') {
    return resolveModeledTrust(trustLevel);
  }

  return trustLevel ?? 'confirmed';
}

function resolveModeledTrust(
  trustLevel: Exclude<OperatorBundleTrust, 'pending'> | undefined,
): OperatorBundleTrust {
  const trust = trustLevel ?? 'confirmed';
  return trust === 'confirmed' ? 'review' : trust;
}

function buildCounter(
  id: string,
  label: string,
  value: number,
  tone: OpsSeverity,
): OperatorBundleCounter {
  return { id, label, value, tone };
}

function buildSignal(
  id: string,
  label: string,
  value: string,
  tone: OpsSeverity,
): OperatorBundleSignal {
  return { id, label, value, tone };
}

function buildBundleFamilyCounters(
  families: Array<{ assetClass: OpsAssetClass; count: number; tone: OpsSeverity }>,
): OperatorBundleCounter[] {
  if (families.length <= 1) {
    return [];
  }

  return families.map((family) => {
    const definition = getOpsAssetClassDefinition(family.assetClass);
    return buildCounter(
      definition.counterLabel.toLowerCase().replace(/\s+/g, '-'),
      definition.counterLabel,
      family.count,
      family.tone,
    );
  });
}

function buildBundleDomainMixSignal(
  families: Array<{ assetClass: OpsAssetClass; count: number; tone: OpsSeverity; topAssets: OpsAsset[] }>,
  tone: OpsSeverity,
): OperatorBundleSignal[] {
  if (families.length <= 1) {
    return [];
  }

  return [
    buildSignal(
      'domain-mix',
      t('bundle.signal.domainMix'),
      families.map((family) => getOpsAssetClassDefinition(family.assetClass).familyLabel).join(' + '),
      tone,
    ),
  ];
}

function buildBundleDomains(
  families: Array<{ assetClass: OpsAssetClass; count: number; tone: OpsSeverity; topAssets: OpsAsset[] }>,
  trust: OperatorBundleTrust,
): OperatorBundleDomain[] {
  return families.map((family) => {
    const definition = getOpsAssetClassDefinition(family.assetClass);
    const focusAssets = joinAssetNames(family.topAssets);
    const availability: OperatorBundleAvailability = isOpsAssetClassModeled(family.assetClass)
      ? 'modeled'
      : 'live';
    const domainTrust = availability === 'modeled' && trust === 'confirmed'
      ? 'review'
      : trust;
    return {
      id: definition.domainId,
      label: definition.familyLabel,
      metric: tf('bundle.metric.exposed', { n: family.count, type: definition.exposureMetricLabel }),
      detail: tf('bundle.detail.requiresVerification', { assets: focusAssets }),
      severity: family.tone,
      availability,
      trust: domainTrust,
      counters: [
        buildCounter(
          definition.counterLabel.toLowerCase().replace(/\s+/g, '-'),
          definition.counterLabel,
          family.count,
          family.tone,
        ),
      ],
      signals: [
        buildSignal('focus-assets', t('bundle.signal.focusAssets'), focusAssets, family.tone),
      ],
    };
  });
}

function resolveFamilyAvailability(
  families: Array<{ assetClass: OpsAssetClass }>,
): OperatorBundleAvailability {
  if (families.length === 0) {
    return 'planned';
  }

  return families.some((family) => !isOpsAssetClassModeled(family.assetClass))
    ? 'live'
    : 'modeled';
}

function summarizeTopAssets(
  exposures: OpsAssetExposure[],
  assets: OpsAsset[],
  limit: number,
): OpsAsset[] {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));

  return exposures
    .filter((entry) => entry.severity !== 'clear')
    .sort((left, right) =>
      severityRank(right.severity) - severityRank(left.severity) ||
      right.score - left.score,
    )
    .flatMap((entry) => {
      const asset = assetById.get(entry.assetId);
      return asset ? [asset] : [];
    })
    .slice(0, limit);
}

function joinAssetNames(assets: OpsAsset[]): string {
  return assets.map((asset) => asset.name).join(', ');
}

function sortDomainList(domains: OperatorBundleDomain[]): OperatorBundleDomain[] {
  return domains
    .map((domain, index) => ({ domain, index }))
    .sort((left, right) =>
      severityRank(right.domain.severity) - severityRank(left.domain.severity) ||
      availabilityRank(right.domain.availability) - availabilityRank(left.domain.availability) ||
      left.index - right.index,
    )
    .map(({ domain }) => domain);
}

function mergeDomainLists(
  baseDomains: OperatorBundleDomain[],
  overrideDomains: OperatorBundleDomain[] | undefined,
): OperatorBundleDomain[] {
  if (!overrideDomains || overrideDomains.length === 0) {
    return baseDomains;
  }

  const merged = new Map(baseDomains.map((domain) => [domain.id, domain]));
  for (const domain of overrideDomains) {
    merged.set(domain.id, domain);
  }

  const ordered: OperatorBundleDomain[] = [];
  for (const domain of overrideDomains) {
    const next = merged.get(domain.id);
    if (next) {
      ordered.push(next);
      merged.delete(domain.id);
    }
  }

  for (const domain of baseDomains) {
    const next = merged.get(domain.id);
    if (next) {
      ordered.push(next);
      merged.delete(domain.id);
    }
  }

  return sortDomainList(ordered);
}

function applyDomainOverview(
  summary: OperatorBundleSummary,
  override: OperatorBundleDomainOverview | undefined,
): OperatorBundleSummary {
  if (!override) {
    return summary;
  }

  return {
    ...summary,
    metric: override.metric,
    detail: override.detail,
    severity: override.severity,
    availability: override.availability,
    trust: override.trust,
    counters: override.counters,
    signals: override.signals,
    domains: mergeDomainLists(summary.domains, override.domains),
  };
}

export function buildOperatorBundleSummaries(
  input: BuildOperatorBundleSummariesInput,
): OperatorBundleSummaries {
  const ports = summarizeClassExposure('port', input.assets, input.exposures);
  const lifelines = summarizeBundleExposure('lifelines', input.assets, input.exposures);
  const medical = summarizeBundleExposure('medical', input.assets, input.exposures);
  const builtEnvironment = summarizeBundleExposure('built-environment', input.assets, input.exposures);
  const lifelineFamilies = summarizeBundleFamilies('lifelines', input.assets, input.exposures);
  const builtEnvironmentFamilies = summarizeBundleFamilies('built-environment', input.assets, input.exposures);
  const topAssets = summarizeTopAssets(input.exposures, input.assets, 2);
  const topRegion = formatRegion(input.operationalOverview.topRegion);
  const hasEvent = input.selectedEvent !== null;
  const liveTrust = resolveBundleTrust('live', input.trustLevel);
  const plannedTrust = resolveBundleTrust('planned', input.trustLevel);
  const lifelineAvailability = resolveFamilyAvailability(lifelineFamilies);
  const lifelineDomains = buildBundleDomains(lifelineFamilies, liveTrust);
  const builtEnvironmentDomains = buildBundleDomains(builtEnvironmentFamilies, liveTrust);

  return {
    seismic: applyDomainOverview({
      bundleId: 'seismic',
      title: t('panel.operatorPulse.bundle.seismic'),
      metric: input.operationalOverview.nationalAffectedAssetCount > 0
        ? tf('bundle.metric.assetsElevated', { n: input.operationalOverview.nationalAffectedAssetCount })
        : t('bundle.metric.noElevated'),
      detail: input.operationalOverview.topRegion
        ? tf('bundle.detail.pressureCentered', { region: topRegion })
        : t('bundle.detail.seismicStandby'),
      severity: input.operationalOverview.topSeverity,
      availability: 'live',
      trust: liveTrust,
      counters: [
        buildCounter(
          'affected-assets',
          t('bundle.counter.affected'),
          input.operationalOverview.nationalAffectedAssetCount,
          input.operationalOverview.topSeverity,
        ),
        buildCounter(
          'visible-assets',
          t('bundle.counter.visible'),
          input.operationalOverview.visibleAffectedAssetCount,
          input.operationalOverview.topSeverity,
        ),
      ],
      signals: hasEvent && input.operationalOverview.topRegion
        ? [
            buildSignal('focus-region', t('bundle.signal.focusRegion'), topRegion, input.operationalOverview.topSeverity),
            ...(topAssets.length > 0
              ? [buildSignal('top-assets', t('bundle.signal.topAssets'), joinAssetNames(topAssets), input.operationalOverview.topSeverity)]
              : []),
          ]
        : [],
      domains: [],
    }, input.domainOverviews?.seismic),
    maritime: applyDomainOverview({
      bundleId: 'maritime',
      title: t('panel.operatorPulse.bundle.maritime'),
      metric: input.maritimeOverview
        ? input.maritimeOverview.summary
        : ports.count > 0
          ? tf('bundle.metric.portsElevated', { n: ports.count })
          : t('maritime.noTraffic'),
      detail: ports.count > 0
        ? tf('bundle.detail.coastalVerification', { assets: ports.topAssets.map((asset) => asset.name).join(', ') })
        : input.maritimeOverview && input.maritimeOverview.totalTracked > 0
          ? input.maritimeOverview.highPriorityTracked > 0
            ? tf('bundle.detail.highPriorityFeed', { hp: input.maritimeOverview.highPriorityTracked, uw: input.maritimeOverview.underwayCount })
            : tf('bundle.detail.underwayTraffic', { n: input.maritimeOverview.underwayCount })
          : t('bundle.detail.aisStandby'),
      severity: ports.topSeverity,
      availability: 'live',
      trust: liveTrust,
      counters: input.maritimeOverview
        ? [
            buildCounter('tracked', t('bundle.counter.tracked'), input.maritimeOverview.totalTracked, 'clear'),
            buildCounter('high-priority', t('bundle.counter.highPriority'), input.maritimeOverview.highPriorityTracked, 'priority'),
            buildCounter('underway', t('bundle.counter.underway'), input.maritimeOverview.underwayCount, 'watch'),
          ]
        : [],
      signals: [
        ...(ports.count > 0
          ? [buildSignal('exposed-ports', t('bundle.signal.exposedPorts'), joinAssetNames(ports.topAssets), ports.topSeverity)]
          : []),
        ...(input.maritimeOverview
          ? [buildSignal(
              'traffic-posture',
              t('bundle.signal.trafficPosture'),
              tf('bundle.signal.trafficPostureValue', { hp: input.maritimeOverview.highPriorityTracked, uw: input.maritimeOverview.underwayCount }),
              input.maritimeOverview.highPriorityTracked > 0 ? 'watch' : 'clear',
            )]
          : []),
      ],
      domains: [],
    }, input.domainOverviews?.maritime),
    lifelines: applyDomainOverview({
      bundleId: 'lifelines',
      title: t('panel.operatorPulse.bundle.lifelines'),
      metric: lifelines.count > 0
        ? tf('bundle.metric.lifelineElevated', { n: lifelines.count })
        : t('bundle.metric.noLifelineElevated'),
      detail: lifelines.count > 0
        ? tf('bundle.detail.corridorVerification', { assets: lifelines.topAssets.map((asset) => asset.name).join(', ') })
        : t('bundle.detail.lifelineStandby'),
      severity: lifelines.topSeverity,
      availability: lifelines.count > 0 ? lifelineAvailability : 'planned',
      trust: lifelines.count > 0 ? resolveBundleTrust(lifelineAvailability, input.trustLevel) : plannedTrust,
      counters: lifelines.count > 0
        ? [
            buildCounter('lifeline-sites', t('bundle.counter.lifelineSites'), lifelines.count, lifelines.topSeverity),
            ...buildBundleFamilyCounters(lifelineFamilies),
          ]
        : [],
      signals: lifelines.count > 0
        ? [
            buildSignal('corridor-focus', t('bundle.signal.corridorFocus'), joinAssetNames(lifelines.topAssets), lifelines.topSeverity),
            ...buildBundleDomainMixSignal(lifelineFamilies, lifelines.topSeverity),
          ]
        : [],
      domains: lifelineDomains,
    }, input.domainOverviews?.lifelines),
    medical: applyDomainOverview({
      bundleId: 'medical',
      title: t('panel.operatorPulse.bundle.medical'),
      metric: medical.count > 0
        ? tf('bundle.metric.medicalElevated', { n: medical.count })
        : t('bundle.metric.noMedicalShift'),
      detail: medical.count > 0
        ? tf('bundle.detail.hospitalVerification', { assets: medical.topAssets.map((asset) => asset.name).join(', ') })
        : t('bundle.detail.medicalStandby'),
      severity: medical.topSeverity,
      availability: medical.count > 0 ? 'modeled' : 'planned',
      trust: medical.count > 0 ? resolveModeledTrust(input.trustLevel) : plannedTrust,
      counters: medical.count > 0
        ? [buildCounter('medical-sites', t('bundle.counter.sites'), medical.count, medical.topSeverity)]
        : [],
      signals: medical.count > 0
        ? [
            buildSignal('source', t('bundle.signal.source'), t('bundle.signal.modeledFromSeismic'), 'watch'),
            buildSignal('medical-focus', t('bundle.signal.medicalFocus'), joinAssetNames(medical.topAssets), medical.topSeverity),
          ]
        : [],
      domains: medical.count > 0
        ? buildBundleDomains(
            summarizeBundleFamilies('medical', input.assets, input.exposures),
            resolveModeledTrust(input.trustLevel),
          )
        : [],
    }, input.domainOverviews?.medical),
    'built-environment': applyDomainOverview({
      bundleId: 'built-environment',
      title: t('panel.operatorPulse.bundle.builtEnvironment'),
      metric: builtEnvironment.count > 0
        ? tf('bundle.metric.buildingElevated', { n: builtEnvironment.count })
        : hasEvent
          ? tf('bundle.metric.urbanAligned', { region: topRegion })
          : t('bundle.metric.urbanStandby'),
      detail: builtEnvironment.count > 0
        ? tf('bundle.detail.urbanVerification', { assets: builtEnvironment.topAssets.map((asset) => asset.name).join(', ') })
        : hasEvent
          ? t('bundle.detail.builtEnvIntensify')
          : t('bundle.detail.builtEnvStandby'),
      severity: builtEnvironment.count > 0 ? builtEnvironment.topSeverity : input.operationalOverview.topSeverity,
      availability: builtEnvironment.count > 0 ? 'live' : 'planned',
      trust: builtEnvironment.count > 0 ? liveTrust : plannedTrust,
      counters: builtEnvironment.count > 0
        ? [
            buildCounter('building-clusters', t('bundle.counter.buildingClusters'), builtEnvironment.count, builtEnvironment.topSeverity),
            ...buildBundleFamilyCounters(builtEnvironmentFamilies),
          ]
        : [],
      signals: builtEnvironment.count > 0
        ? [
            buildSignal('urban-focus', t('bundle.signal.urbanFocus'), joinAssetNames(builtEnvironment.topAssets), builtEnvironment.topSeverity),
            ...buildBundleDomainMixSignal(builtEnvironmentFamilies, builtEnvironment.topSeverity),
          ]
        : hasEvent
          ? [buildSignal('activation-tier', t('bundle.signal.activationTier'), t('bundle.signal.cityTierFocus'), 'watch')]
          : [],
      domains: builtEnvironmentDomains,
    }, input.domainOverviews?.['built-environment']),
  };
}
