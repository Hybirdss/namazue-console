import { describe, expect, it } from 'vitest';

import { createDefaultBundleSettings, createDefaultLayerVisibility } from '../../layers/bundleRegistry';
import { buildAssetCategoryVisibility } from '../../ops/assetCategoryVisibility';
import type { ServiceReadModel } from '../../ops/readModelTypes';
import { createEmptyServiceReadModel } from '../../ops/serviceReadModel';
import type { ConsoleState } from '../../core/store';
import { buildCommandDeckModel } from '../commandDeck';
import { createDefaultEventSequenceState } from '../../layers/eventSequenceState';
import { createDefaultLayerGateStatuses } from '../../layers/layerGateStatus';

function createReadModel(): ServiceReadModel {
  return createEmptyServiceReadModel({
    source: 'server',
    state: 'fresh',
    updatedAt: Date.parse('2026-03-09T12:00:00.000Z'),
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
      updatedAt: Date.parse('2026-03-09T12:00:00.000Z'),
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

describe('buildCommandDeckModel', () => {
  it('surfaces deck sections and density-specific layout hints', () => {
    const model = buildCommandDeckModel(createState({
      mode: 'event',
      activeBundleId: 'maritime',
      activeViewId: 'national-impact',
      viewport: {
        center: { lat: 35.68, lng: 139.69 },
        zoom: 10.4,
        bounds: [139.1, 35.1, 140.3, 36.0],
        tier: 'regional',
        pitch: 0,
        bearing: 0,
      },
      bundleSettings: {
        ...createDefaultBundleSettings(),
        maritime: { enabled: true, density: 'dense' },
      },
    }));

    expect(model.density).toBe('dense');
    expect(model.viewportFact).toContain('regional');
    expect(model.controls.some((control) => control.id === 'timeline')).toBe(true);
    expect(model.controls.some((control) => control.id === 'bundle')).toBe(true);
    expect(model.controls.find((control) => control.id === 'density')?.value).toBe('Dense');
    expect(model.bundleChips.find((chip) => chip.id === 'maritime')?.active).toBe(true);
  });
});
