import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../presentation/missionStrip', async () => {
  const actual = await vi.importActual<typeof import('../../presentation/missionStrip')>(
    '../../presentation/missionStrip',
  );

  return {
    ...actual,
    buildMissionStripModel: vi.fn(actual.buildMissionStripModel),
  };
});

import type { RealtimeStatus, ServiceReadModel } from '../../ops/readModelTypes';
import { createEmptyServiceReadModel } from '../../ops/serviceReadModel';
import { buildMissionStripModel } from '../../presentation/missionStrip';
import { buildSystemBarState } from '../systemBar';

afterEach(() => {
  vi.clearAllMocks();
});

const realtimeStatus: RealtimeStatus = {
  source: 'server',
  state: 'fresh',
  updatedAt: Date.parse('2026-03-06T10:00:00.000Z'),
  staleAfterMs: 60_000,
};

const readModel: ServiceReadModel = {
  currentEvent: {
    id: 'eq-1',
    lat: 35.6,
    lng: 139.7,
    depth_km: 28,
    magnitude: 7.1,
    time: Date.parse('2026-03-06T09:58:00.000Z'),
    faultType: 'interface',
    tsunami: true,
    place: { text: 'Sagami corridor' },
  },
  eventTruth: {
    source: 'server',
    revision: 'r2',
    issuedAt: Date.parse('2026-03-06T09:58:10.000Z'),
    receivedAt: Date.parse('2026-03-06T09:58:40.000Z'),
    observedAt: Date.parse('2026-03-06T09:58:00.000Z'),
    supersedes: 'r1',
    confidence: 'high',
    revisionCount: 2,
    sources: ['server', 'usgs'],
    hasConflictingRevision: true,
    divergenceSeverity: 'minor',
    magnitudeSpread: 0.1,
    depthSpreadKm: 0,
    locationSpreadKm: 0,
    tsunamiMismatch: false,
    faultTypeMismatch: false,
  },
  viewport: {
    center: { lat: 35.6, lng: 139.7 },
    zoom: 9.2,
    bounds: [138.8, 34.9, 140.1, 36.1],
    tier: 'regional',
    activeRegion: 'kanto',
  },
  nationalSnapshot: null,
  systemHealth: {
    level: 'watch',
    headline: 'Conflicting source revisions detected',
    detail: '2 revisions from server/usgs require operator review.',
    flags: ['revision-conflict'],
  },
  operationalOverview: {
    selectionReason: 'retain-current',
    selectionSummary: 'Operational focus retained on the current incident',
    impactSummary: 'No assets in elevated posture',
    visibleAffectedAssetCount: 0,
    nationalAffectedAssetCount: 0,
    topRegion: null,
    topSeverity: 'clear',
  },
  bundleSummaries: {},
  nationalExposureSummary: [],
  visibleExposureSummary: [],
  nationalPriorityQueue: [],
  visiblePriorityQueue: [],
  freshnessStatus: realtimeStatus,
  operationalLatency: {
    ingestLagSeconds: 30,
    sourceLagSeconds: 110,
    eventAgeSeconds: 120,
  },
};

describe('buildSystemBarState', () => {
  it('surfaces active region and revision conflict in the system bar state', () => {
    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 4,
      readModel,
      realtimeStatus,
    });

    expect(state.regionLabel).toBe('Kanto');
    expect(state.statusText).toContain('Event active');
    expect(state.statusText).toContain('4 events');
    expect(state.statusText).toContain('server fresh');
    expect(state.statusText).toContain('health watch');
    expect(state.statusText).toContain('conflict');
    expect(state.statusText).toContain('lag 30s ingest');
    expect(state.statusMode).toBe('event');
  });

  it('surfaces material divergence when revision disagreement is material', () => {
    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 2,
      readModel: {
        ...readModel,
        eventTruth: {
          ...readModel.eventTruth!,
          divergenceSeverity: 'material',
          locationSpreadKm: 28,
        },
        systemHealth: {
          ...readModel.systemHealth,
          flags: ['revision-conflict', 'material-divergence'],
        },
      },
      realtimeStatus,
    });

    expect(state.statusText).toContain('divergence');
  });

  it('falls back to Japan-wide calm wording when no viewport or truth is available', () => {
    const state = buildSystemBarState({
      mode: 'calm',
      eventCount: 0,
      readModel: createEmptyServiceReadModel({
        source: 'usgs',
        state: 'degraded',
        updatedAt: 0,
        staleAfterMs: 60_000,
        message: 'fallback active',
      }),
      realtimeStatus: {
        source: 'usgs',
        state: 'degraded',
        updatedAt: 0,
        staleAfterMs: 60_000,
        message: 'fallback active',
      },
    });

    expect(state.regionLabel).toBe('Japan');
    expect(state.statusText).toContain('System calm');
    expect(state.statusText).toContain('usgs degraded');
    expect(state.statusMode).toBe('calm');
  });

  it('shows an explicit degraded status message when realtime health drops', () => {
    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 1,
      readModel,
      realtimeStatus: {
        source: 'server',
        state: 'degraded',
        updatedAt: 0,
        staleAfterMs: 60_000,
        message: 'Realtime poll failed',
        components: [
          {
            id: 'maritime',
            label: 'Maritime',
            state: 'degraded',
            source: 'aisstream',
            updatedAt: Date.parse('2026-03-06T09:59:00.000Z'),
            staleAfterMs: 300_000,
            message: 'AISstream timeout',
          },
        ],
      },
    });

    expect(state.statusText).toContain('server degraded');
    expect(state.statusText).toContain('health watch');
    expect(state.statusText).toContain('Maritime DEGRADED');
    expect(state.statusText).toContain('AISstream timeout');
  });

  it('falls back to Japan at national zoom even if the viewport center is in Kanto', () => {
    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 4,
      readModel: {
        ...readModel,
        viewport: {
          ...readModel.viewport!,
          tier: 'national',
        },
      },
      realtimeStatus,
    });

    expect(state.regionLabel).toBe('Japan');
  });

  it('stays aligned with the mission strip freshness and alert wording', () => {
    const degradedRealtimeStatus: RealtimeStatus = {
      source: 'server',
      state: 'degraded',
      updatedAt: 0,
      staleAfterMs: 60_000,
      message: 'Realtime poll failed',
      components: [
        {
          id: 'maritime',
          label: 'Maritime',
          state: 'degraded',
          source: 'aisstream',
          updatedAt: Date.parse('2026-03-06T09:59:00.000Z'),
          staleAfterMs: 300_000,
          message: 'AISstream timeout',
        },
      ],
    };

    const missionStrip = buildMissionStripModel({
      mode: 'event',
      activeViewId: 'national-impact',
      activeBundleId: 'seismic',
      density: 'standard',
      region: {
        tier: 'regional',
        activeRegion: 'kanto',
      },
      freshness: {
        source: degradedRealtimeStatus.source,
        state: degradedRealtimeStatus.state,
        message: degradedRealtimeStatus.message,
        components: degradedRealtimeStatus.components?.map((component) => ({
          id: component.id,
          label: component.label,
          state: component.state,
          message: component.message,
        })),
      },
      trust: {
        healthLevel: readModel.systemHealth.level,
        eventTruth: {
          confidence: readModel.eventTruth!.confidence,
          hasConflictingRevision: readModel.eventTruth!.hasConflictingRevision,
          divergenceSeverity: readModel.eventTruth!.divergenceSeverity,
        },
      },
    });

    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 1,
      readModel,
      realtimeStatus: degradedRealtimeStatus,
    });

    expect(state.regionLabel).toBe(missionStrip.regionLabel);
    expect(state.statusText).toContain(missionStrip.headline);
    expect(state.statusText).toContain(
      missionStrip.cells.find((cell) => cell.id === 'freshness')!.value,
    );
    expect(state.statusText).toContain(missionStrip.alerts[0]!.label);
  });

  it('keeps legacy statusTone tied to health and realtime state only', () => {
    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 1,
      readModel: {
        ...readModel,
        eventTruth: {
          ...readModel.eventTruth!,
          hasConflictingRevision: true,
          divergenceSeverity: 'minor',
        },
        systemHealth: {
          ...readModel.systemHealth,
          level: 'nominal',
          headline: 'Primary realtime feed healthy',
          detail: 'No source conflicts or realtime degradation detected.',
          flags: [],
        },
      },
      realtimeStatus,
    });

    expect(state.statusTone).toBe('nominal');
    expect(state.statusText).toContain('conflict');
  });

  it('uses structured truth state for divergence branching even if mission-strip trust copy changes', () => {
    vi.mocked(buildMissionStripModel).mockReturnValueOnce({
      regionLabel: 'Kanto',
      headline: 'Event active',
      cells: [
        { id: 'view', label: 'View', value: 'National Impact', tone: 'nominal' },
        { id: 'bundle', label: 'Bundle', value: 'Seismic', tone: 'nominal' },
        { id: 'density', label: 'Density', value: 'STANDARD', tone: 'nominal' },
        { id: 'freshness', label: 'Freshness', value: 'server fresh', tone: 'nominal' },
        { id: 'trust', label: 'Trust', value: 'truth review', tone: 'watch' },
      ],
      alerts: [],
    });

    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 2,
      readModel: {
        ...readModel,
        eventTruth: {
          ...readModel.eventTruth!,
          divergenceSeverity: 'material',
        },
      },
      realtimeStatus,
    });

    expect(state.statusText).toContain('divergence');
  });

  it('uses structured truth state for conflict branching even if mission-strip trust copy changes', () => {
    vi.mocked(buildMissionStripModel).mockReturnValueOnce({
      regionLabel: 'Kanto',
      headline: 'Event active',
      cells: [
        { id: 'view', label: 'View', value: 'National Impact', tone: 'nominal' },
        { id: 'bundle', label: 'Bundle', value: 'Seismic', tone: 'nominal' },
        { id: 'density', label: 'Density', value: 'STANDARD', tone: 'nominal' },
        { id: 'freshness', label: 'Freshness', value: 'server fresh', tone: 'nominal' },
        { id: 'trust', label: 'Trust', value: 'truth review', tone: 'watch' },
      ],
      alerts: [],
    });

    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 2,
      readModel: {
        ...readModel,
        eventTruth: {
          ...readModel.eventTruth!,
          hasConflictingRevision: true,
          divergenceSeverity: 'minor',
        },
      },
      realtimeStatus,
    });

    expect(state.statusText).toContain('conflict');
  });

  it('includes fps posture when performance degrades', () => {
    const state = buildSystemBarState({
      mode: 'event',
      eventCount: 2,
      readModel,
      realtimeStatus,
      performanceStatus: {
        fps: 28.4,
        sampledAt: Date.parse('2026-03-06T10:00:30.000Z'),
        tone: 'degraded',
        minFps: 45,
      },
    });

    expect(state.statusText).toContain('fps 28 degraded');
  });
});
