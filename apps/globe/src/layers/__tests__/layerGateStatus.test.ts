import { describe, expect, it } from 'vitest';

import { consoleStore } from '../../core/store';
import type { EarthquakeEvent, IntensityGrid } from '../../types';
import {
  BUILDING_LAYER_MIN_ZOOM,
  PLATEAU_CITIES,
  resolveRenderableBuildingCity,
} from '../buildingLayer';
import { createEventSequenceState, deriveEventSequenceFrame } from '../eventSequenceState';
import { getAllLayerDefinitions } from '../layerRegistry';
import * as layerGateStatusModule from '../layerGateStatus';
import {
  buildLayerGateStatuses,
  createDefaultLayerGateStatuses,
  getAftershockLayerGateStatus,
  getBuildingLayerGateStatus,
  getInfrastructureLayerGateStatus,
  getInfrastructureLayerGateIds,
} from '../layerGateStatus';

const selectedEvent: EarthquakeEvent = {
  id: 'eq-gate-test',
  lat: 35.68,
  lng: 139.69,
  depth_km: 20,
  magnitude: 6.4,
  time: Date.parse('2026-03-10T00:00:00.000Z'),
  faultType: 'crustal',
  tsunami: false,
  place: { text: 'Tokyo Bay' },
};

function createGrid(): IntensityGrid {
  return {
    data: new Float32Array([4.2, 4.8, 5.1, 5.6]),
    cols: 2,
    rows: 2,
    center: { lat: 35.68, lng: 139.69 },
    radiusDeg: 0.3,
  };
}

function createBuildingSupport(
  lat: number,
  lng: number,
): { minimumZoom: number; hasSupportedCity: boolean } {
  return {
    minimumZoom: BUILDING_LAYER_MIN_ZOOM,
    hasSupportedCity: resolveRenderableBuildingCity(lat, lng) !== null,
  };
}

describe('layerGateStatus', () => {
  it('derives gateable layer ids from the registered catalog and synthetic sequence layers', () => {
    const getGateableLayerIds = (
      layerGateStatusModule as { getGateableLayerIds?: () => string[] }
    ).getGateableLayerIds;

    expect(getGateableLayerIds).toBeTypeOf('function');
    if (!getGateableLayerIds) return;

    const expectedLayerIds = [
      ...getAllLayerDefinitions().map((definition) => definition.id),
      'aftershock-cascade',
    ].sort();

    expect([...getGateableLayerIds()].sort()).toEqual(expectedLayerIds);
    expect(Object.keys(createDefaultLayerGateStatuses()).sort()).toEqual(expectedLayerIds);
  });

  it('limits waiting gates to the authoritative infrastructure layer set', () => {
    const infrastructureLayerIds = getAllLayerDefinitions()
      .filter((definition) => definition.category === 'infrastructure')
      .map((definition) => definition.id)
      .sort();
    const infrastructureGateIds = new Set<string>(getInfrastructureLayerGateIds());

    const nonInfrastructureLayerIds = getAllLayerDefinitions()
      .filter((definition) => definition.category !== 'infrastructure')
      .map((definition) => definition.id);

    expect([...infrastructureGateIds].sort()).toEqual(infrastructureLayerIds);
    expect(
      nonInfrastructureLayerIds.every((layerId) => !infrastructureGateIds.has(layerId)),
    ).toBe(true);
  });

  it('returns requires-m5 for aftershock cascade below M5.0', () => {
    expect(getAftershockLayerGateStatus(4.9)).toEqual({
      layerId: 'aftershock-cascade',
      code: 'requires-m5',
      blocking: true,
    });
    expect(getAftershockLayerGateStatus(5.0)).toBeNull();
  });

  it('returns requires-city-zoom and unsupported-city for buildings when appropriate', () => {
    expect(getBuildingLayerGateStatus({
      zoom: 10.9,
      minimumZoom: 11,
      hasSupportedCity: true,
    })).toEqual({
      layerId: 'buildings',
      code: 'requires-city-zoom',
      blocking: true,
    });

    expect(getBuildingLayerGateStatus({
      zoom: 11,
      minimumZoom: 11,
      hasSupportedCity: false,
    })).toEqual({
      layerId: 'buildings',
      code: 'unsupported-city',
      blocking: true,
    });

    expect(getBuildingLayerGateStatus({
      zoom: BUILDING_LAYER_MIN_ZOOM,
      minimumZoom: BUILDING_LAYER_MIN_ZOOM,
      hasSupportedCity: true,
      requiresIntensityGrid: true,
    })).toEqual({
      layerId: 'buildings',
      code: 'requires-intensity-grid',
      blocking: true,
    });
  });

  it('returns waiting-sequence or waiting-handoff for infrastructure layers that should not yet activate', () => {
    expect(getInfrastructureLayerGateStatus({
      layerId: 'power',
      waitFor: 'sequence',
    })).toEqual({
      layerId: 'power',
      code: 'waiting-sequence',
      blocking: false,
    });

    expect(getInfrastructureLayerGateStatus({
      layerId: 'airports',
      waitFor: 'handoff',
    })).toEqual({
      layerId: 'airports',
      code: 'waiting-handoff',
      blocking: false,
    });
  });

  it('adds safe gate defaults to ConsoleState', () => {
    expect(consoleStore.getState().layerGateStatuses).toEqual(createDefaultLayerGateStatuses());
  });

  it('keeps aftershock cascade waiting during active replay and clears the gate at the aftershock-cascade boundary for M5+', () => {
    const replayState = {
      ...consoleStore.getState(),
      selectedEvent,
      intensityGrid: createGrid(),
      buildingSupport: createBuildingSupport(
        PLATEAU_CITIES.chiyoda.center.lat,
        PLATEAU_CITIES.chiyoda.center.lng,
      ),
    };

    const replaySequence = deriveEventSequenceFrame({
      state: createEventSequenceState({
        active: true,
        selectedEventId: selectedEvent.id,
        startedAt: 1_000,
      }),
      now: 2_000,
      selectedEvent,
    });

    expect(buildLayerGateStatuses({
      state: replayState,
      sequence: replaySequence,
    })['aftershock-cascade']).toEqual({
      layerId: 'aftershock-cascade',
      code: 'waiting-sequence',
      blocking: false,
    });

    const cascadeSequence = deriveEventSequenceFrame({
      state: createEventSequenceState({
        active: true,
        selectedEventId: selectedEvent.id,
        startedAt: 1_000,
      }),
      now: 4_000,
      selectedEvent,
    });

    expect(buildLayerGateStatuses({
      state: replayState,
      sequence: cascadeSequence,
    })['aftershock-cascade']).toBeNull();

    const settledSequence = deriveEventSequenceFrame({
      state: createEventSequenceState({
        active: true,
        selectedEventId: selectedEvent.id,
        startedAt: 1_000,
      }),
      now: 4_400,
      selectedEvent,
    });

    expect(buildLayerGateStatuses({
      state: replayState,
      sequence: settledSequence,
    })['aftershock-cascade']).toBeNull();
  });

  it('reports requires-intensity-grid for supported building views when an event is selected without a grid', () => {
    const state = {
      ...consoleStore.getState(),
      selectedEvent,
      intensityGrid: null,
      viewport: {
        ...consoleStore.getState().viewport,
        zoom: BUILDING_LAYER_MIN_ZOOM,
        center: { lat: 0, lng: 0 },
      },
      buildingSupport: createBuildingSupport(
        PLATEAU_CITIES.chiyoda.center.lat,
        PLATEAU_CITIES.chiyoda.center.lng,
      ),
    };

    const sequence = deriveEventSequenceFrame({
      state: createEventSequenceState({
        active: true,
        selectedEventId: selectedEvent.id,
        startedAt: 1_000,
      }),
      now: 4_400,
      selectedEvent,
    });

    expect(buildLayerGateStatuses({
      state,
      sequence,
    }).buildings).toEqual({
      layerId: 'buildings',
      code: 'requires-intensity-grid',
      blocking: true,
    });
  });
});
