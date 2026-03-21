import { ScatterplotLayer } from '@deck.gl/layers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../layerFactories', () => ({
  LAYER_FACTORIES: [],
}));

vi.mock('../assetLayer', () => ({
  createAssetLayers: () => [],
}));

vi.mock('../waveLayer', () => ({
  updateWaveData: () => undefined,
  createWaveLayers: () => [],
}));

vi.mock('../intensityLayer', () => ({
  createIntensityLayer: () => null,
}));

vi.mock('../earthquakeLayer', () => ({
  createEarthquakeLayer: () => null,
  createEarthquakeInnerGlowLayer: () => null,
  createEarthquakeOuterGlowLayer: () => null,
  createEarthquakeAgeRingLayer: () => null,
}));

vi.mock('../impactVisualization', () => ({
  createImpactGlowLayer: () => null,
  createImpactZoneLayers: () => [],
}));

vi.mock('../aftershockZone', () => ({
  createAfterShockZoneLayers: () => [],
}));

vi.mock('../distanceRings', () => ({
  createDistanceRingLayers: () => [],
}));

vi.mock('../bearingLines', () => ({
  createBearingLineLayers: () => [],
}));

vi.mock('../dmatLines', () => ({
  createDmatDeploymentLayers: () => [],
}));

vi.mock('../../core/performanceGate', () => ({
  createPerformanceGate: () => ({
    sample: () => null,
  }),
}));

import type { Layer } from '@deck.gl/core';

import { consoleStore } from '../../core/store';
import type { MapEngine } from '../../core/mapEngine';
import { createDefaultEventSequenceState } from '../eventSequenceState';
import { createDefaultLayerGateStatuses } from '../layerGateStatus';
import { resolveRenderableBuildingCity, BUILDING_LAYER_MIN_ZOOM, PLATEAU_CITIES } from '../buildingLayer';
import { cloneRenderableLayers, createLayerCompositor } from '../layerCompositor';

const selectedEvent = {
  id: 'eq-compositor-test',
  lat: 35.68,
  lng: 139.69,
  depth_km: 20,
  magnitude: 6.4,
  time: Date.parse('2026-03-10T00:00:00.000Z'),
  faultType: 'crustal' as const,
  tsunami: false,
  place: { text: 'Tokyo Bay' },
};

const initialViewport = {
  center: { lat: 35.68, lng: 139.69 },
  zoom: 5.5,
  bounds: [122, 24, 150, 46] as [number, number, number, number],
  tier: 'national' as const,
  pitch: 0,
  bearing: 0,
};

function resetConsoleStore(): void {
  consoleStore.batch(() => {
    consoleStore.set('selectedEvent', null);
    consoleStore.set('intensityGrid', null);
    consoleStore.set('events', []);
    consoleStore.set('exposures', []);
    consoleStore.set('highlightedAssetId', null);
    consoleStore.set('sequenceSWaveKm', null);
    consoleStore.set('eventSequence', createDefaultEventSequenceState());
    consoleStore.set('layerGateStatuses', createDefaultLayerGateStatuses());
    consoleStore.set('viewport', initialViewport);
  });
}

function createEngineStub() {
  let lastLayers: Layer[] = [];
  const setLayers = vi.fn((layers: Layer[]) => {
    lastLayers = layers;
  });

  const engine = {
    setLayers,
  } as unknown as MapEngine;

  return {
    engine,
    setLayers,
    getLastLayerIds: () => lastLayers.map((layer) => String(layer.props.id)),
  };
}

describe('layerCompositor', () => {
  let rafId = 0;
  let rafQueue = new Map<number, FrameRequestCallback>();

  function flushAnimationFrame(now: number): void {
    vi.setSystemTime(now);
    const pending = [...rafQueue.entries()];
    rafQueue = new Map();
    for (const [, callback] of pending) {
      callback(now);
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    rafId = 0;
    rafQueue = new Map();
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      rafId += 1;
      rafQueue.set(rafId, callback);
      return rafId;
    }) as typeof requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', ((id: number) => {
      rafQueue.delete(id);
    }) as typeof cancelAnimationFrame);
    resetConsoleStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    resetConsoleStore();
  });

  it('materializes fresh layer instances from cached templates', () => {
    const template = new ScatterplotLayer({
      id: 'intensity-field',
      data: [],
    });

    const first = cloneRenderableLayers([template]);
    const second = cloneRenderableLayers([template]);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0]).not.toBe(template);
    expect(second[0]).not.toBe(template);
    expect(second[0]).not.toBe(first[0]);
    expect(first[0]?.constructor).toBe(template.constructor);
    expect(first[0]?.props.id).toBe('intensity-field');
  });

  it('returns an empty array when no cached layers exist', () => {
    expect(cloneRenderableLayers(undefined)).toEqual([]);
  });

  it('selecting an event initializes consoleStore.eventSequence with the wave sequence start time', () => {
    const { engine } = createEngineStub();
    const compositor = createLayerCompositor(engine);

    vi.setSystemTime(1_000);
    compositor.start();
    consoleStore.set('selectedEvent', selectedEvent);

    expect(consoleStore.get('eventSequence')).toMatchObject({
      active: true,
      phase: 'epicenter-flash',
      selectedEventId: selectedEvent.id,
      startedAt: 1_000,
      elapsedMs: 0,
    });

    compositor.stop();
  });

  it('publishes eventSequence and sequenceSWaveKm together on each frame', () => {
    const { engine } = createEngineStub();
    const compositor = createLayerCompositor(engine);
    let publishedWaveKm: number | null | undefined;

    const unsub = consoleStore.subscribe('eventSequence', (value) => {
      if (value.elapsedMs > 0) {
        publishedWaveKm = consoleStore.get('sequenceSWaveKm');
      }
    });

    vi.setSystemTime(1_000);
    compositor.start();
    consoleStore.set('selectedEvent', selectedEvent);

    flushAnimationFrame(2_000);

    expect(consoleStore.get('eventSequence')).toMatchObject({
      phase: 's-wave',
      elapsedMs: 1_000,
    });
    expect(consoleStore.get('sequenceSWaveKm')).toBe(90);
    expect(publishedWaveKm).toBe(90);

    unsub();
    compositor.stop();
  });

  it('holds aftershock layers until aftershock-cascade, then clears the gate and renders them', () => {
    const { engine, getLastLayerIds } = createEngineStub();
    const compositor = createLayerCompositor(engine);

    consoleStore.set('viewport', {
      ...initialViewport,
      zoom: BUILDING_LAYER_MIN_ZOOM,
      center: PLATEAU_CITIES.chiyoda.center,
      tier: 'city',
    });
    consoleStore.set('intensityGrid', {
      data: new Float32Array([4.2, 4.8, 5.1, 5.6]),
      cols: 2,
      rows: 2,
      center: { lat: 35.68, lng: 139.69 },
      radiusDeg: 0.3,
    });

    vi.setSystemTime(1_000);
    compositor.start();
    consoleStore.set('selectedEvent', selectedEvent);

    flushAnimationFrame(2_000);

    expect(consoleStore.get('layerGateStatuses')['aftershock-cascade']).toEqual({
      layerId: 'aftershock-cascade',
      code: 'waiting-sequence',
      blocking: false,
    });
    expect(getLastLayerIds().some((id) => id.startsWith('aftershock-cascade-'))).toBe(false);

    flushAnimationFrame(4_000);

    expect(consoleStore.get('eventSequence').phase).toBe('aftershock-cascade');
    expect(consoleStore.get('layerGateStatuses')['aftershock-cascade']).toBeNull();
    expect(getLastLayerIds()).toEqual(
      expect.arrayContaining(['aftershock-cascade-glow', 'aftershock-cascade-core']),
    );

    compositor.stop();
  });

  it('clearing selectedEvent resets eventSequence, sequenceSWaveKm, and gate state', () => {
    const { engine } = createEngineStub();
    const compositor = createLayerCompositor(engine);

    consoleStore.set('viewport', {
      ...initialViewport,
      zoom: BUILDING_LAYER_MIN_ZOOM,
      center: PLATEAU_CITIES.chiyoda.center,
      tier: 'city',
    });

    vi.setSystemTime(1_000);
    compositor.start();
    consoleStore.set('selectedEvent', selectedEvent);
    flushAnimationFrame(2_000);

    consoleStore.set('selectedEvent', null);

    expect(consoleStore.get('eventSequence')).toEqual(createDefaultEventSequenceState());
    expect(consoleStore.get('sequenceSWaveKm')).toBeNull();
    expect(consoleStore.get('layerGateStatuses')).toEqual(createDefaultLayerGateStatuses());

    compositor.stop();
  });

  it('derives compositor building-support facts from the renderer helper inputs used by the viewport', () => {
    const renderableCity = resolveRenderableBuildingCity(
      PLATEAU_CITIES.chiyoda.center.lat,
      PLATEAU_CITIES.chiyoda.center.lng,
    );
    const unsupportedCity = resolveRenderableBuildingCity(
      PLATEAU_CITIES.chiba.center.lat,
      PLATEAU_CITIES.chiba.center.lng,
    );

    expect(renderableCity?.id).toBe('chiyoda');
    expect(unsupportedCity).toBeNull();
  });
});
