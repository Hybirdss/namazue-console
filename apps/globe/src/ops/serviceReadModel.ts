import type {
  EarthquakeEvent,
  PrefectureImpact,
  RailLineStatus,
  TsunamiAssessment,
  TsunamiSummary,
} from '../types';
import { getLocalizedPlace } from '../utils/japanGeo';
import {
  analyzeEventRevisionHistory,
  type CanonicalEventEnvelope,
  type CanonicalEventSource,
} from '../data/eventEnvelope';
import type {
  EventTruth,
  OperationalLatencySummary,
  OperatorBundleDomainOverrides,
  OperatorBundleDomainOverviews,
  OperationalOverview,
  OpsSnapshot,
  RealtimeStatus,
  ServiceReadModel,
  SystemHealthSummary,
} from './readModelTypes';
import type { OpsAsset, OpsAssetExposure, OpsPriority, OpsRegion, OpsSeverity, ViewportState } from './types';
import { filterVisibleOpsAssets } from './viewport';
import type { SelectedOperationalFocusReason } from './eventSelection';
import {
  buildOperatorBundleSummaries,
  type MaritimeTelemetryOverview,
} from './bundleSummaries';
import {
  buildDefaultBundleDomainOverviews,
  filterScopedDomainOverrides,
  mergeBundleDomainOverrides,
} from './bundleDomainOverviews';
import { t, tf } from '../i18n';
import { severityRank } from './severityUtils';

export interface BuildServiceReadModelInput {
  selectedEvent: EarthquakeEvent | null;
  selectedEventEnvelope?: CanonicalEventEnvelope | null;
  selectedEventRevisionHistory?: CanonicalEventEnvelope[];
  selectionReason?: SelectedOperationalFocusReason | null;
  tsunamiAssessment: TsunamiAssessment | null;
  tsunamiSummary?: TsunamiSummary | null;
  impactResults: PrefectureImpact[] | null;
  assets: OpsAsset[];
  viewport?: ViewportState | null;
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  maritimeOverview?: MaritimeTelemetryOverview | null;
  domainOverrides?: OperatorBundleDomainOverrides;
  domainOverviews?: OperatorBundleDomainOverviews;
  railStatuses?: RailLineStatus[];
  freshnessStatus: RealtimeStatus;
}

function buildSystemHealth(
  freshnessStatus: RealtimeStatus,
  eventTruth: EventTruth | null,
): SystemHealthSummary {
  const flags: string[] = [];

  if (freshnessStatus.source !== 'server') {
    flags.push('fallback-feed');
  }
  if (freshnessStatus.state === 'stale') {
    flags.push('stale-feed');
  }
  if (eventTruth?.hasConflictingRevision) {
    flags.push('revision-conflict');
  }
  if (eventTruth?.divergenceSeverity === 'material') {
    flags.push('material-divergence');
  }
  if (eventTruth?.confidence === 'low') {
    flags.push('low-confidence-truth');
  }

  const divergenceSummary = eventTruth
    ? buildDivergenceSummary(eventTruth)
    : null;

  if (freshnessStatus.state === 'degraded') {
    return {
      level: 'degraded',
      headline: t('health.degraded.headline'),
      detail: freshnessStatus.message ?? t('health.degraded.detail'),
      flags,
    };
  }

  if (flags.includes('material-divergence')) {
    return {
      level: 'watch',
      headline: t('health.divergence.headline'),
      detail: divergenceSummary ?? t('health.divergence.detail'),
      flags,
    };
  }

  if (flags.includes('revision-conflict') || freshnessStatus.state === 'stale' || flags.includes('low-confidence-truth')) {
    return {
      level: 'watch',
      headline: flags.includes('revision-conflict')
        ? t('health.conflict.headline')
        : flags.includes('low-confidence-truth')
          ? t('health.lowConf.headline')
        : t('health.stale.headline'),
      detail: flags.includes('revision-conflict')
        ? divergenceSummary ?? tf('health.conflict.detail', { n: eventTruth?.revisionCount ?? 0, sources: (eventTruth?.sources ?? []).join('/') })
        : flags.includes('low-confidence-truth')
          ? tf('health.lowConf.detail', { source: eventTruth?.source ?? 'feed' })
        : freshnessStatus.message ?? t('health.stale.detail'),
      flags,
    };
  }

  return {
    level: 'nominal',
    headline: t('health.nominal.headline'),
    detail: t('health.nominal.detail'),
    flags,
  };
}

function buildDivergenceSummary(eventTruth: EventTruth): string | null {
  if (eventTruth.divergenceSeverity === 'none' && !eventTruth.hasConflictingRevision) {
    return null;
  }

  const parts: string[] = [];
  if (eventTruth.magnitudeSpread > 0) {
    parts.push(tf('ops.magSpread', { n: eventTruth.magnitudeSpread.toFixed(1) }));
  }
  if (eventTruth.depthSpreadKm > 0) {
    parts.push(tf('ops.depthSpread', { n: Math.round(eventTruth.depthSpreadKm) }));
  }
  if (eventTruth.locationSpreadKm > 0) {
    parts.push(tf('ops.locationSpread', { n: Math.round(eventTruth.locationSpreadKm) }));
  }
  if (eventTruth.tsunamiMismatch) {
    parts.push(t('ops.tsunamiMismatch'));
  }
  if (eventTruth.faultTypeMismatch) {
    parts.push(t('ops.faultTypeMismatch'));
  }

  if (parts.length === 0) {
    return tf('ops.revisionsReview', { n: eventTruth.revisionCount, sources: eventTruth.sources.join('/') });
  }

  return tf('ops.revisionsShow', { n: eventTruth.revisionCount, sources: eventTruth.sources.join('/'), detail: parts.join(', ') });
}

function buildOperationalLatencySummary(input: {
  freshnessStatus: RealtimeStatus;
  eventTruth: EventTruth | null;
}): OperationalLatencySummary | null {
  const { eventTruth } = input;
  if (!eventTruth) {
    return null;
  }

  const ingestLagSeconds = Math.max(0, Math.round((eventTruth.receivedAt - eventTruth.issuedAt) / 1000));
  const sourceLagSeconds = Math.max(0, Math.round((input.freshnessStatus.updatedAt - eventTruth.issuedAt) / 1000));
  const eventAgeSeconds = Math.max(0, Math.round((input.freshnessStatus.updatedAt - eventTruth.observedAt) / 1000));

  return {
    ingestLagSeconds,
    sourceLagSeconds,
    eventAgeSeconds,
  };
}

function getAffectedEntries(exposures: OpsAssetExposure[]): OpsAssetExposure[] {
  return exposures.filter((entry) => entry.severity !== 'clear');
}

function getTopRegion(
  exposures: OpsAssetExposure[],
  assets: OpsAsset[],
): OpsRegion | null {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const sorted = [...getAffectedEntries(exposures)].sort((left, right) =>
    severityRank(right.severity) - severityRank(left.severity) || right.score - left.score,
  );

  return sorted.length > 0
    ? assetById.get(sorted[0]!.assetId)?.region ?? null
    : null;
}

function getTopSeverity(exposures: OpsAssetExposure[]): OpsSeverity {
  return getAffectedEntries(exposures).reduce<OpsSeverity>(
    (best, entry) => severityRank(entry.severity) > severityRank(best) ? entry.severity : best,
    'clear',
  );
}

function buildSelectionSummary(reason: SelectedOperationalFocusReason | null, hasEvent: boolean): string {
  if (!hasEvent) {
    return t('ops.noSignificantEvent');
  }

  switch (reason) {
    case 'auto-select':
      return t('ops.focusAutoSelected');
    case 'retain-current':
      return t('ops.focusRetained');
    case 'escalate':
      return t('ops.focusEscalated');
    case 'no-significant-event':
    case null:
      return t('ops.focusActive');
  }
}

function buildImpactSummary(
  visibleCount: number,
  nationalCount: number,
  hasViewport: boolean,
): string {
  if (!hasViewport) {
    if (nationalCount > 0) {
      return tf('ops.assetsElevatedNational', { n: nationalCount });
    }
    return t('ops.noAssetsElevated');
  }

  if (visibleCount > 0) {
    return tf('ops.assetsElevatedVisible', { n: visibleCount });
  }
  if (nationalCount > 0) {
    return tf('ops.assetsElevatedNational', { n: nationalCount });
  }
  return t('ops.noAssetsElevated');
}

function buildOperationalOverview(input: {
  selectionReason: SelectedOperationalFocusReason | null;
  assets: OpsAsset[];
  nationalExposureSummary: OpsAssetExposure[];
  visibleExposureSummary: OpsAssetExposure[];
  hasEvent: boolean;
  hasViewport: boolean;
}): OperationalOverview {
  const visibleAffected = getAffectedEntries(input.visibleExposureSummary);
  const nationalAffected = getAffectedEntries(input.nationalExposureSummary);

  return {
    selectionReason: input.selectionReason,
    selectionSummary: buildSelectionSummary(input.selectionReason, input.hasEvent),
    impactSummary: buildImpactSummary(
      visibleAffected.length,
      nationalAffected.length,
      input.hasViewport,
    ),
    visibleAffectedAssetCount: visibleAffected.length,
    nationalAffectedAssetCount: nationalAffected.length,
    topRegion: getTopRegion(
      visibleAffected.length > 0 ? visibleAffected : nationalAffected,
      input.assets,
    ),
    topSeverity: getTopSeverity(visibleAffected.length > 0 ? visibleAffected : nationalAffected),
  };
}

export function createEmptyServiceReadModel(
  freshnessStatus: RealtimeStatus,
  viewport: ViewportState | null = null,
): ServiceReadModel {
  const systemHealth = buildSystemHealth(freshnessStatus, null);
  return {
    currentEvent: null,
    eventTruth: null,
    viewport,
    nationalSnapshot: null,
    systemHealth,
    operationalOverview: {
      selectionReason: null,
      selectionSummary: t('ops.noSignificantEvent'),
      impactSummary: t('ops.noAssetsElevated'),
      visibleAffectedAssetCount: 0,
      nationalAffectedAssetCount: 0,
      topRegion: null,
      topSeverity: 'clear',
    },
    bundleSummaries: buildOperatorBundleSummaries({
      selectedEvent: null,
      assets: [],
      exposures: [],
      operationalOverview: {
        selectionReason: null,
        selectionSummary: t('ops.noSignificantEvent'),
        impactSummary: t('ops.noAssetsElevated'),
        visibleAffectedAssetCount: 0,
        nationalAffectedAssetCount: 0,
        topRegion: null,
        topSeverity: 'clear',
      },
      maritimeOverview: null,
      trustLevel: 'confirmed',
    }),
    nationalExposureSummary: [],
    visibleExposureSummary: [],
    nationalPriorityQueue: [],
    visiblePriorityQueue: [],
    freshnessStatus,
    operationalLatency: null,
  };
}

function buildOpsSnapshot(input: BuildServiceReadModelInput): OpsSnapshot | null {
  const event = input.selectedEvent;
  if (!event) {
    return null;
  }

  const topImpact = input.impactResults?.[0] ?? null;
  const topPriority = input.priorities[0] ?? null;
  const tsunamiRisk = input.tsunamiSummary?.risk ?? input.tsunamiAssessment?.risk ?? 'pending';

  return {
    title: getLocalizedPlace(event.lat, event.lng, event.place.text),
    summary: tf('ops.snapshotSummary', { place: getLocalizedPlace(event.lat, event.lng, event.place.text), mag: event.magnitude.toFixed(1), tsunami: tsunamiRisk }),
    headline: topPriority?.title ?? null,
    tsunami: input.tsunamiSummary ?? null,
    topImpact,
  };
}

function buildEventTruth(
  envelope: CanonicalEventEnvelope | null | undefined,
  history: CanonicalEventEnvelope[] | undefined,
): EventTruth | null {
  if (!envelope) {
    return null;
  }

  const revisionHistory = history && history.length > 0
    ? history.some((entry) => entry.revision === envelope.revision)
      ? history
      : [...history, envelope]
    : [envelope];
  const sources = Array.from(
    new Set(revisionHistory.map((entry) => entry.source)),
  ) as CanonicalEventSource[];
  const divergence = analyzeEventRevisionHistory(revisionHistory);

  return {
    source: envelope.source,
    revision: envelope.revision,
    issuedAt: envelope.issuedAt,
    receivedAt: envelope.receivedAt,
    observedAt: envelope.observedAt,
    supersedes: envelope.supersedes,
    confidence: envelope.confidence,
    revisionCount: revisionHistory.length,
    sources,
    hasConflictingRevision: sources.length > 1,
    divergenceSeverity: divergence.divergenceSeverity,
    magnitudeSpread: divergence.magnitudeSpread,
    depthSpreadKm: divergence.depthSpreadKm,
    locationSpreadKm: divergence.locationSpreadKm,
    tsunamiMismatch: divergence.tsunamiMismatch,
    faultTypeMismatch: divergence.faultTypeMismatch,
  };
}

function deriveVisibleAssetIds(
  assets: OpsAsset[],
  viewport: ViewportState | null | undefined,
): string[] | null {
  if (!viewport) {
    return null;
  }

  return filterVisibleOpsAssets(assets, viewport).map((asset) => asset.id);
}

function filterVisibleExposures(
  exposures: OpsAssetExposure[],
  visibleAssetIds: string[] | null,
): OpsAssetExposure[] {
  if (!visibleAssetIds) {
    return exposures;
  }

  const visible = new Set(visibleAssetIds);
  return exposures.filter((entry) => visible.has(entry.assetId));
}

function filterVisiblePriorities(
  priorities: OpsPriority[],
  visibleAssetIds: string[] | null,
): OpsPriority[] {
  if (!visibleAssetIds) {
    return priorities;
  }

  const visible = new Set(visibleAssetIds);
  return priorities.filter((entry) => entry.assetId !== null && visible.has(entry.assetId));
}

export function buildServiceReadModel(input: BuildServiceReadModelInput): ServiceReadModel {
  const nationalExposureSummary = input.exposures;
  const nationalPriorityQueue = input.priorities;
  const visibleAssetIds = deriveVisibleAssetIds(input.assets, input.viewport);
  const eventTruth = buildEventTruth(input.selectedEventEnvelope, input.selectedEventRevisionHistory);
  const visibleExposureSummary = filterVisibleExposures(input.exposures, visibleAssetIds);
  const visiblePriorityQueue = filterVisiblePriorities(input.priorities, visibleAssetIds);
  const operationalOverview = buildOperationalOverview({
    selectionReason: input.selectionReason ?? null,
    assets: input.assets,
    nationalExposureSummary,
    visibleExposureSummary,
    hasEvent: input.selectedEvent !== null,
    hasViewport: Boolean(input.viewport),
  });
  const systemHealth = buildSystemHealth(input.freshnessStatus, eventTruth);
  const trustLevel = systemHealth.level === 'degraded'
    ? 'degraded'
    : systemHealth.level === 'watch'
      ? 'review'
      : 'confirmed';
  const railComponent = input.freshnessStatus.components?.find((component) => component.id === 'rail');
  const applicableDomainOverrides = filterScopedDomainOverrides({
    domainOverrides: input.domainOverrides,
    selectedEventId: input.selectedEvent?.id ?? null,
  });
  const hasRailOverride = Boolean(applicableDomainOverrides.lifelines?.some((domain) => domain.id === 'rail'));
  const hasPowerOverride = Boolean(applicableDomainOverrides.lifelines?.some((domain) => domain.id === 'power'));
  const hasWaterOverride = Boolean(applicableDomainOverrides.lifelines?.some((domain) => domain.id === 'water'));
  const hasMedicalOverride = Boolean(applicableDomainOverrides.medical?.length);
  const bundleDomainOverviews = {
    ...mergeBundleDomainOverrides({
      overviews: buildDefaultBundleDomainOverviews({
        assets: input.assets,
        exposures: nationalExposureSummary,
        priorities: nationalPriorityQueue,
        trustLevel,
        selectedEvent: input.selectedEvent,
        includeMedicalOverview: !hasMedicalOverride,
        includePowerDomain: !hasPowerOverride,
        includeRailDomain: !hasRailOverride,
        includeWaterDomain: !hasWaterOverride,
        railStatuses: hasRailOverride ? undefined : input.railStatuses,
        railComponent: hasRailOverride ? undefined : railComponent,
      }),
      domainOverrides: applicableDomainOverrides,
      trust: trustLevel,
    }),
    ...input.domainOverviews,
  };
  const operationalLatency = buildOperationalLatencySummary({
    freshnessStatus: input.freshnessStatus,
    eventTruth,
  });

  return {
    currentEvent: input.selectedEvent,
    eventTruth,
    viewport: input.viewport ?? null,
    nationalSnapshot: buildOpsSnapshot(input),
    systemHealth,
    operationalOverview,
    bundleSummaries: buildOperatorBundleSummaries({
      selectedEvent: input.selectedEvent,
      assets: input.assets,
      exposures: input.exposures,
      operationalOverview,
      maritimeOverview: input.maritimeOverview ?? null,
      domainOverviews: bundleDomainOverviews,
      trustLevel,
    }),
    nationalExposureSummary,
    visibleExposureSummary,
    nationalPriorityQueue,
    visiblePriorityQueue,
    freshnessStatus: input.freshnessStatus,
    operationalLatency,
  };
}
