import type { EarthquakeEvent, PrefectureImpact, TsunamiSummary } from '../types';
import type { OpsAssetExposure, OpsPriority, OpsRegion, OpsSeverity, ViewportState } from './types';
import type {
  CanonicalEventConfidence,
  CanonicalEventSource,
  RevisionDivergenceSeverity,
} from '../data/eventEnvelope';
import type { SelectedOperationalFocusReason } from './eventSelection';

export type RealtimeSource = 'server' | 'usgs' | 'fallback';
export type RealtimeState = 'fresh' | 'stale' | 'degraded';
export type RealtimeComponentId = 'events' | 'governor' | 'maritime' | 'rail';
export type RealtimeComponentState = 'live' | 'stale' | 'degraded' | 'down' | 'unknown';

export interface RealtimeComponentStatus {
  id: RealtimeComponentId;
  label: string;
  state: RealtimeComponentState;
  source: string;
  updatedAt: number;
  staleAfterMs: number;
  message?: string;
}

export interface RealtimeStatus {
  source: RealtimeSource;
  state: RealtimeState;
  updatedAt: number;
  staleAfterMs: number;
  message?: string;
  components?: RealtimeComponentStatus[];
}

export interface OpsSnapshot {
  title: string;
  summary: string;
  headline: string | null;
  tsunami: TsunamiSummary | null;
  topImpact: PrefectureImpact | null;
}

export interface EventTruth {
  source: CanonicalEventSource;
  revision: string;
  issuedAt: number;
  receivedAt: number;
  observedAt: number;
  supersedes: string | null;
  confidence: CanonicalEventConfidence;
  revisionCount: number;
  sources: CanonicalEventSource[];
  hasConflictingRevision: boolean;
  divergenceSeverity: RevisionDivergenceSeverity;
  magnitudeSpread: number;
  depthSpreadKm: number;
  locationSpreadKm: number;
  tsunamiMismatch: boolean;
  faultTypeMismatch: boolean;
}

export interface SystemHealthSummary {
  level: 'nominal' | 'watch' | 'degraded';
  headline: string;
  detail: string;
  flags: string[];
}

export interface OperationalLatencySummary {
  ingestLagSeconds: number;
  sourceLagSeconds: number;
  eventAgeSeconds: number;
}

export interface OperationalOverview {
  selectionReason: SelectedOperationalFocusReason | null;
  selectionSummary: string;
  impactSummary: string;
  visibleAffectedAssetCount: number;
  nationalAffectedAssetCount: number;
  topRegion: OpsRegion | null;
  topSeverity: OpsSeverity;
}

export type OperatorBundleId =
  | 'seismic'
  | 'maritime'
  | 'lifelines'
  | 'medical'
  | 'built-environment';

export type OperatorBundleTrust = 'confirmed' | 'review' | 'degraded' | 'pending';
export type OperatorBundleAvailability = 'live' | 'modeled' | 'planned';

export interface OperatorBundleCounter {
  id: string;
  label: string;
  value: number;
  tone: OpsSeverity;
}

export interface OperatorBundleSignal {
  id: string;
  label: string;
  value: string;
  tone: OpsSeverity;
}

export interface OperatorBundleDomain {
  id: string;
  label: string;
  metric: string;
  detail: string;
  eventId?: string | null;
  severity: OpsSeverity;
  availability: OperatorBundleAvailability;
  trust: OperatorBundleTrust;
  counters: OperatorBundleCounter[];
  signals: OperatorBundleSignal[];
}

export interface OperatorBundleSummary {
  bundleId: OperatorBundleId;
  title: string;
  metric: string;
  detail: string;
  severity: OpsSeverity;
  availability: OperatorBundleAvailability;
  trust: OperatorBundleTrust;
  counters: OperatorBundleCounter[];
  signals: OperatorBundleSignal[];
  domains: OperatorBundleDomain[];
}

export interface OperatorBundleDomainOverview {
  metric: string;
  detail: string;
  severity: OpsSeverity;
  availability: OperatorBundleAvailability;
  trust: OperatorBundleTrust;
  counters: OperatorBundleCounter[];
  signals: OperatorBundleSignal[];
  domains?: OperatorBundleDomain[];
}

export type OperatorBundleDomainOverviews = Partial<Record<OperatorBundleId, OperatorBundleDomainOverview>>;
export type OperatorBundleDomainOverrides = Partial<Record<OperatorBundleId, OperatorBundleDomain[]>>;

export type OperatorBundleSummaries = Partial<Record<OperatorBundleId, OperatorBundleSummary>>;

export interface ServiceReadModel {
  currentEvent: EarthquakeEvent | null;
  eventTruth: EventTruth | null;
  viewport: ViewportState | null;
  nationalSnapshot: OpsSnapshot | null;
  systemHealth: SystemHealthSummary;
  operationalOverview: OperationalOverview;
  bundleSummaries: OperatorBundleSummaries;
  nationalExposureSummary: OpsAssetExposure[];
  visibleExposureSummary: OpsAssetExposure[];
  nationalPriorityQueue: OpsPriority[];
  visiblePriorityQueue: OpsPriority[];
  freshnessStatus: RealtimeStatus;
  operationalLatency?: OperationalLatencySummary | null;
}

export interface ReplayMilestone {
  kind: 'event_locked' | 'impact_ready' | 'tsunami_ready' | 'exposure_ready' | 'priorities_published';
  at: number;
  label: string;
}

export interface ScenarioDelta {
  changeSummary: string[];
  exposureChanges: Array<{ assetId: string; from: string; to: string }>;
  priorityChanges: Array<{ id: string; from: number; to: number }>;
  reasons: string[];
}
