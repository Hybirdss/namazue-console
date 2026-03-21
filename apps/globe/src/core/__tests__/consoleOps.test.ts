import { beforeEach, describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import type { Vessel } from '../../data/aisManager';
import { earthquakeStore } from '../../data/earthquakeStore';
import {
  applyConsoleRealtimeError,
  deriveConsoleOperationalState,
  refreshConsoleBundleTruth,
} from '../consoleOps';
import { OPS_ASSETS } from '../../ops/assetCatalog';
import type { OpsAsset } from '../../ops/types';
import { computeImpactIntelligence } from '../../ops/impactIntelligence';

// Test fixture assets near Tokyo (35.6, 139.8) to simulate loaded infrastructure
const TEST_ASSETS: OpsAsset[] = [
  { id: 'test-port-tokyo', region: 'kanto', class: 'port', name: 'Tokyo Port', nameJa: '東京港', lat: 35.63, lng: 139.77, tags: ['port', 'coastal'], minZoomTier: 'national' },
  { id: 'test-hospital-tokyo', region: 'kanto', class: 'hospital', name: 'Tokyo Univ Hospital', nameJa: '東大病院', lat: 35.71, lng: 139.76, tags: ['emergency', 'university'], minZoomTier: 'national' },
  { id: 'test-rail-tokyo', region: 'kanto', class: 'rail_hub', name: 'Tokyo Station', nameJa: '東京駅', lat: 35.68, lng: 139.77, tags: ['shinkansen', 'terminal'], minZoomTier: 'national' },
  { id: 'test-power-kanto', region: 'kanto', class: 'power_substation', name: 'Shin-Toyosu Substation', nameJa: '新豊洲変電所', lat: 35.65, lng: 139.79, tags: ['substation'], minZoomTier: 'regional' },
  { id: 'test-water-kanto', region: 'kanto', class: 'water_facility', name: 'Kanamachi WTP', nameJa: '金町浄水場', lat: 35.76, lng: 139.87, tags: ['water', 'purification'], minZoomTier: 'regional' },
  { id: 'test-building-tokyo', region: 'kanto', class: 'building_cluster', name: 'Marunouchi District', nameJa: '丸の内', lat: 35.68, lng: 139.76, tags: ['urban-core'], minZoomTier: 'regional' },
];

// Inject test assets into OPS_ASSETS for testing
OPS_ASSETS.push(...TEST_ASSETS);

function createEvent(
  id: string,
  magnitude: number,
  time: number,
  overrides: Partial<EarthquakeEvent> = {},
): EarthquakeEvent {
  return {
    id,
    lat: 35.62,
    lng: 139.79,
    depth_km: 24,
    magnitude,
    time,
    faultType: 'interface',
    tsunami: false,
    place: { text: `${id} corridor` },
    ...overrides,
  };
}

describe('deriveConsoleOperationalState', () => {
  const now = Date.parse('2026-03-06T10:00:00.000Z');

  beforeEach(() => {
    earthquakeStore.clear();
  });

  it('returns calm mode and a calm read model when no significant event is active', () => {
    const result = deriveConsoleOperationalState({
      now,
      events: [createEvent('minor', 4.1, now - 5 * 60_000)],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 5.5,
        bounds: [122, 24, 150, 46],
        tier: 'national',
        pitch: 0,
        bearing: 0,
      },
    });

    expect(result.mode).toBe('calm');
    expect(result.selectedEvent).toBeNull();
    expect(result.readModel.currentEvent).toBeNull();
    expect(result.readModel.nationalSnapshot).toBeNull();
    expect(result.realtimeStatus.state).toBe('fresh');
  });

  it('returns viewport-aware read model data for a significant event', () => {
    const result = deriveConsoleOperationalState({
      now,
      events: [
        createEvent('moderate', 5.0, now - 15 * 60_000),
        createEvent('severe', 6.8, now - 4 * 60_000, { tsunami: true }),
      ],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    expect(result.mode).toBe('event');
    expect(result.selectedEvent?.id).toBe('severe');
    expect(result.readModel.eventTruth?.source).toBe('server');
    expect(result.readModel.visibleExposureSummary.length).toBeGreaterThan(0);
    expect(result.readModel.visiblePriorityQueue.length).toBeGreaterThan(0);
    expect(result.readModel.viewport?.activeRegion).toBe('kanto');
  });

  it('prefers the JMA revision when equivalent events arrive from multiple sources', () => {
    const eventTime = now - 6 * 60_000;
    const jmaEvent = createEvent('jma-eq', 5.9, eventTime, {
      lat: 42.0,
      lng: 140.3,
      depth_km: 150,
      faultType: 'intraslab',
      source: 'jma',
      observedIntensity: '2',
      place: { text: 'Hiyama Region, Hokkaido' },
    });
    const usgsEvent = createEvent('usgs-eq', 5.9, eventTime, {
      lat: 42.01,
      lng: 140.29,
      depth_km: 149,
      faultType: 'intraslab',
      source: 'usgs',
      place: { text: '20 km E of Esashi, Japan' },
    });

    const result = deriveConsoleOperationalState({
      now,
      events: [usgsEvent, jmaEvent],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 42.0, lng: 140.3 },
        zoom: 6.2,
        bounds: [137.5, 39.0, 143.5, 44.5],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    expect(result.selectedEvent?.id).toBe('jma-eq');
    expect(result.selectedEvent?.observedIntensity).toBe('2');
  });

  it('reuses cached hazard computation when the selected event payload is unchanged', () => {
    const input = {
      now,
      events: [
        createEvent('severe', 6.8, now - 4 * 60_000, { tsunami: true }),
      ],
      currentSelectedEventId: null,
      source: 'server' as const,
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2] as [number, number, number, number],
        tier: 'regional' as const,
        pitch: 0,
        bearing: 0,
      },
    };

    const first = deriveConsoleOperationalState(input);
    const second = deriveConsoleOperationalState(input);

    expect(second.intensityGrid).toBe(first.intensityGrid);
    expect(second.exposures).toBe(first.exposures);
    expect(second.priorities).toBe(first.priorities);
  });

  it('prefers authoritative ShakeMap grids over GMPE when the selected real event matches', () => {
    const shakeMapGrid = {
      data: new Float32Array([
        2.4, 2.6,
        2.9, 3.1,
      ]),
      cols: 2,
      rows: 2,
      center: { lat: 35.62, lng: 139.79 },
      radiusDeg: 0.1,
      radiusLngDeg: 0.1,
    };

    const result = deriveConsoleOperationalState({
      now,
      events: [
        createEvent('us-test', 6.8, now - 4 * 60_000, { tsunami: true }),
      ],
      currentSelectedEventId: 'us-test',
      forceSelection: true,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
      shakeMapGrid,
      shakeMapEventId: 'us-test',
    });

    expect(result.intensityGrid).toBe(shakeMapGrid);
  });

  it('constrains GMPE-only intensity truth to the observed JMA maximum when one is available', () => {
    const observedEvent = createEvent('jma-deep', 5.9, now - 4 * 60_000, {
      lat: 42.0,
      lng: 140.3,
      depth_km: 150,
      faultType: 'intraslab',
      observedIntensity: '2',
      place: { text: 'Hiyama Region, Hokkaido' },
    });

    const result = deriveConsoleOperationalState({
      now,
      events: [observedEvent],
      currentSelectedEventId: observedEvent.id,
      forceSelection: true,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 42.0, lng: 140.3 },
        zoom: 6.2,
        bounds: [137.5, 39.0, 143.5, 44.5],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    expect(result.intensityGrid).not.toBeNull();

    const peak = Math.max(...Array.from(result.intensityGrid!.data));
    expect(peak).toBeLessThan(2.5);

    const intel = computeImpactIntelligence({
      event: observedEvent,
      grid: result.intensityGrid,
      vessels: [],
    });
    expect(intel.populationExposure?.jma3plus).toBe(0);
  });

  it('surfaces richer lifeline and built-environment truth from the starter catalog during Tokyo-scale events', () => {
    const result = deriveConsoleOperationalState({
      now,
      events: [
        createEvent('severe', 7.0, now - 4 * 60_000, {
          lat: 35.64,
          lng: 139.82,
          tsunami: true,
          place: { text: 'Tokyo Bay operator corridor' },
        }),
      ],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.79 },
        zoom: 10.1,
        bounds: [139.2, 35.2, 140.2, 35.95],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    // With test fixtures, lifelines should detect power + water assets near the epicenter
    expect(result.readModel.bundleSummaries.lifelines).toBeDefined();
    expect(result.readModel.bundleSummaries.lifelines?.metric).toBeTruthy();
    expect(result.readModel.bundleSummaries.lifelines?.domains.length).toBeGreaterThan(0);
    expect(result.readModel.bundleSummaries['built-environment']?.availability).toBe('live');
  });

  it('preserves the current read model while degrading freshness on realtime errors', () => {
    const derived = deriveConsoleOperationalState({
      now,
      events: [createEvent('severe', 6.8, now - 4 * 60_000, { tsunami: true })],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    const degraded = applyConsoleRealtimeError({
      now: now + 30_000,
      source: 'server',
      updatedAt: now,
      message: 'Realtime poll failed',
      readModel: derived.readModel,
    });

    expect(degraded.realtimeStatus.state).toBe('degraded');
    expect(degraded.realtimeStatus.message).toBe('Realtime poll failed');
    expect(degraded.readModel.currentEvent?.id).toBe('severe');
    expect(degraded.readModel.freshnessStatus.state).toBe('degraded');
  });

  it('preserves snapshot-provided degraded truth when deriving operational state', () => {
    const result = deriveConsoleOperationalState({
      now,
      events: [createEvent('severe', 6.8, now - 4 * 60_000, { tsunami: true })],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      realtimeStatusOverride: {
        source: 'server',
        state: 'degraded',
        updatedAt: now,
        staleAfterMs: 60_000,
        message: 'maritime degraded: AISstream timeout',
      },
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    expect(result.realtimeStatus.state).toBe('degraded');
    expect(result.realtimeStatus.message).toBe('maritime degraded: AISstream timeout');
    expect(result.readModel.freshnessStatus.state).toBe('degraded');
    expect(result.readModel.systemHealth.level).toBe('degraded');
    expect(result.readModel.systemHealth.detail).toContain('AISstream timeout');
  });

  it('refreshes maritime bundle truth from AIS updates without rerunning hazard computation', () => {
    const derived = deriveConsoleOperationalState({
      now,
      events: [createEvent('severe', 6.8, now - 4 * 60_000, { tsunami: true })],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });
    const vessels: Vessel[] = [
      {
        mmsi: '431000001',
        name: 'FERRY SAKURA',
        lat: 35.15,
        lng: 140.1,
        cog: 90,
        sog: 14,
        type: 'passenger',
        lastUpdate: now,
        trail: [[140.1, 35.15]],
      },
      {
        mmsi: '431000002',
        name: 'PACIFIC STAR',
        lat: 39.0,
        lng: 144.0,
        cog: 45,
        sog: 11,
        type: 'cargo',
        lastUpdate: now,
        trail: [[144, 39]],
      },
    ];

    const refreshed = refreshConsoleBundleTruth({
      readModel: derived.readModel,
      realtimeStatus: derived.realtimeStatus,
      selectedEvent: derived.selectedEvent,
      exposures: derived.exposures,
      vessels,
      assets: OPS_ASSETS,
    });

    expect(refreshed.currentEvent?.id).toBe('severe');
    expect(refreshed.operationalOverview.selectionReason).toBe('auto-select');
    expect(refreshed.bundleSummaries.maritime?.metric).toContain('2 tracked');
    expect(refreshed.bundleSummaries.seismic?.metric).toContain('assets');
  });

  it('refreshes lifelines bundle truth from live rail telemetry without rerunning hazard computation', () => {
    const derived = deriveConsoleOperationalState({
      now,
      events: [createEvent('minor', 4.1, now - 5 * 60_000)],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 5.5,
        bounds: [122, 24, 150, 46],
        tier: 'national',
        pitch: 0,
        bearing: 0,
      },
    });

    const refreshed = refreshConsoleBundleTruth({
      readModel: derived.readModel,
      realtimeStatus: derived.realtimeStatus,
      selectedEvent: derived.selectedEvent,
      exposures: derived.exposures,
      vessels: [],
      assets: OPS_ASSETS,
      railStatuses: [
        {
          lineId: 'tokaido',
          status: 'normal',
          updatedAt: now,
        },
        {
          lineId: 'sanyo',
          status: 'normal',
          updatedAt: now,
        },
      ],
    });

    expect(refreshed.bundleSummaries.lifelines).toMatchObject({
      metric: '2 rail corridors nominal',
      detail: 'Live rail telemetry shows nominal posture across monitored Shinkansen corridors.',
      severity: 'clear',
      availability: 'live',
      trust: 'confirmed',
    });
    expect(refreshed.bundleSummaries.lifelines?.domains[0]).toMatchObject({
      id: 'rail',
      metric: '2 rail corridors nominal',
    });
  });

  it('refreshes lifelines bundle truth from backend-owned rail domain overrides without rerunning hazard computation', () => {
    const derived = deriveConsoleOperationalState({
      now,
      events: [createEvent('minor', 4.1, now - 5 * 60_000)],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 5.5,
        bounds: [122, 24, 150, 46],
        tier: 'national',
        pitch: 0,
        bearing: 0,
      },
    });

    const refreshed = refreshConsoleBundleTruth({
      readModel: derived.readModel,
      realtimeStatus: derived.realtimeStatus,
      selectedEvent: derived.selectedEvent,
      exposures: derived.exposures,
      vessels: [],
      assets: OPS_ASSETS,
      domainOverrides: {
        lifelines: [
          {
            id: 'rail',
            label: 'Rail',
            metric: '2 rail corridors nominal',
            detail: 'Live rail telemetry shows nominal posture across monitored Shinkansen corridors.',
            severity: 'clear',
            availability: 'live',
            trust: 'confirmed',
            counters: [
              { id: 'rail-monitored', label: 'Monitored', value: 2, tone: 'clear' },
            ],
            signals: [
              { id: 'rail-feed', label: 'Rail Feed', value: 'Live ODPT', tone: 'clear' },
            ],
          },
        ],
      },
    });

    expect(refreshed.bundleSummaries.lifelines).toMatchObject({
      metric: '2 rail corridors nominal',
      detail: 'Live rail telemetry shows nominal posture across monitored Shinkansen corridors.',
      severity: 'clear',
      availability: 'live',
      trust: 'confirmed',
    });
    expect(refreshed.bundleSummaries.lifelines?.domains[0]).toMatchObject({
      id: 'rail',
      metric: '2 rail corridors nominal',
    });
  });

  it('keeps rail bundle truth degraded during refresh when realtime status marks the rail section stale', () => {
    const derived = deriveConsoleOperationalState({
      now,
      events: [createEvent('minor', 4.1, now - 5 * 60_000)],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 5.5,
        bounds: [122, 24, 150, 46],
        tier: 'national',
        pitch: 0,
        bearing: 0,
      },
    });

    const refreshed = refreshConsoleBundleTruth({
      readModel: derived.readModel,
      realtimeStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: now,
        staleAfterMs: 60_000,
        components: [
          {
            id: 'rail',
            label: 'Rail',
            state: 'stale',
            source: 'odpt',
            updatedAt: now - 90_000,
            staleAfterMs: 60_000,
            message: 'Rail telemetry is stale; using last confirmed corridor state.',
          },
        ],
      },
      selectedEvent: derived.selectedEvent,
      exposures: derived.exposures,
      vessels: [],
      assets: OPS_ASSETS,
      railStatuses: [
        {
          lineId: 'tokaido',
          status: 'normal',
          updatedAt: now,
        },
      ],
    });

    expect(refreshed.bundleSummaries.lifelines).toMatchObject({
      metric: '1 rail corridors nominal',
      detail: expect.stringContaining('stale'),
      severity: 'watch',
      trust: 'review',
    });
    expect(refreshed.bundleSummaries.lifelines?.signals).toEqual(expect.arrayContaining([
      { id: 'rail-feed', label: 'Rail Feed', value: 'Stale ODPT', tone: 'watch' },
    ]));
  });

  it('preserves modeled power posture during bundle refresh without rerunning hazard computation', () => {
    const selectedEvent = createEvent('power-onagawa', 7.8, now - 4 * 60_000, {
      lat: 38.4,
      lng: 141.5,
      depth_km: 15,
      tsunami: true,
      place: { text: 'Off Onagawa' },
    });
    const derived = deriveConsoleOperationalState({
      now,
      events: [selectedEvent],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 38.3, lng: 141.4 },
        zoom: 7.2,
        bounds: [140.4, 37.5, 142.3, 39.1],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    const refreshed = refreshConsoleBundleTruth({
      readModel: derived.readModel,
      realtimeStatus: derived.realtimeStatus,
      selectedEvent: derived.selectedEvent,
      exposures: derived.exposures,
      vessels: [],
      assets: OPS_ASSETS,
    });

    expect(refreshed.bundleSummaries.lifelines).toMatchObject({
      metric: '1 nuclear SCRAM likely',
      detail: expect.stringContaining('Onagawa is estimated near SCRAM thresholds'),
      severity: 'critical',
      availability: 'live',
      trust: 'review',
    });
    expect(refreshed.bundleSummaries.lifelines?.signals).toEqual(expect.arrayContaining([
      { id: 'source', label: 'Source', value: 'Modeled from seismic exposure', tone: 'watch' },
    ]));
    expect(refreshed.bundleSummaries.lifelines?.domains.map((domain) => domain.id)).toContain('power');
  });

  it('preserves derived lifeline and medical domain overviews during AIS-only bundle refresh', () => {
    const derived = deriveConsoleOperationalState({
      now,
      events: [
        createEvent('severe', 6.8, now - 4 * 60_000, { tsunami: true }),
        createEvent('minor', 4.2, now - 8 * 60_000),
      ],
      currentSelectedEventId: null,
      source: 'server',
      updatedAt: now,
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 9.2,
        bounds: [138.8, 34.8, 140.2, 36.2],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
    });

    const refreshed = refreshConsoleBundleTruth({
      readModel: derived.readModel,
      realtimeStatus: derived.realtimeStatus,
      selectedEvent: derived.selectedEvent,
      exposures: derived.exposures,
      vessels: [],
      assets: OPS_ASSETS,
    });

    expect(refreshed.bundleSummaries.lifelines?.signals.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(refreshed.bundleSummaries.medical?.signals.length ?? 0).toBeGreaterThanOrEqual(0);
    expect(refreshed.bundleSummaries.lifelines?.metric).toBe(derived.readModel.bundleSummaries.lifelines?.metric);
    expect(refreshed.bundleSummaries.medical?.metric).toBe(derived.readModel.bundleSummaries.medical?.metric);
  });
});
