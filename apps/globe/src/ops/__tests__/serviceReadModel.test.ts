import { describe, expect, it } from 'vitest';

import { buildServiceReadModel } from '../serviceReadModel';
import { buildCanonicalEventEnvelope } from '../../data/eventEnvelope';
import type { CanonicalEventEnvelope } from '../../data/eventEnvelope';

describe('buildServiceReadModel', () => {
  it('returns national and viewport-ready summaries from the selected event and ops priorities', () => {
    const model = buildServiceReadModel({
      selectedEventRevisionHistory: [
        buildCanonicalEventEnvelope({
          event: {
            id: 'eq-1',
            lat: 35,
            lng: 139,
            depth_km: 30,
            magnitude: 7.0,
            time: 1_700_000_000_000,
            faultType: 'interface',
            tsunami: true,
            place: { text: 'Sagami corridor' },
          },
          source: 'usgs',
          issuedAt: 1_700_000_001_000,
          receivedAt: 1_700_000_001_500,
        }),
      ] satisfies CanonicalEventEnvelope[],
      selectedEvent: {
        id: 'eq-1',
        lat: 35,
        lng: 139,
        depth_km: 30,
        magnitude: 7.1,
        time: 1_700_000_000_000,
        faultType: 'interface',
        tsunami: true,
        place: { text: 'Sagami corridor' },
      },
      selectedEventEnvelope: buildCanonicalEventEnvelope({
        event: {
          id: 'eq-1',
          lat: 35,
          lng: 139,
          depth_km: 30,
          magnitude: 7.1,
          time: 1_700_000_000_000,
          faultType: 'interface',
          tsunami: true,
          place: { text: 'Sagami corridor' },
        },
        source: 'server',
        issuedAt: 1_700_000_002_000,
        receivedAt: 1_700_000_003_000,
      }),
      selectionReason: 'auto-select',
      tsunamiAssessment: {
        risk: 'moderate',
        confidence: 'high',
        factors: ['offshore'],
        locationType: 'offshore',
        coastDistanceKm: 12,
        faultType: 'interface',
      },
      impactResults: null,
      assets: [
        {
          id: 'tokyo-port',
          region: 'kanto',
          class: 'port',
          name: 'Port of Tokyo',
          lat: 35.62,
          lng: 139.79,
          tags: ['coastal'],
          minZoomTier: 'regional',
        },
        {
          id: 'sendai-port',
          region: 'tohoku',
          class: 'port',
          name: 'Port of Sendai',
          lat: 38.25,
          lng: 141.02,
          tags: ['coastal'],
          minZoomTier: 'regional',
        },
      ],
      viewport: {
        center: { lat: 35.6, lng: 139.7 },
        zoom: 9.5,
        bounds: [138.8, 34.9, 140.1, 36.1],
        tier: 'regional',
        activeRegion: 'kanto',
      },
      exposures: [
        {
          assetId: 'tokyo-port',
          severity: 'priority',
          score: 72,
          summary: 'Port exposure elevated',
          reasons: ['coastal'],
        },
        {
          assetId: 'sendai-port',
          severity: 'watch',
          score: 24,
          summary: 'Northern port posture elevated',
          reasons: ['regional'],
        },
      ],
      priorities: [
        {
          id: 'prio-1',
          assetId: 'tokyo-port',
          severity: 'priority',
          title: 'Verify port access',
          rationale: 'Coastal exposure elevated',
        },
        {
          id: 'prio-2',
          assetId: 'sendai-port',
          severity: 'watch',
          title: 'Monitor Sendai port posture',
          rationale: 'Regional watch posture elevated',
        },
      ],
      maritimeOverview: {
        totalTracked: 122,
        highPriorityTracked: 34,
        underwayCount: 98,
        anchoredCount: 24,
        summary: '122 tracked · 34 high-priority · 98 underway',
      },
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
      },
    });

    expect(model.currentEvent?.id).toBe('eq-1');
    expect(model.eventTruth?.source).toBe('server');
    expect(model.eventTruth?.confidence).toBe('high');
    expect(model.eventTruth?.revisionCount).toBe(2);
    expect(model.eventTruth?.sources).toEqual(['usgs', 'server']);
    expect(model.eventTruth?.hasConflictingRevision).toBe(true);
    expect(model.operationalLatency).toEqual({
      ingestLagSeconds: 1,
      sourceLagSeconds: 3,
      eventAgeSeconds: 5,
    });
    expect(model.viewport?.activeRegion).toBe('kanto');
    expect(model.nationalExposureSummary).toHaveLength(2);
    expect(model.visibleExposureSummary.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(model.nationalPriorityQueue).toHaveLength(2);
    expect(model.visiblePriorityQueue.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(model.nationalSnapshot?.summary).toMatch(/Shizuoka/);
    expect(model.systemHealth.level).toBe('watch');
    expect(model.systemHealth.flags).toContain('revision-conflict');
    expect(model.operationalOverview.selectionReason).toBe('auto-select');
    expect(model.operationalOverview.visibleAffectedAssetCount).toBe(1);
    expect(model.operationalOverview.nationalAffectedAssetCount).toBe(2);
    expect(model.operationalOverview.topRegion).toBe('kanto');
    expect(model.operationalOverview.impactSummary).toMatch(/1 visible asset/);
    expect(model.bundleSummaries.seismic?.metric).toContain('2 assets');
    expect(model.bundleSummaries.seismic?.trust).toBe('review');
    expect(model.bundleSummaries.seismic?.counters).toEqual([
      { id: 'affected-assets', label: 'Affected', value: 2, tone: 'priority' },
      { id: 'visible-assets', label: 'Visible', value: 1, tone: 'priority' },
    ]);
    expect(model.bundleSummaries.lifelines).toMatchObject({
      metric: '9 generation sites in impact zone',
      detail: 'Yokosuka Thermal sits inside the current shake field and requires continuity verification.',
      trust: 'review',
    });
    expect(model.bundleSummaries.lifelines?.domains[0]).toMatchObject({
      id: 'power',
      metric: '9 generation sites in impact zone',
      trust: 'review',
    });
    expect(model.bundleSummaries.medical).toMatchObject({
      metric: 'No medical access posture shift',
      detail: 'Medical access and hospital readiness are standing by.',
      trust: 'pending',
    });
    expect(model.bundleSummaries.maritime?.metric).toContain('122 tracked');
    expect(model.bundleSummaries.maritime?.detail).toContain('Port of Tokyo');
    expect(model.bundleSummaries.maritime?.counters).toEqual([
      { id: 'tracked', label: 'Tracked', value: 122, tone: 'clear' },
      { id: 'high-priority', label: 'High Priority', value: 34, tone: 'priority' },
      { id: 'underway', label: 'Underway', value: 98, tone: 'watch' },
    ]);
  });

  it('falls back to the national view when visible assets are not provided yet', () => {
    const model = buildServiceReadModel({
      selectedEvent: null,
      selectedEventEnvelope: null,
      selectedEventRevisionHistory: [],
      selectionReason: null,
      tsunamiAssessment: null,
      impactResults: null,
      assets: [
        {
          id: 'tokyo-port',
          region: 'kanto',
          class: 'port',
          name: 'Port of Tokyo',
          lat: 35.62,
          lng: 139.79,
          tags: ['coastal'],
          minZoomTier: 'regional',
        },
      ],
      viewport: null,
      exposures: [
        {
          assetId: 'tokyo-port',
          severity: 'priority',
          score: 72,
          summary: 'Port exposure elevated',
          reasons: ['coastal'],
        },
      ],
      priorities: [
        {
          id: 'prio-1',
          assetId: 'tokyo-port',
          severity: 'priority',
          title: 'Verify port access',
          rationale: 'Coastal exposure elevated',
        },
      ],
      maritimeOverview: null,
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
      },
    });

    expect(model.nationalExposureSummary.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(model.visibleExposureSummary.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(model.visiblePriorityQueue.map((entry) => entry.assetId)).toEqual(['tokyo-port']);
    expect(model.systemHealth.level).toBe('nominal');
    expect(model.operationalOverview.impactSummary).toMatch(/1 assets? in elevated posture nationwide/);
    expect(model.bundleSummaries.lifelines?.detail).toContain('standing by');
    expect(model.bundleSummaries.maritime?.trust).toBe('confirmed');
    expect(model.bundleSummaries.maritime?.counters).toEqual([]);
    expect(model.operationalLatency).toBeNull();
  });

  it('keeps lifelines live from rail telemetry even before feed-backed asset exposure lands', () => {
    const model = buildServiceReadModel({
      selectedEvent: null,
      selectedEventEnvelope: null,
      selectedEventRevisionHistory: [],
      selectionReason: null,
      tsunamiAssessment: null,
      impactResults: null,
      assets: [],
      viewport: null,
      exposures: [],
      priorities: [],
      maritimeOverview: null,
      railStatuses: [
        {
          lineId: 'tokaido',
          status: 'delayed',
          cause: 'Signal inspection',
          updatedAt: 1_700_000_005_000,
        },
      ],
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
      },
    });

    expect(model.bundleSummaries.lifelines).toMatchObject({
      metric: '1 rail corridors delayed',
      detail: 'Tokaido Shinkansen is reporting delays due to Signal inspection.',
      severity: 'watch',
      availability: 'live',
      trust: 'confirmed',
    });
    expect(model.bundleSummaries.lifelines?.domains[0]).toMatchObject({
      id: 'rail',
      label: 'Rail',
      metric: '1 rail corridors delayed',
      trust: 'confirmed',
    });
  });

  it('downgrades lifeline trust when rail telemetry is stale even if cached corridors remain nominal', () => {
    const model = buildServiceReadModel({
      selectedEvent: null,
      selectedEventEnvelope: null,
      selectedEventRevisionHistory: [],
      selectionReason: null,
      tsunamiAssessment: null,
      impactResults: null,
      assets: [],
      viewport: null,
      exposures: [],
      priorities: [],
      maritimeOverview: null,
      railStatuses: [
        {
          lineId: 'tokaido',
          status: 'normal',
          updatedAt: 1_700_000_005_000,
        },
      ],
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
        components: [
          {
            id: 'rail',
            label: 'Rail',
            state: 'stale',
            source: 'odpt',
            updatedAt: 1_699_999_940_000,
            staleAfterMs: 60_000,
            message: 'Rail telemetry is stale; using last confirmed corridor state.',
          },
        ],
      },
    });

    expect(model.systemHealth.level).toBe('nominal');
    expect(model.bundleSummaries.lifelines).toMatchObject({
      metric: '1 rail corridors nominal',
      detail: expect.stringContaining('stale'),
      severity: 'watch',
      availability: 'live',
      trust: 'review',
    });
    expect(model.bundleSummaries.lifelines?.signals).toEqual(expect.arrayContaining([
      { id: 'rail-feed', label: 'Rail Feed', value: 'Stale ODPT', tone: 'watch' },
    ]));
    expect(model.bundleSummaries.lifelines?.domains[0]).toMatchObject({
      id: 'rail',
      trust: 'review',
    });
  });

  it('surfaces modeled power posture in lifelines even before grid assets are exposed', () => {
    const model = buildServiceReadModel({
      selectedEvent: {
        id: 'power-onagawa',
        lat: 38.4,
        lng: 141.5,
        depth_km: 15,
        magnitude: 7.8,
        time: 1_700_000_000_000,
        faultType: 'interface',
        tsunami: true,
        place: { text: 'Off Onagawa' },
      },
      selectedEventEnvelope: null,
      selectedEventRevisionHistory: [],
      selectionReason: 'auto-select',
      tsunamiAssessment: null,
      impactResults: null,
      assets: [],
      viewport: null,
      exposures: [],
      priorities: [],
      maritimeOverview: null,
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
      },
    });

    expect(model.bundleSummaries.lifelines).toMatchObject({
      metric: '1 nuclear SCRAM likely',
      detail: 'Onagawa is estimated near SCRAM thresholds at ~301 gal.',
      severity: 'critical',
      availability: 'live',
      trust: 'review',
    });
    expect(model.bundleSummaries.lifelines?.signals).toEqual(expect.arrayContaining([
      { id: 'source', label: 'Source', value: 'Modeled from seismic exposure', tone: 'watch' },
    ]));
    expect(model.bundleSummaries.lifelines?.domains[0]).toMatchObject({
      id: 'power',
      label: 'Power',
      metric: '1 nuclear SCRAM likely',
      availability: 'live',
      trust: 'review',
    });
  });

  it('surfaces modeled water posture in lifelines from facility intensity before water priorities land', () => {
    const model = buildServiceReadModel({
      selectedEvent: {
        id: 'tokyo-bay-water',
        lat: 35.62,
        lng: 139.79,
        depth_km: 18,
        magnitude: 6.8,
        time: 1_700_000_000_000,
        faultType: 'interface',
        tsunami: false,
        place: { text: 'Tokyo Bay' },
      },
      selectedEventEnvelope: null,
      selectedEventRevisionHistory: [],
      selectionReason: 'auto-select',
      tsunamiAssessment: null,
      impactResults: null,
      assets: [
        {
          id: 'toyosu-water',
          region: 'kanto',
          class: 'water_facility',
          name: 'Toyosu Water Purification Center',
          lat: 35.64,
          lng: 139.81,
          tags: ['water', 'lifeline'],
          minZoomTier: 'regional',
        },
      ],
      viewport: null,
      exposures: [],
      priorities: [],
      maritimeOverview: null,
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
      },
    });

    expect(model.bundleSummaries.lifelines).toMatchObject({
      metric: '1 water sites in continuity review',
      detail: 'Toyosu Water Purification Center is estimated at JMA 5.2 and requires distribution verification.',
      severity: 'priority',
      availability: 'modeled',
      trust: 'review',
    });
    expect(model.bundleSummaries.lifelines?.counters).toEqual([
      { id: 'water-sites', label: 'Water Sites', value: 1, tone: 'priority' },
      { id: 'water-review', label: 'Continuity Review', value: 1, tone: 'priority' },
    ]);
    expect(model.bundleSummaries.lifelines?.signals).toEqual(expect.arrayContaining([
      { id: 'source', label: 'Source', value: 'Modeled from seismic exposure', tone: 'watch' },
      { id: 'primary-facility', label: 'Primary Facility', value: 'Toyosu Water Purification Center', tone: 'priority' },
      { id: 'water-region', label: 'Water Region', value: 'Kanto', tone: 'priority' },
      { id: 'estimated-intensity', label: 'Estimated Intensity', value: 'JMA 5.2', tone: 'priority' },
      { id: 'network-posture', label: 'Network Posture', value: 'Continuity Review', tone: 'priority' },
      { id: 'power-posture', label: 'Power Posture', value: '11 generation sites in impact zone', tone: 'watch' },
    ]));
    expect(model.bundleSummaries.lifelines?.domains).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'water', trust: 'review' }),
      expect.objectContaining({ id: 'power', trust: 'review' }),
    ]));
  });

  it('derives lifeline and medical domain overviews from current priorities when those domains are active', () => {
    const model = buildServiceReadModel({
      selectedEvent: {
        id: 'eq-ops',
        lat: 35.6,
        lng: 139.7,
        depth_km: 18,
        magnitude: 6.7,
        time: 1_700_000_000_000,
        faultType: 'interface',
        tsunami: false,
        place: { text: 'Tokyo Bay' },
      },
      selectedEventEnvelope: null,
      selectedEventRevisionHistory: [],
      selectionReason: 'auto-select',
      tsunamiAssessment: null,
      impactResults: null,
      assets: [
        {
          id: 'tokyo-station',
          region: 'kanto',
          class: 'rail_hub',
          name: 'Tokyo Station',
          lat: 35.68,
          lng: 139.76,
          tags: ['rail'],
          minZoomTier: 'regional',
        },
        {
          id: 'tokyo-univ-hospital',
          region: 'kanto',
          class: 'hospital',
          name: 'University of Tokyo Hospital',
          lat: 35.71,
          lng: 139.76,
          tags: ['medical'],
          minZoomTier: 'city',
        },
      ],
      viewport: {
        center: { lat: 35.6, lng: 139.7 },
        zoom: 9.5,
        bounds: [138.8, 34.9, 140.1, 36.1],
        tier: 'regional',
        activeRegion: 'kanto',
      },
      exposures: [
        {
          assetId: 'tokyo-station',
          severity: 'priority',
          score: 71,
          summary: 'Tokyo Station is in priority posture.',
          reasons: ['hub inspection priority'],
        },
        {
          assetId: 'tokyo-univ-hospital',
          severity: 'watch',
          score: 48,
          summary: 'University of Tokyo Hospital is in watch posture.',
          reasons: ['access route sensitivity'],
        },
      ],
      priorities: [
        {
          id: 'priority-tokyo-station',
          assetId: 'tokyo-station',
          severity: 'priority',
          title: 'Inspect Tokyo Station rail hub',
          rationale: 'Kanto rail hub posture is priority because hub inspection priority.',
        },
        {
          id: 'priority-tokyo-hospital',
          assetId: 'tokyo-univ-hospital',
          severity: 'watch',
          title: 'Confirm University of Tokyo Hospital access posture',
          rationale: 'Kanto hospital posture is watch because access route sensitivity.',
        },
      ],
      maritimeOverview: null,
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
      },
    });

    expect(model.bundleSummaries.lifelines).toMatchObject({
      metric: '1 corridor check queued',
      detail: 'Inspect Tokyo Station rail hub',
      severity: 'priority',
      availability: 'live',
      trust: 'confirmed',
    });
    expect(model.bundleSummaries.lifelines?.counters).toEqual([
      { id: 'checks', label: 'Checks', value: 1, tone: 'priority' },
      { id: 'lifeline-sites', label: 'Lifeline Sites', value: 1, tone: 'priority' },
    ]);
    expect(model.bundleSummaries.lifelines?.signals).toEqual([
      { id: 'next-check', label: 'Next Check', value: 'Inspect Tokyo Station rail hub', tone: 'priority' },
      { id: 'lifeline-region', label: 'Region', value: 'Kanto', tone: 'priority' },
      { id: 'primary-domain', label: 'Primary Domain', value: 'Rail', tone: 'priority' },
      { id: 'power-posture', label: 'Power Posture', value: '9 generation sites in impact zone', tone: 'watch' },
    ]);
    expect(model.bundleSummaries.lifelines?.domains.map((domain) => domain.id)).toEqual(expect.arrayContaining(['power', 'rail']));
    expect(model.bundleSummaries.medical).toMatchObject({
      metric: '1 medical access check queued',
      detail: 'Confirm University of Tokyo Hospital access posture',
      severity: 'watch',
      availability: 'modeled',
      trust: 'review',
    });
    expect(model.bundleSummaries.medical?.signals).toEqual(expect.arrayContaining([
      { id: 'source', label: 'Source', value: 'Modeled from seismic exposure', tone: 'watch' },
      { id: 'next-check', label: 'Next Check', value: 'Confirm University of Tokyo Hospital access posture', tone: 'watch' },
      { id: 'medical-region', label: 'Region', value: 'Kanto', tone: 'watch' },
      { id: 'primary-domain', label: 'Primary Domain', value: 'Hospital', tone: 'watch' },
    ]));
    expect(model.bundleSummaries.lifelines?.domains).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'power', trust: 'review' }),
    ]));
  });

  it('escalates system health and selection messaging when the realtime feed is degraded', () => {
    const event = {
      id: 'eq-2',
      lat: 24.2,
      lng: 125.1,
      depth_km: 10,
      magnitude: 5.2,
      time: 1_700_000_000_000,
      faultType: 'interface' as const,
      tsunami: false,
      place: { text: '53 km NW of Hirara, Japan' },
    };

    const model = buildServiceReadModel({
      selectedEvent: event,
      selectedEventEnvelope: buildCanonicalEventEnvelope({
        event,
        source: 'usgs',
        issuedAt: 1_700_000_001_000,
        receivedAt: 1_700_000_001_500,
      }),
      selectedEventRevisionHistory: [],
      selectionReason: 'auto-select',
      tsunamiAssessment: null,
      impactResults: null,
      assets: [],
      viewport: {
        center: { lat: 35.6, lng: 139.7 },
        zoom: 5.5,
        bounds: [122, 24, 150, 46],
        tier: 'national',
        activeRegion: 'kanto',
      },
      exposures: [],
      priorities: [],
      freshnessStatus: {
        source: 'usgs',
        state: 'degraded',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
        message: 'Running on fallback realtime feed',
      },
    });

    expect(model.systemHealth.level).toBe('degraded');
    expect(model.systemHealth.flags).toContain('fallback-feed');
    expect(model.operationalOverview.selectionReason).toBe('auto-select');
    expect(model.operationalOverview.selectionSummary).toMatch(/auto-selected/i);
    expect(model.operationalOverview.impactSummary).toBe('No assets in elevated posture');
    expect(model.bundleSummaries.seismic?.trust).toBe('degraded');
  });

  it('surfaces material revision divergence for operator review when source revisions disagree', () => {
    const usgsEvent = {
      id: 'eq-3',
      lat: 38.1,
      lng: 142.2,
      depth_km: 22,
      magnitude: 6.6,
      time: 1_700_000_000_000,
      faultType: 'interface' as const,
      tsunami: true,
      place: { text: 'Off the coast of Tohoku' },
    };
    const serverEvent = {
      ...usgsEvent,
      lat: 37.8,
      lng: 141.9,
      depth_km: 38,
      magnitude: 7.2,
      tsunami: false,
    };

    const model = buildServiceReadModel({
      selectedEvent: serverEvent,
      selectedEventEnvelope: buildCanonicalEventEnvelope({
        event: serverEvent,
        source: 'server',
        issuedAt: 1_700_000_002_000,
        receivedAt: 1_700_000_003_000,
      }),
      selectedEventRevisionHistory: [
        buildCanonicalEventEnvelope({
          event: usgsEvent,
          source: 'usgs',
          issuedAt: 1_700_000_001_000,
          receivedAt: 1_700_000_001_500,
        }),
      ],
      selectionReason: 'escalate',
      tsunamiAssessment: null,
      impactResults: null,
      assets: [],
      viewport: null,
      exposures: [],
      priorities: [],
      freshnessStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
      },
    });

    expect(model.eventTruth?.divergenceSeverity).toBe('material');
    expect(model.eventTruth?.magnitudeSpread).toBeCloseTo(0.6, 3);
    expect(model.eventTruth?.depthSpreadKm).toBeCloseTo(16, 3);
    expect(model.eventTruth?.locationSpreadKm).toBeGreaterThan(20);
    expect(model.eventTruth?.tsunamiMismatch).toBe(true);
    expect(model.systemHealth.flags).toContain('material-divergence');
    expect(model.systemHealth.detail).toMatch(/magnitude spread/i);
  });

  it('applies event-scoped backend overrides only to the matching selected event', () => {
    const matchingEvent = {
      id: 'evt-match',
      lat: 35.64,
      lng: 139.82,
      depth_km: 24,
      magnitude: 7.0,
      time: 1_700_000_000_000,
      faultType: 'interface' as const,
      tsunami: true,
      place: { text: 'Tokyo Bay operator corridor' },
    };
    const mismatchedEvent = {
      ...matchingEvent,
      id: 'evt-other',
      magnitude: 5.2,
      tsunami: false,
      place: { text: 'Other event' },
    };

    const buildInput = (selectedEvent: typeof matchingEvent) => ({
      selectedEvent,
      selectedEventEnvelope: buildCanonicalEventEnvelope({
        event: selectedEvent,
        source: 'server',
        issuedAt: 1_700_000_002_000,
        receivedAt: 1_700_000_003_000,
      }),
      selectedEventRevisionHistory: [],
      selectionReason: 'auto-select' as const,
      tsunamiAssessment: {
        risk: 'moderate' as const,
        confidence: 'high' as const,
        factors: ['offshore'],
        locationType: 'offshore' as const,
        coastDistanceKm: 12,
        faultType: 'interface',
      },
      impactResults: null,
      assets: [],
      viewport: null,
      exposures: [],
      priorities: [],
      freshnessStatus: {
        source: 'server' as const,
        state: 'fresh' as const,
        updatedAt: 1_700_000_005_000,
        staleAfterMs: 60_000,
      },
      domainOverrides: {
        lifelines: [
          {
            id: 'power',
            label: 'Power',
            metric: '2 power nodes in elevated posture',
            detail: 'Tokyo East Substation is in priority posture.',
            severity: 'priority' as const,
            availability: 'modeled' as const,
            trust: 'review' as const,
            eventId: 'evt-match',
            counters: [
              { id: 'power-nodes', label: 'Power Nodes', value: 2, tone: 'priority' as const },
            ],
            signals: [
              { id: 'source', label: 'Source', value: 'Modeled from seismic exposure', tone: 'watch' as const },
            ],
          },
        ],
        medical: [
          {
            id: 'hospital',
            label: 'Hospital',
            metric: '3 medical sites in elevated posture',
            detail: 'St. Luke\'s International Hospital and University of Tokyo Hospital require hospital access verification.',
            severity: 'priority' as const,
            availability: 'modeled' as const,
            trust: 'review' as const,
            eventId: 'evt-match',
            counters: [
              { id: 'medical-sites', label: 'Sites', value: 3, tone: 'priority' as const },
            ],
            signals: [
              { id: 'source', label: 'Source', value: 'Modeled from seismic exposure', tone: 'watch' as const },
            ],
          },
        ],
      },
    });

    const applied = buildServiceReadModel(buildInput(matchingEvent));
    expect(applied.bundleSummaries.lifelines?.metric).toBe('2 power nodes in elevated posture');
    expect(applied.bundleSummaries.medical?.metric).toBe('3 medical sites in elevated posture');

    const ignored = buildServiceReadModel(buildInput(mismatchedEvent));
    expect(ignored.bundleSummaries.lifelines?.metric).not.toBe('2 power nodes in elevated posture');
    expect(ignored.bundleSummaries.medical?.metric).toBe('No medical access posture shift');
  });
});
