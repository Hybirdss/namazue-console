/**
 * Unified Poller — Single polling loop for all dynamic data layers.
 *
 * Architecture:
 *   1 fetch → snapshot.json (R2 CDN) → distribute to all layers
 *   N layers → still 1 HTTP request per cycle
 *   Adding a new layer = adding a key to snapshot + 1 store dispatch
 *
 * Fallback hierarchy:
 *   snapshot.json (R2 CDN) → individual feeds → Worker API → USGS
 *
 * Governor controls the single poll interval:
 *   calm=60s, watch=20s, incident=10s
 */

import type { EarthquakeEvent, RailLineStatus } from '../types';
import type { GovernorPolicyEnvelope } from '../governor/types.ts';
import type {
  OperatorBundleAvailability,
  OperatorBundleCounter,
  OperatorBundleDomain,
  OperatorBundleDomainOverrides,
  OperatorBundleId,
  OperatorBundleSignal,
  OperatorBundleTrust,
  RealtimeComponentStatus,
  RealtimeComponentState,
  RealtimeSource,
  RealtimeStatus,
} from '../ops/readModelTypes';
import type { OpsSeverity } from '../ops/types';
import type { Vessel } from './aisManager';
import { serverEventToEq } from './eventFeed';
import { t, tf } from '../i18n';

const FETCH_TIMEOUT_MS = 5_000;
const OPERATOR_BUNDLE_IDS: OperatorBundleId[] = [
  'seismic',
  'maritime',
  'lifelines',
  'medical',
  'built-environment',
];

const R2_FEED_BASE = import.meta.env.PROD
  ? 'https://pub-bf7ee9c3b9f7430496681e94cbfa42cd.r2.dev'
  : '';

// ── Snapshot Types ────────────────────────────────────────────

interface ServerEvent {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: string | number;
  place: string | null;
  fault_type: string | null;
  tsunami: boolean | null;
  maxi?: string | null;
}

interface SnapshotResponse {
  domain_overrides?: OperatorBundleDomainOverrides;
  sections?: {
    events?: ProjectionSection<ServerEvent[]>;
    governor?: ProjectionSection<GovernorPolicyEnvelope | null>;
    maritime?: ProjectionSection<{
      vessels?: Vessel[];
      [key: string]: unknown;
    }>;
    rail?: ProjectionSection<{
      lines?: RailLineStatus[];
      [key: string]: unknown;
    }>;
  };
  events: ServerEvent[];
  count: number;
  governor: GovernorPolicyEnvelope | null;
  maritime: {
    vessels?: Vessel[];
    [key: string]: unknown;
  };
  rail: {
    lines?: RailLineStatus[];
    [key: string]: unknown;
  };
  generated_at: number;
  source_updated: {
    events: number;
    maritime: number;
    rail: number;
  };
}

type ProjectionSectionState = 'live' | 'stale' | 'degraded' | 'down';
type ProjectionSectionName = 'events' | 'governor' | 'maritime' | 'rail';

interface ProjectionSection<T> {
  state: ProjectionSectionState;
  source: string;
  updated_at: number;
  last_success_at: number;
  stale_after_ms: number;
  last_error: string | null;
  data: T;
}

// ── Public Interface ─────────────────────────────────────────

export interface UnifiedPollResult {
  events: EarthquakeEvent[];
  governor: GovernorPolicyEnvelope | null;
  vessels: Vessel[];
  railStatuses: RailLineStatus[];
  domainOverrides: OperatorBundleDomainOverrides;
  source: 'snapshot' | 'fallback';
  updatedAt: number;
  realtimeStatus: RealtimeStatus;
  projectionFreshness: {
    events: number;
    maritime: number;
    rail: number;
  };
}

export interface UnifiedPoller {
  start(): void;
  stop(): void;
  /** Force an immediate poll (e.g. on initial load). Returns the result. */
  poll(): Promise<UnifiedPollResult>;
  /** Update the poll interval (called when governor state changes). */
  setRefreshMs(ms: number): void;
}

export interface UnifiedPollerOptions {
  onUpdate: (result: UnifiedPollResult) => void;
  onError: (error: unknown) => void;
  initialRefreshMs: number;
  /** Fallback fetch for events if snapshot is unavailable. */
  fallbackFetchEvents?: () => Promise<{
    events: EarthquakeEvent[];
    governor: GovernorPolicyEnvelope | null;
    source?: RealtimeSource;
    updatedAt?: number;
  }>;
  snapshotBaseUrl?: string;
}

// ── Implementation ───────────────────────────────────────────

export function resolveDynamicSectionData(input: {
  previousVessels: Vessel[];
  previousRailStatuses: RailLineStatus[];
  previousDomainOverrides: OperatorBundleDomainOverrides;
  result: Pick<UnifiedPollResult, 'source' | 'vessels' | 'railStatuses' | 'domainOverrides' | 'realtimeStatus'>;
}): Pick<UnifiedPollResult, 'vessels' | 'railStatuses' | 'domainOverrides'> {
  const preserveAll = input.result.source === 'fallback';
  const maritimeState = input.result.realtimeStatus.components
    ?.find((component) => component.id === 'maritime')
    ?.state;
  const railState = input.result.realtimeStatus.components
    ?.find((component) => component.id === 'rail')
    ?.state;
  const preserveVessels = preserveAll
    || (
      input.result.vessels.length === 0
      && (maritimeState === 'degraded' || maritimeState === 'down' || maritimeState === 'unknown')
    );
  const preserveRailStatuses = preserveAll
    || (
      input.result.railStatuses.length === 0
      && (railState === 'degraded' || railState === 'down' || railState === 'unknown')
    );
  const preserveDomainOverrides = preserveAll
    || (
      Object.keys(input.result.domainOverrides).length === 0
      && input.result.realtimeStatus.state !== 'fresh'
    );

  return {
    vessels: preserveVessels ? input.previousVessels : input.result.vessels,
    railStatuses: preserveRailStatuses ? input.previousRailStatuses : input.result.railStatuses,
    domainOverrides: preserveDomainOverrides ? input.previousDomainOverrides : input.result.domainOverrides,
  };
}

async function fetchWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function parseSnapshotEvents(events: ServerEvent[]): EarthquakeEvent[] {
  return events
    .map(serverEventToEq)
    .filter((e): e is EarthquakeEvent => e !== null);
}

function extractVessels(maritime: SnapshotResponse['maritime']): Vessel[] {
  if (!maritime) return [];
  // Maritime snapshot may be full DO response or simplified
  const vessels = maritime.vessels ?? (maritime as any).vessels;
  return Array.isArray(vessels) ? vessels : [];
}

function extractRailStatuses(rail: SnapshotResponse['rail']): RailLineStatus[] {
  if (!rail) return [];
  const lines = rail.lines;
  return Array.isArray(lines) ? lines : [];
}

function parseSeverity(value: unknown): OpsSeverity {
  switch (value) {
    case 'clear':
    case 'watch':
    case 'priority':
    case 'critical':
      return value;
    default:
      return 'watch';
  }
}

function parseAvailability(value: unknown): OperatorBundleAvailability {
  switch (value) {
    case 'live':
    case 'modeled':
    case 'planned':
      return value;
    default:
      return 'live';
  }
}

function parseTrust(value: unknown): OperatorBundleTrust {
  switch (value) {
    case 'confirmed':
    case 'review':
    case 'degraded':
    case 'pending':
      return value;
    default:
      return 'review';
  }
}

function sanitizeCounter(value: unknown): OperatorBundleCounter | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string') return null;
  if (typeof candidate.label !== 'string') return null;
  if (typeof candidate.value !== 'number') return null;

  return {
    id: candidate.id,
    label: candidate.label,
    value: candidate.value,
    tone: parseSeverity(candidate.tone),
  };
}

function sanitizeSignal(value: unknown): OperatorBundleSignal | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string') return null;
  if (typeof candidate.label !== 'string') return null;
  if (typeof candidate.value !== 'string') return null;

  return {
    id: candidate.id,
    label: candidate.label,
    value: candidate.value,
    tone: parseSeverity(candidate.tone),
  };
}

function sanitizeDomain(value: unknown): OperatorBundleDomain | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string') return null;
  if (typeof candidate.label !== 'string') return null;
  if (typeof candidate.metric !== 'string') return null;
  if (typeof candidate.detail !== 'string') return null;
  const eventId = typeof candidate.eventId === 'string'
    ? candidate.eventId
    : candidate.eventId === null
      ? null
      : undefined;

  const counters = Array.isArray(candidate.counters)
    ? candidate.counters
      .map(sanitizeCounter)
      .filter((counter): counter is OperatorBundleCounter => counter !== null)
    : [];
  const signals = Array.isArray(candidate.signals)
    ? candidate.signals
      .map(sanitizeSignal)
      .filter((signal): signal is OperatorBundleSignal => signal !== null)
    : [];

  return {
    id: candidate.id,
    label: candidate.label,
    metric: candidate.metric,
    detail: candidate.detail,
    eventId,
    severity: parseSeverity(candidate.severity),
    availability: parseAvailability(candidate.availability),
    trust: parseTrust(candidate.trust),
    counters,
    signals,
  };
}

function extractDomainOverrides(snapshot: SnapshotResponse): OperatorBundleDomainOverrides {
  if (!snapshot.domain_overrides || typeof snapshot.domain_overrides !== 'object') {
    return {};
  }

  const raw = snapshot.domain_overrides as Record<string, unknown>;
  const overrides: OperatorBundleDomainOverrides = {};

  for (const bundleId of OPERATOR_BUNDLE_IDS) {
    const rawDomains = raw[bundleId];
    if (!Array.isArray(rawDomains)) continue;

    const domains = rawDomains
      .map(sanitizeDomain)
      .filter((domain): domain is OperatorBundleDomain => domain !== null);

    if (domains.length > 0) {
      overrides[bundleId] = domains;
    }
  }

  return overrides;
}

function deriveProjectionFreshness(snapshot: SnapshotResponse): UnifiedPollResult['projectionFreshness'] {
  return {
    events: snapshot.sections?.events?.updated_at ?? snapshot.source_updated?.events ?? snapshot.generated_at ?? 0,
    maritime: snapshot.sections?.maritime?.updated_at ?? snapshot.source_updated?.maritime ?? snapshot.generated_at ?? 0,
    rail: snapshot.sections?.rail?.updated_at ?? snapshot.source_updated?.rail ?? snapshot.generated_at ?? 0,
  };
}

function formatSectionLabel(name: ProjectionSectionName): string {
  switch (name) {
    case 'events':
      return t('poller.section.events');
    case 'governor':
      return t('poller.section.governor');
    case 'maritime':
      return t('poller.section.maritime');
    case 'rail':
      return t('poller.section.rail');
  }
}

function buildSnapshotSectionComponents(snapshot: SnapshotResponse) {
  const sections: Array<[ProjectionSectionName, NonNullable<SnapshotResponse['sections']>[ProjectionSectionName] | undefined]> = [
    ['events', snapshot.sections?.events],
    ['governor', snapshot.sections?.governor],
    ['maritime', snapshot.sections?.maritime],
    ['rail', snapshot.sections?.rail],
  ];

  return sections.map(([name, section]) => ({
    id: name,
    label: formatSectionLabel(name),
    state: (section?.state ?? 'unknown') as RealtimeComponentState,
    source: section?.source ?? 'projection',
    updatedAt: section?.updated_at ?? 0,
    staleAfterMs: section?.stale_after_ms ?? 60_000,
    message: section?.last_error
      ?? (section?.state === 'stale' ? tf('poller.staleMessage', { section: formatSectionLabel(name) }) : undefined),
  }));
}

function buildFallbackComponents(input: {
  source: RealtimeSource;
  updatedAt: number;
  message: string;
}): RealtimeComponentStatus[] {
  return [
    {
      id: 'events',
      label: t('poller.section.events'),
      state: 'degraded' as const,
      source: input.source,
      updatedAt: input.updatedAt,
      staleAfterMs: 60_000,
      message: input.message,
    },
    {
      id: 'governor',
      label: t('poller.section.governor'),
      state: 'degraded' as const,
      source: input.source,
      updatedAt: input.updatedAt,
      staleAfterMs: 60_000,
      message: t('poller.fallback.governor'),
    },
    {
      id: 'maritime',
      label: t('poller.section.maritime'),
      state: 'down' as const,
      source: 'projection',
      updatedAt: 0,
      staleAfterMs: 300_000,
      message: t('poller.fallback.maritime'),
    },
    {
      id: 'rail',
      label: t('poller.section.rail'),
      state: 'down' as const,
      source: 'projection',
      updatedAt: 0,
      staleAfterMs: 300_000,
      message: t('poller.fallback.rail'),
    },
  ];
}

function buildProjectionRealtimeStatus(snapshot: SnapshotResponse, freshness: UnifiedPollResult['projectionFreshness']): RealtimeStatus {
  const components = buildSnapshotSectionComponents(snapshot);
  const sections = [
    ['events', snapshot.sections?.events],
    ['maritime', snapshot.sections?.maritime],
    ['rail', snapshot.sections?.rail],
  ] as const;

  const degradedSection = sections.find((entry) => entry[1]?.state === 'degraded' || entry[1]?.state === 'down');
  if (degradedSection) {
    const [name, section] = degradedSection;
    return {
      source: 'server',
      state: 'degraded',
      updatedAt: freshness.events || snapshot.generated_at || Date.now(),
      staleAfterMs: section?.stale_after_ms ?? 60_000,
      message: section?.last_error ? tf('poller.degradedMessage', { section: formatSectionLabel(name as ProjectionSectionName), state: section?.state ?? 'degraded', error: section.last_error }) : tf('poller.degradedNoError', { section: formatSectionLabel(name as ProjectionSectionName), state: section?.state ?? 'degraded' }),
      components,
    };
  }

  const staleSection = sections.find((entry) => entry[1]?.state === 'stale');
  if (staleSection) {
    const [name, section] = staleSection;
    return {
      source: 'server',
      state: 'stale',
      updatedAt: freshness.events || snapshot.generated_at || Date.now(),
      staleAfterMs: section?.stale_after_ms ?? 60_000,
      message: tf('poller.staleMessage', { section: formatSectionLabel(name as ProjectionSectionName) }),
      components,
    };
  }

  return {
    source: 'server',
    state: 'fresh',
    updatedAt: freshness.events || snapshot.generated_at || Date.now(),
    staleAfterMs: snapshot.sections?.events?.stale_after_ms ?? 60_000,
    components,
  };
}

function buildFallbackRealtimeStatus(input: {
  source: RealtimeSource;
  updatedAt: number;
  message: string;
}): RealtimeStatus {
  return {
    source: input.source,
    state: 'degraded',
    updatedAt: input.updatedAt,
    staleAfterMs: 60_000,
    message: input.message,
    components: buildFallbackComponents(input),
  };
}

export function createUnifiedPoller(options: UnifiedPollerOptions): UnifiedPoller {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let refreshMs = options.initialRefreshMs;
  let previousVessels: Vessel[] = [];
  let previousRailStatuses: RailLineStatus[] = [];
  let previousDomainOverrides: OperatorBundleDomainOverrides = {};

  function applyDynamicSectionRetention(
    result: UnifiedPollResult,
  ): UnifiedPollResult {
    const preserved = resolveDynamicSectionData({
      previousVessels,
      previousRailStatuses,
      previousDomainOverrides,
      result,
    });
    previousVessels = preserved.vessels;
    previousRailStatuses = preserved.railStatuses;
    previousDomainOverrides = preserved.domainOverrides;
    return {
      ...result,
      ...preserved,
    };
  }

  async function fetchSnapshot(): Promise<UnifiedPollResult> {
    const transportUpdatedAt = Date.now();
    const snapshotBaseUrl = options.snapshotBaseUrl ?? R2_FEED_BASE;

    // 1. Try unified snapshot from R2 CDN (1 request for all data)
    if (snapshotBaseUrl) {
      try {
        const snapshot = await fetchWithTimeout<SnapshotResponse>(
          `${snapshotBaseUrl}/feed/snapshot.json`,
        );
        if (snapshot && Array.isArray(snapshot.events)) {
          const projectionFreshness = deriveProjectionFreshness(snapshot);
          const realtimeStatus = buildProjectionRealtimeStatus(snapshot, projectionFreshness);
          return {
            events: parseSnapshotEvents(snapshot.events),
            governor: snapshot.governor ?? null,
            vessels: extractVessels(snapshot.maritime),
            railStatuses: extractRailStatuses(snapshot.rail),
            domainOverrides: extractDomainOverrides(snapshot),
            source: 'snapshot',
            updatedAt: realtimeStatus.updatedAt,
            realtimeStatus,
            projectionFreshness,
          };
        }
      } catch {
        // R2 snapshot unavailable, fall through
      }
    }

    // 2. Fallback: use individual fetch functions
    if (options.fallbackFetchEvents) {
      try {
        const { events, governor, source = 'fallback', updatedAt = transportUpdatedAt } = await options.fallbackFetchEvents();
        const realtimeStatus = buildFallbackRealtimeStatus({
          source,
          updatedAt,
          message: t('poller.fallback.transport'),
        });
        return {
          events,
          governor,
          vessels: [],
          railStatuses: [],
          domainOverrides: {},
          source: 'fallback',
          updatedAt: realtimeStatus.updatedAt,
          realtimeStatus,
          projectionFreshness: {
            events: updatedAt,
            maritime: 0,
            rail: 0,
          },
        };
      } catch {
        // All fallbacks failed
      }
    }

    // 3. Nothing worked — return empty
    return {
      events: [],
      governor: null,
      vessels: [],
      railStatuses: [],
      domainOverrides: {},
      source: 'fallback',
      updatedAt: transportUpdatedAt,
      realtimeStatus: buildFallbackRealtimeStatus({
        source: 'fallback',
        updatedAt: transportUpdatedAt,
        message: t('poller.fallback.unavailable'),
      }),
      projectionFreshness: {
        events: 0,
        maritime: 0,
        rail: 0,
      },
    };
  }

  function scheduleNext(): void {
    if (timer) clearTimeout(timer);
    if (!running) return;
    timer = setTimeout(async () => {
      try {
        const result = applyDynamicSectionRetention(await fetchSnapshot());
        options.onUpdate(result);
      } catch (err) {
        options.onError(err);
      } finally {
        scheduleNext();
      }
    }, refreshMs);
  }

  return {
    start() {
      running = true;
      scheduleNext();
    },
    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    async poll() {
      const result = applyDynamicSectionRetention(await fetchSnapshot());
      options.onUpdate(result);
      return result;
    },
    setRefreshMs(ms: number) {
      refreshMs = Math.max(10_000, ms); // 10s floor
      if (running) scheduleNext(); // Reschedule with new interval
    },
  };
}
