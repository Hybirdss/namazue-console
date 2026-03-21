/**
 * Layer Factory Registry — Maps LayerId to deck.gl layer factories.
 *
 * Adding a new layer:
 *   1. Add LayerId to layerRegistry.ts
 *   2. Create the deck.gl layer module (e.g., railLayer.ts)
 *   3. Register it here with order, deps, and create function
 *   4. Done — compositor and bundle system handle the rest
 *
 * Order values determine render stacking (low = bottom):
 *   100 intensity     — hazard field (always below everything)
 *   150 heatmap       — seismic density (national/regional zoom only)
 *   200 faults        — tectonic context
 *   250-280 lifelines — rail, power, water, telecom
 *   300 ais           — maritime traffic
 *   350 hospitals     — medical infrastructure
 *   400 earthquakes   — seismic events (most interactive)
 *   500 buildings     — 3D built environment
 *   900 waves         — animation overlay (handled separately)
 */

import type { Layer } from '@deck.gl/core';
import type { ConsoleState } from '../core/store';
import type { EarthquakeEvent } from '../types';
import {
  buildLayerFactoryRegistry,
  defineLayerPlugin,
  type DataLayerPlugin,
} from './plugin';
import { createEarthquakeLayer } from './earthquakeLayer';
import { createIntensityLayer } from './intensityLayer';
import { createFaultLayer } from './faultLayer';
import { createAisLayers } from './aisLayer';
import { createHospitalLayers } from './hospitalLayer';
import { createRailLayers } from './railLayer';
import { createAirportLayers } from './airportLayer';
import { createTransportNodeLayers } from './transportNodesLayer';
import { createPowerLayers } from './powerLayer';
import { createSeismicHeatmapLayer } from './heatmapLayer';
import { createPopulationLayers } from './populationLayer';
import { createSeismicDepthLayers } from './seismicDepthLayer';
import { createBuildingLayers } from './buildingLayer';
import { createIntensityContourLayers } from './intensityContourLayer';
import { assertLayerArchitecture } from './layerArchitectureAudit';

export interface LayerFactory {
  id: DataLayerPlugin['id'];
  order: DataLayerPlugin['order'];
  deps: DataLayerPlugin['deps'];
  viewportMode?: DataLayerPlugin['viewportMode'];
  create(state: ConsoleState): Layer[];
}

function f(def: LayerFactory): LayerFactory { return defineLayerPlugin(def); }

/** Merge live + catalog events, deduplicating by id. */
function deduplicateEvents(live: EarthquakeEvent[], catalog: EarthquakeEvent[]): EarthquakeEvent[] {
  const map = new Map<string, EarthquakeEvent>();
  for (const e of catalog) map.set(e.id, e);
  for (const e of live) map.set(e.id, e);  // live wins on conflict
  return [...map.values()];
}

export const LAYER_PLUGINS: LayerFactory[] = [
  f({
    id: 'intensity',
    order: 100,
    deps: ['intensityGrid', 'selectedEvent', 'viewport'],
    viewportMode: 'zoom',
    create(state: ConsoleState) {
      const layers: Layer[] = [];
      const intensity = createIntensityLayer(state.intensityGrid);
      if (intensity) layers.push(intensity);
      // Isoseismal contour lines — ShakeMap-style JMA contours on top of intensity field
      layers.push(...createIntensityContourLayers(state.intensityGrid));
      // Population exposure circles overlay
      layers.push(...createPopulationLayers(state.selectedEvent, state.intensityGrid, state.viewport.zoom));
      return layers;
    },
  }),
  f({
    id: 'heatmap',
    order: 150,
    deps: ['events', 'viewport'],
    viewportMode: 'zoom',
    create(state: ConsoleState) {
      const layer = createSeismicHeatmapLayer(state.events, state.viewport.zoom);
      return layer ? [layer] : [];
    },
  }),
  f({
    id: 'faults',
    order: 200,
    deps: ['faults', 'viewport', 'selectedEvent'],
    create(state: ConsoleState) {
      const selectedFaultId = state.selectedEvent?.scenarioFaultId ?? null;
      const faultLayers = createFaultLayer(state.faults, state.viewport.zoom, selectedFaultId);
      return faultLayers ?? [];
    },
  }),
  f({
    id: 'rail',
    order: 250,
    deps: ['selectedEvent', 'viewport', 'railStatuses', 'sequenceSWaveKm'],
    create(state: ConsoleState) {
      return createRailLayers(state.selectedEvent, state.viewport.zoom, state.railStatuses, state.sequenceSWaveKm);
    },
  }),
  f({
    id: 'airports',
    order: 252,
    deps: ['selectedEvent', 'viewport', 'sequenceSWaveKm'],
    create(state: ConsoleState) {
      return createAirportLayers(state.selectedEvent, state.viewport.zoom, state.sequenceSWaveKm, state.viewport.bounds);
    },
  }),
  f({
    id: 'transport',
    order: 254,
    deps: ['selectedEvent', 'viewport', 'sequenceSWaveKm'],
    create(state: ConsoleState) {
      return createTransportNodeLayers(state.selectedEvent, state.viewport.zoom, state.sequenceSWaveKm, state.viewport.bounds);
    },
  }),
  f({
    id: 'power',
    order: 260,
    deps: ['selectedEvent', 'viewport', 'sequenceSWaveKm'],
    create(state: ConsoleState) {
      return createPowerLayers(state.selectedEvent, state.viewport.zoom, state.sequenceSWaveKm, state.viewport.bounds);
    },
  }),
  f({
    id: 'ais',
    order: 300,
    deps: ['vessels', 'selectedEvent', 'viewport'],
    viewportMode: 'full',
    create(state: ConsoleState) {
      return createAisLayers(state.vessels, state.selectedEvent, state.viewport);
    },
  }),
  f({
    id: 'hospitals',
    order: 350,
    deps: ['selectedEvent', 'viewport', 'sequenceSWaveKm'],
    create(state: ConsoleState) {
      return createHospitalLayers(state.selectedEvent, state.viewport.zoom, state.sequenceSWaveKm, state.viewport.bounds);
    },
  }),
  f({
    id: 'seismic-depth',
    order: 390,
    deps: ['events', 'catalogEvents', 'selectedEvent', 'viewport'],
    viewportMode: 'full',
    create(state: ConsoleState) {
      const selectedId = state.selectedEvent?.id ?? null;
      // Merge live + historical catalog events for 3D depth rendering
      const allEvents = state.catalogEvents.length > 0
        ? deduplicateEvents(state.events, state.catalogEvents)
        : state.events;
      const pitch = state.viewport.pitch ?? 0;
      return createSeismicDepthLayers(allEvents, selectedId, state.viewport.zoom, pitch);
    },
  }),
  f({
    id: 'earthquakes',
    order: 400,
    deps: ['events', 'catalogEvents', 'selectedEvent'],
    create(state: ConsoleState) {
      const selectedId = state.selectedEvent?.id ?? null;
      // Merge live + historical catalog events
      const allEvents = state.catalogEvents.length > 0
        ? deduplicateEvents(state.events, state.catalogEvents)
        : state.events;
      const layer = createEarthquakeLayer(allEvents, selectedId);
      return layer ? [layer] : [];
    },
  }),
  f({
    id: 'buildings',
    order: 500,
    deps: ['selectedEvent', 'intensityGrid', 'viewport'],
    viewportMode: 'full',
    create(state: ConsoleState) {
      return createBuildingLayers(
        state.selectedEvent,
        state.intensityGrid,
        state.viewport.zoom,
        state.viewport.center.lat,
        state.viewport.center.lng,
        null, // auto-select city from viewport center
      );
    },
  }),
];

assertLayerArchitecture(LAYER_PLUGINS);

export const LAYER_FACTORIES: LayerFactory[] = buildLayerFactoryRegistry(LAYER_PLUGINS);
