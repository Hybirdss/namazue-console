import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLocale, setLocale } from '../../i18n';
import { createDefaultBundleSettings, createDefaultLayerVisibility } from '../../layers/bundleRegistry';
import { buildAssetCategoryVisibility } from '../../ops/assetCategoryVisibility';
import type { ServiceReadModel } from '../../ops/readModelTypes';
import { createEmptyServiceReadModel } from '../../ops/serviceReadModel';
import { consoleStore, type ConsoleState } from '../../core/store';
import { getClientRefreshPolicy, resolveClientGovernorState } from '../../governor/clientGovernor';
import { createDefaultEventSequenceState } from '../../layers/eventSequenceState';
import { createDefaultLayerGateStatuses, createLayerGateStatus } from '../../layers/layerGateStatus';
import { buildBundleSummary, buildLayerControlModel, mountLayerControl, renderLayerControlDrawer } from '../layerControl';

function createReadModel(): ServiceReadModel {
  return createEmptyServiceReadModel({
    source: 'server',
    state: 'fresh',
    updatedAt: Date.parse('2026-03-06T10:00:00.000Z'),
    staleAfterMs: 60_000,
  });
}

function createState(overrides: Partial<ConsoleState> = {}): ConsoleState {
  return {
    mode: 'calm',
    viewport: {
      center: { lat: 35.68, lng: 139.69 },
      zoom: 5.5,
      bounds: [122, 24, 150, 46],
      tier: 'national',
      pitch: 0,
      bearing: 0,
    },
    selectedEvent: null,
    eventSequence: createDefaultEventSequenceState(),
    events: [],
    catalogEvents: [],
    catalogTimeRange: null,
    exposures: [],
    priorities: [],
    readModel: createReadModel(),
    realtimeStatus: {
      source: 'server',
      state: 'fresh',
      updatedAt: Date.parse('2026-03-06T10:00:00.000Z'),
      staleAfterMs: 60_000,
    },
    intensityGrid: null,
    vessels: [],
    faults: [],
    railStatuses: [],
    scenarios: [],
    domainOverrides: {},
    scenarioMode: false,
    feedDays: 7,
    layerVisibility: createDefaultLayerVisibility(),
    layerGateStatuses: createDefaultLayerGateStatuses(),
    assetCategoryVisibility: buildAssetCategoryVisibility(),
    activeBundleId: 'maritime',
    activeViewId: 'national-impact',
    bundleSettings: createDefaultBundleSettings(),
    bundleDrawerOpen: true,
    panelsVisible: true,
    showCoordinates: true,
    highlightedAssetId: null,
    selectedAssetId: null,
    searchedPlace: null,
    sequenceSWaveKm: null,
    dataFreshness: { usgs: 0, ais: 0, odpt: 0 },
    performanceStatus: {
      fps: 60,
      sampledAt: 0,
      tone: 'nominal',
      minFps: 45,
    },
    ...overrides,
  };
}

const initialLocale = getLocale();
const baselineConsoleState = consoleStore.getState();

function createSelectedEvent(magnitude = 6.2): NonNullable<ConsoleState['selectedEvent']> {
  return {
    id: `event-${magnitude}`,
    lat: 35.68,
    lng: 139.69,
    depth_km: 20,
    magnitude,
    time: Date.parse('2026-03-06T10:00:00.000Z'),
    faultType: 'crustal',
    tsunami: false,
    place: { text: 'Tokyo' },
    source: 'server',
  };
}

function ensureLocaleDocument(): void {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') return;

  const createElement = () => ({
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  });

  Object.defineProperty(globalThis, 'document', {
    value: {
      documentElement: { lang: initialLocale },
      createElement,
    },
    configurable: true,
    writable: true,
  });
}

ensureLocaleDocument();

afterEach(() => {
  setLocale(initialLocale);
  vi.unstubAllGlobals();
  consoleStore.batch(() => {
    for (const [key, value] of Object.entries(baselineConsoleState) as Array<[keyof ConsoleState, ConsoleState[keyof ConsoleState]]>) {
      consoleStore.set(key, value);
    }
  });
});

describe('layerControl bundle summaries', () => {
  it('client governor disables high-frequency maritime polling in calm mode', () => {
    expect(getClientRefreshPolicy('maritime', 'calm').refreshMs).toBe(60_000);
    expect(getClientRefreshPolicy('maritime', 'incident').refreshMs).toBe(10_000);
    expect(getClientRefreshPolicy('rail', 'calm').refreshMs).toBe(120_000);
  });

  it('client governor prefers worker truth and falls back to calm when unavailable', () => {
    expect(resolveClientGovernorState(undefined)).toBe('calm');
    expect(resolveClientGovernorState({
      states: ['calm', 'watch', 'incident', 'recovery'],
      sourceClasses: ['event-truth', 'fast-situational', 'slow-infrastructure'],
      activation: {
        state: 'watch',
        sourceClasses: ['event-truth', 'fast-situational'],
        regionScope: { kind: 'regional', regionIds: ['kanto'] },
        activatedAt: '2026-03-07T00:00:00.000Z',
        reason: 'moderate seismic activity activated watch mode',
      },
    })).toBe('watch');
  });

  it('uses backend-owned maritime summary in calm mode', () => {
    const summary = buildBundleSummary('maritime', createState());

    expect(summary.title).toBe('Maritime');
    expect(summary.metric).toContain('No tracked traffic');
    expect(summary.detail).toContain('standing by');
    expect(summary.trust).toBe('confirmed');
    expect(summary.counters).toEqual([]);
  });

  it('surfaces seismic truth when the seismic bundle is active', () => {
    const summary = buildBundleSummary('seismic', createState({
      readModel: {
        ...createReadModel(),
        bundleSummaries: {
          ...createReadModel().bundleSummaries,
          seismic: {
            bundleId: 'seismic',
            title: 'Seismic',
            metric: '3 assets in elevated posture',
            detail: 'Primary operational pressure centered on Kanto.',
            severity: 'priority',
            availability: 'live',
            trust: 'review',
            counters: [
              { id: 'affected-assets', label: 'Affected', value: 3, tone: 'priority' },
            ],
            signals: [
              { id: 'focus-region', label: 'Focus Region', value: 'Kanto', tone: 'priority' },
            ],
            domains: [
              {
                id: 'impact',
                label: 'Impact',
                metric: '3 assets affected',
                detail: 'Kanto pressure remains elevated.',
                severity: 'priority',
                availability: 'live',
                trust: 'review',
                counters: [],
                signals: [],
              },
            ],
          },
        },
      },
    }));

    expect(summary.title).toBe('Seismic');
    expect(summary.metric).toContain('3 assets');
    expect(summary.trust).toBe('review');
    expect(summary.counters).toEqual([
      { id: 'affected-assets', label: 'Affected', value: 3, tone: 'priority' },
    ]);
    expect(summary.signals).toEqual([
      { id: 'focus-region', label: 'Focus Region', value: 'Kanto', tone: 'priority' },
    ]);
    expect(summary.domains).toEqual([
      {
        id: 'impact',
        label: 'Impact',
        metric: '3 assets affected',
        detail: 'Kanto pressure remains elevated.',
        severity: 'priority',
        availability: 'live',
        trust: 'review',
        counters: [],
        signals: [],
      },
    ]);
  });

  it('prefers backend-owned bundle summaries when the read model provides them', () => {
    const summary = buildBundleSummary('medical', createState({
      readModel: {
        ...createReadModel(),
        bundleSummaries: {
          medical: {
            bundleId: 'medical',
            title: 'Medical',
            metric: '2 medical sites in elevated posture',
            detail: 'Hospital access verification required across Kanto.',
            severity: 'priority',
            availability: 'modeled',
            trust: 'confirmed',
            counters: [],
            signals: [
              { id: 'medical-focus', label: 'Medical Focus', value: 'University of Tokyo Hospital, St. Luke Hospital', tone: 'priority' },
            ],
            domains: [
              {
                id: 'hospital',
                label: 'Hospital',
                metric: '2 hospital sites exposed',
                detail: 'Tokyo hospital access requires verification.',
                severity: 'priority',
                availability: 'modeled',
                trust: 'confirmed',
                counters: [],
                signals: [],
              },
            ],
          },
        },
      },
    } as Partial<ConsoleState>));

    expect(summary.metric).toContain('2 medical sites');
    expect(summary.detail).toContain('Hospital access verification');
    expect(summary.trust).toBe('confirmed');
    expect(summary.signals).toEqual([
      { id: 'medical-focus', label: 'Medical Focus', value: 'University of Tokyo Hospital, St. Luke Hospital', tone: 'priority' },
    ]);
    expect(summary.domains).toEqual([
      {
        id: 'hospital',
        label: 'Hospital',
        metric: '2 hospital sites exposed',
        detail: 'Tokyo hospital access requires verification.',
        severity: 'priority',
        availability: 'modeled',
        trust: 'confirmed',
        counters: [],
        signals: [],
      },
    ]);
  });

  it('passes through future domain-overview signals without panel-specific logic changes', () => {
    const summary = buildBundleSummary('lifelines', createState({
      readModel: {
        ...createReadModel(),
        bundleSummaries: {
          lifelines: {
            bundleId: 'lifelines',
            title: 'Lifelines',
            metric: '2 rail corridors, 1 power node under review',
            detail: 'Tokaido corridor and Tokyo grid ingress require operator verification.',
            severity: 'critical',
            availability: 'live',
            trust: 'review',
            counters: [
              { id: 'rail-corridors', label: 'Rail Corridors', value: 2, tone: 'priority' },
            ],
            signals: [
              { id: 'lifeline-focus', label: 'Lifeline Focus', value: 'Tokaido, Tokyo Grid East', tone: 'critical' },
            ],
            domains: [
              {
                id: 'rail',
                label: 'Rail',
                metric: '2 rail corridors under review',
                detail: 'Tokaido corridor requires verification.',
                severity: 'critical',
                availability: 'live',
                trust: 'review',
                counters: [],
                signals: [],
              },
            ],
          },
        },
      },
    }));

    expect(summary.metric).toContain('2 rail corridors');
    expect(summary.trust).toBe('review');
    expect(summary.signals).toEqual([
      { id: 'lifeline-focus', label: 'Lifeline Focus', value: 'Tokaido, Tokyo Grid East', tone: 'critical' },
    ]);
    expect(summary.domains).toEqual([
      {
        id: 'rail',
        label: 'Rail',
        metric: '2 rail corridors under review',
        detail: 'Tokaido corridor requires verification.',
        severity: 'critical',
        availability: 'live',
        trust: 'review',
        counters: [],
        signals: [],
      },
    ]);
  });

  it('falls back to empty backend truth instead of pending copy when a bundle summary is missing', () => {
    const summary = buildBundleSummary('medical', createState({
      readModel: {
        ...createReadModel(),
        bundleSummaries: {},
      },
    }));

    expect(summary.title).toBe('Medical');
    expect(summary.metric).toContain('No medical access posture shift');
    expect(summary.detail).toContain('standing by');
    expect(summary.trust).toBe('pending');
    expect(summary.domains).toEqual([]);
  });

  it('builds a drawer model with presets, bundles, and effective layer state', () => {
    const state = createState({
      activeBundleId: 'maritime',
      activeViewId: 'coastal-operations',
      bundleSettings: {
        ...createDefaultBundleSettings(),
        lifelines: { enabled: true, density: 'dense' },
      },
    });

    const model = buildLayerControlModel(state);
    const shipsRow = model.layerRows.find((row) => row.id === 'ais');
    const railRow = model.layerRows.find((row) => row.id === 'rail');

    expect(model.activeBundle.label).toBe('Maritime');
    expect(model.activeView.label).toBe('Coastal Operations');
    expect(model.bundleSummaries).toHaveLength(5);
    expect(shipsRow?.effectiveVisible).toBe(true);
    expect(railRow).toBeUndefined();
  });

  it('maps building gate codes into localized drawer detail and tone', () => {
    setLocale('en');

    const cityZoomRow = buildLayerControlModel(createState({
      activeBundleId: 'built-environment',
      layerGateStatuses: {
        ...createDefaultLayerGateStatuses(),
        buildings: createLayerGateStatus('buildings', 'requires-city-zoom'),
      },
    })).layerRows.find((row) => row.id === 'buildings');

    expect(cityZoomRow).toMatchObject({
      gateDetail: 'City zoom required',
      gateTone: 'watch',
    });

    const unsupportedRow = buildLayerControlModel(createState({
      activeBundleId: 'built-environment',
      layerGateStatuses: {
        ...createDefaultLayerGateStatuses(),
        buildings: createLayerGateStatus('buildings', 'unsupported-city'),
      },
    })).layerRows.find((row) => row.id === 'buildings');

    expect(unsupportedRow).toMatchObject({
      gateDetail: 'No verified PLATEAU tileset',
      gateTone: 'degraded',
    });

    const intensityRow = buildLayerControlModel(createState({
      activeBundleId: 'built-environment',
      selectedEvent: createSelectedEvent(),
      layerGateStatuses: {
        ...createDefaultLayerGateStatuses(),
        buildings: createLayerGateStatus('buildings', 'requires-intensity-grid'),
      },
    })).layerRows.find((row) => row.id === 'buildings');

    expect(intensityRow).toMatchObject({
      gateDetail: 'Waiting for intensity field',
      gateTone: 'watch',
    });
  });

  it('treats blocking building gates as hidden and off in the drawer model', () => {
    setLocale('en');

    const blockedRow = buildLayerControlModel(createState({
      activeBundleId: 'built-environment',
      layerVisibility: {
        ...createDefaultLayerVisibility(),
        buildings: true,
      },
      layerGateStatuses: {
        ...createDefaultLayerGateStatuses(),
        buildings: createLayerGateStatus('buildings', 'requires-intensity-grid'),
      },
    })).layerRows.find((row) => row.id === 'buildings');

    expect(blockedRow).toMatchObject({
      visible: false,
      effectiveVisible: false,
      gateDetail: 'Waiting for intensity field',
    });
  });

  it('adds an aftershock row with localized gate detail and tone', () => {
    setLocale('en');

    const requiresM5Row = buildLayerControlModel(createState({
      activeBundleId: 'seismic',
      selectedEvent: createSelectedEvent(4.9),
      layerGateStatuses: {
        ...createDefaultLayerGateStatuses(),
        'aftershock-cascade': createLayerGateStatus('aftershock-cascade', 'requires-m5'),
      },
    })).layerRows.find((row) => String(row.id) === 'aftershock-cascade');

    expect(requiresM5Row).toMatchObject({
      gateDetail: 'Requires M5.0+',
      gateTone: 'degraded',
    });

    const waitingRow = buildLayerControlModel(createState({
      activeBundleId: 'seismic',
      selectedEvent: createSelectedEvent(6.2),
      layerGateStatuses: {
        ...createDefaultLayerGateStatuses(),
        'aftershock-cascade': createLayerGateStatus('aftershock-cascade', 'waiting-sequence'),
      },
    })).layerRows.find((row) => String(row.id) === 'aftershock-cascade');

    expect(waitingRow).toMatchObject({
      gateDetail: 'Available after wave sequence',
      gateTone: 'watch',
    });
  });

  it('renders gate detail lines in the drawer for blocked and waiting layers', () => {
    setLocale('en');

    const buildingsDrawer = renderLayerControlDrawer(createState({
      activeBundleId: 'built-environment',
      bundleDrawerOpen: true,
      layerGateStatuses: {
        ...createDefaultLayerGateStatuses(),
        buildings: createLayerGateStatus('buildings', 'requires-city-zoom'),
      },
    }));

    expect(buildingsDrawer).toContain('nz-bundle-layer-row__gate-detail');
    expect(buildingsDrawer).toContain('City zoom required');

    const aftershockDrawer = renderLayerControlDrawer(createState({
      activeBundleId: 'seismic',
      bundleDrawerOpen: true,
      selectedEvent: createSelectedEvent(6.2),
      layerGateStatuses: {
        ...createDefaultLayerGateStatuses(),
        'aftershock-cascade': createLayerGateStatus('aftershock-cascade', 'waiting-sequence'),
      },
    }));

    expect(aftershockDrawer).toContain('Available after wave sequence');
    expect(aftershockDrawer).toMatch(
      /<button class="nz-bundle-layer-row nz-bundle-layer-row--static" disabled>[\s\S]*?<span class="nz-bundle-layer-row__title">Aftershock Cascade<\/span>/,
    );
  });

  it('localizes gate detail copy in Japanese and Korean', () => {
    setLocale('ja');
    const jaRow = buildLayerControlModel(createState({
      activeBundleId: 'built-environment',
      layerGateStatuses: {
        ...createDefaultLayerGateStatuses(),
        buildings: createLayerGateStatus('buildings', 'unsupported-city'),
      },
    })).layerRows.find((row) => row.id === 'buildings');

    expect(jaRow).toMatchObject({
      gateDetail: '検証済みPLATEAUタイルなし',
    });

    setLocale('ko');
    const koRow = buildLayerControlModel(createState({
      activeBundleId: 'seismic',
      selectedEvent: createSelectedEvent(6.2),
      layerGateStatuses: {
        ...createDefaultLayerGateStatuses(),
        'aftershock-cascade': createLayerGateStatus('aftershock-cascade', 'waiting-sequence'),
      },
    })).layerRows.find((row) => String(row.id) === 'aftershock-cascade');

    expect(koRow).toMatchObject({
      gateDetail: '파형 시퀀스 후 사용 가능',
    });
  });

  it('rerenders the mounted drawer when layerGateStatuses change', () => {
    setLocale('en');
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number => {
      callback(0);
      return 1;
    });

    consoleStore.batch(() => {
      const nextState = createState({
        activeBundleId: 'built-environment',
        bundleDrawerOpen: true,
        selectedEvent: createSelectedEvent(),
      });

      for (const [key, value] of Object.entries(nextState) as Array<[keyof ConsoleState, ConsoleState[keyof ConsoleState]]>) {
        consoleStore.set(key, value);
      }
    });

    const dock = document.createElement('div');
    const drawer = document.createElement('div');
    const dispose = mountLayerControl(dock, drawer);

    expect(drawer.innerHTML).not.toContain('Waiting for intensity field');

    consoleStore.set('layerGateStatuses', {
      ...createDefaultLayerGateStatuses(),
      buildings: createLayerGateStatus('buildings', 'requires-intensity-grid'),
    });

    expect(drawer.innerHTML).toContain('Waiting for intensity field');
    dispose();
  });
});
