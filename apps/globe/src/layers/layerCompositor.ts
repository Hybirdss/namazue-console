/**
 * Layer Compositor — Orchestrates deck.gl layers with proper performance.
 *
 * Architecture:
 *   EVENT-DRIVEN: compositor is IDLE by default (0% CPU).
 *   Renders only when:
 *     (a) A dirty flag is set (store change) -> single frame via requestRender()
 *     (b) Animations are active (waves/intensity/sequence) -> continuous rAF loop
 *     (c) Calm pulse is active -> slow timer (~15fps) for earthquake breathing
 *   When animations end, loop stops automatically.
 *
 *   - Factory layers: registered in layerFactories.ts, auto-managed dirty tracking
 *   - Asset layer: contextual infrastructure markers, tied to seismic posture
 *   - Wave layer: animation-driven overlay for real-time events
 *   - Wave sequence: 3-second propagation replay for selected events
 *   - Calm pulse: slow breathing animation for recent earthquake dots
 *
 * Adding a new layer does NOT require touching this file.
 * Register it in layerFactories.ts instead.
 */

import type { Layer } from '@deck.gl/core';
import type { MapEngine } from '../core/mapEngine';
import { consoleStore } from '../core/store';
import { createPerformanceGate } from '../core/performanceGate';
import { LAYER_FACTORIES } from './layerFactories';
import { isLayerEffectivelyVisible, type BundleSettings } from './bundleRegistry';
import { createAssetLayers } from './assetLayer';
import { updateWaveData, createWaveLayers, type WaveSource } from './waveLayer';
import { createIntensityLayer } from './intensityLayer';
import { createEarthquakeLayer, createEarthquakeInnerGlowLayer, createEarthquakeOuterGlowLayer, createEarthquakeAgeRingLayer } from './earthquakeLayer';

import { createImpactGlowLayer, createImpactZoneLayers } from './impactVisualization';
import { isLayerSuppressedByPolicy } from './layerRenderPolicy';
import {
  createSequenceLayers,
  getSWaveRadiusKm,
  isSequenceActive,
  startSequence,
  createInactiveSequence,
  type WaveSequenceState,
} from './waveSequence';
import {
  createDefaultEventSequenceState,
  createEventSequenceState,
  deriveEventSequenceFrame,
  type EventSequenceState,
} from './eventSequenceState';
import { jmaThresholdDistanceKm } from '../engine/gmpe';
import { createDistanceRingLayers } from './distanceRings';
import { createAfterShockZoneLayers } from './aftershockZone';
import { createBearingLineLayers } from './bearingLines';
import { createDmatDeploymentLayers } from './dmatLines';
import {
  generateAftershockCascade,
  createAftershockCascadeLayers,
  type AftershockCascadeState,
} from './aftershockCascadeLayer';
import {
  buildLayerGateStatuses,
  createDefaultLayerGateStatuses,
  type BuildingLayerSupportFacts,
  type LayerGateStatusMap,
} from './layerGateStatus';
import { BUILDING_LAYER_MIN_ZOOM, resolveRenderableBuildingCity } from './buildingLayer';
import type { LayerId } from './layerRegistry';
import type { EarthquakeEvent } from '../types';
import type { OpsAssetExposure } from '../ops/types';
import { toWaveHandoffDisplayKm } from '../presentation/waveHandoff';

// ── Wave Source Extraction ─────────────────────────────────────

function extractWaveSources(events: EarthquakeEvent[]): WaveSource[] {
  const now = Date.now();
  const waveCutoff = now - 300_000;

  return events
    .filter((e) => e.time > waveCutoff && e.magnitude >= 4.0)
    .map((e) => ({
      id: e.id,
      lat: e.lat,
      lng: e.lng,
      depth_km: e.depth_km,
      magnitude: e.magnitude,
      faultType: e.faultType,
      originTime: e.time,
    }));
}

// ── Compositor ─────────────────────────────────────────────────

export interface LayerCompositor {
  start(): void;
  stop(): void;
}

export function cloneRenderableLayers(layers: Layer[] | undefined): Layer[] {
  if (!layers?.length) return [];
  return layers.map((layer) => layer.clone({}));
}

export function createLayerCompositor(engine: MapEngine): LayerCompositor {
  let running = false;
  let frameId: number | null = null;
  let renderRequested = false;
  let suppressRenderRequests = false;

  // Factory layer cache and dirty tracking
  const dirty = new Map<LayerId, boolean>();
  const cache = new Map<LayerId, Layer[]>();
  let anyFactoryDirty = false;

  // Visibility / bundle cache
  let dirtyVisibility = true;
  let cachedVis: Record<LayerId, boolean> = {} as Record<LayerId, boolean>;
  let cachedBundleSettings: BundleSettings = consoleStore.get('bundleSettings');

  // Zoom cache
  let cachedZoom = consoleStore.get('viewport').zoom;

  // Asset layer (contextual markers)
  let assetLayers: Layer[] = [];
  let dirtyAssets = true;
  let selectedStaticLayers: Layer[] = [];
  let selectedStaticKey: string | null = null;

  // Wave animation state (real-time events)
  let waveSources: WaveSource[] = [];
  let lastWaveUpdate = 0;
  const WAVE_UPDATE_INTERVAL = 50;

  // Wave sequence state (selected event replay)
  let sequence: WaveSequenceState = createInactiveSequence();

  // Intensity animation state
  // Spread speed derived per-event: maxRadiusKm / durationSec
  const INTENSITY_ANIM_DURATION = 3000;
  const INTENSITY_ANIM_INTERVAL = 50;
  let intensityAnimStart = 0;
  let intensityAnimEpicenter: { lat: number; lng: number } | null = null;
  let intensityAnimMaxRadiusKm = 0;
  let lastIntensityAnimUpdate = 0;
  const performanceGate = createPerformanceGate({
    minFps: consoleStore.get('performanceStatus').minFps,
  });
  let lastPerformanceTone = consoleStore.get('performanceStatus').tone;
  let lastPerformancePublishAt = 0;
  const PERFORMANCE_PUBLISH_INTERVAL = 1500;
  // Aftershock cascade state — TripsLayer animation after wave sequence
  let cascadeState: AftershockCascadeState | null = null;
  let cascadeStartTime = 0;

  // Calm pulse state — slow breathing for recent earthquake dots
  const CALM_PULSE_INTERVAL = 66; // ~15fps
  const RECENT_EVENT_WINDOW = 3600_000; // 1 hour
  let calmPulseTimer: ReturnType<typeof setInterval> | null = null;

  // ── Calm Pulse Management ─────────────────────────────────────

  function hasRecentEvents(): boolean {
    const events = consoleStore.get('events');
    const cutoff = Date.now() - RECENT_EVENT_WINDOW;
    return events.some((e) => e.time > cutoff);
  }

  function startCalmPulse(): void {
    if (calmPulseTimer) return;
    calmPulseTimer = setInterval(() => {
      requestRender();
    }, CALM_PULSE_INTERVAL);
  }

  function stopCalmPulse(): void {
    if (calmPulseTimer) {
      clearInterval(calmPulseTimer);
      calmPulseTimer = null;
    }
  }

  function manageCalmPulse(): void {
    const selected = consoleStore.get('selectedEvent');
    const seqRunning = isSequenceActive(sequence, Date.now());

    // Calm pulse for unselected mode with recent events
    // OR slow glow pulse for selected event (impact glow ring breathes)
    const shouldPulse = !seqRunning && (
      (!selected && hasRecentEvents()) || selected != null
    );
    if (shouldPulse) {
      startCalmPulse();
    } else {
      stopCalmPulse();
    }
  }

  // ── Animation state helpers ───────────────────────────────────

  function hasActiveAnimations(): boolean {
    const now = Date.now();
    return waveSources.length > 0 ||
      isSequenceActive(sequence, now) ||
      (intensityAnimEpicenter != null && intensityAnimStart > 0) ||
      cascadeState != null;
  }

  // ── Event-driven render scheduling ────────────────────────────

  function requestRender(): void {
    if (!running) return;
    if (suppressRenderRequests) return;
    if (renderRequested || frameId !== null) return;
    renderRequested = true;
    frameId = requestAnimationFrame(tick);
  }

  function buildBuildingSupportFacts(): BuildingLayerSupportFacts {
    const viewport = consoleStore.get('viewport');
    return {
      minimumZoom: BUILDING_LAYER_MIN_ZOOM,
      hasSupportedCity: resolveRenderableBuildingCity(
        viewport.center.lat,
        viewport.center.lng,
      ) !== null,
    };
  }

  function areEventSequenceStatesEqual(
    a: EventSequenceState,
    b: EventSequenceState,
  ): boolean {
    return a.mode === b.mode
      && a.phase === b.phase
      && a.active === b.active
      && a.selectedEventId === b.selectedEventId
      && a.startedAt === b.startedAt
      && a.elapsedMs === b.elapsedMs
      && a.sWaveRadiusKm === b.sWaveRadiusKm
      && a.handoffKm === b.handoffKm;
  }

  function areLayerGateStatusMapsEqual(
    a: LayerGateStatusMap,
    b: LayerGateStatusMap,
  ): boolean {
    const keys = new Set([
      ...Object.keys(a),
      ...Object.keys(b),
    ]);

    for (const key of keys) {
      const current = a[key as keyof LayerGateStatusMap];
      const next = b[key as keyof LayerGateStatusMap];

      if (current === next) continue;
      if (current == null || next == null) return false;
      if (
        current.layerId !== next.layerId
        || current.code !== next.code
        || current.blocking !== next.blocking
      ) {
        return false;
      }
    }

    return true;
  }

  // ── Store subscriptions ─────────────────────────────────────

  const unsubs: (() => void)[] = [];

  function watch(key: string, fn: () => void): () => void {
    return (consoleStore as any).subscribe(key, fn);
  }

  // Build dep index: storeKey -> factoryIds
  const depIndex = new Map<string, LayerId[]>();
  const viewportZoomFactoryIds: LayerId[] = [];
  const viewportFullFactoryIds: LayerId[] = [];
  for (const factory of LAYER_FACTORIES) {
    for (const dep of factory.deps) {
      if (dep === 'viewport') {
        if (factory.viewportMode === 'full') {
          viewportFullFactoryIds.push(factory.id);
        } else {
          viewportZoomFactoryIds.push(factory.id);
        }
        continue;
      }
      if (!depIndex.has(dep as string)) depIndex.set(dep as string, []);
      depIndex.get(dep as string)!.push(factory.id);
    }
  }

  // Auto-subscribe: each unique dep key marks its factories dirty AND requests render
  for (const [key, factoryIds] of depIndex) {
    unsubs.push(watch(key, () => {
      for (const id of factoryIds) dirty.set(id, true);
      anyFactoryDirty = true;
      requestRender();
    }));
  }

  // Viewport subscription: zoom-only vs full
  if (viewportZoomFactoryIds.length > 0 || viewportFullFactoryIds.length > 0) {
    unsubs.push(watch('viewport', () => {
      let changed = false;

      if (viewportFullFactoryIds.length > 0) {
        for (const id of viewportFullFactoryIds) dirty.set(id, true);
        changed = true;
      }

      const newZoom = consoleStore.get('viewport').zoom;
      if (Math.abs(newZoom - cachedZoom) >= 0.01) {
        cachedZoom = newZoom;
        for (const id of viewportZoomFactoryIds) dirty.set(id, true);
        changed = true;
      }

      if (changed) {
        anyFactoryDirty = true;
        requestRender();
      }
    }));
  }

  // Visibility/bundle changes
  unsubs.push(watch('layerVisibility', () => { dirtyVisibility = true; requestRender(); }));
  unsubs.push(watch('bundleSettings', () => { dirtyVisibility = true; requestRender(); }));
  unsubs.push(watch('activeBundleId', () => { requestRender(); }));

  // Real-time wave sources derived from events
  unsubs.push(
    consoleStore.subscribe('events', (events) => {
      waveSources = extractWaveSources(events);
      manageCalmPulse();
      requestRender();
    }),
  );

  // Selected event -> start wave sequence + intensity animation
  unsubs.push(
    consoleStore.subscribe('selectedEvent', (event) => {
      if (event) {
        // Start the 3-second wave sequence replay
        sequence = startSequence(
          { lat: event.lat, lng: event.lng },
          event.magnitude,
          event.depth_km,
          event.faultType,
        );
        // Pre-generate aftershock cascade (plays after sequence ends)
        cascadeState = generateAftershockCascade(event);
        cascadeStartTime = 0; // will be set when sequence ends

        stopCalmPulse();
        maybeStartIntensityAnim();

        const seededSequence = deriveEventSequenceFrame({
          state: createEventSequenceState({
            mode: 'live-selection',
            active: true,
            selectedEventId: event.id,
            startedAt: sequence.startTime,
          }),
          now: sequence.startTime,
          selectedEvent: event,
        });
        const layerGateStatuses = buildLayerGateStatuses({
          state: {
            selectedEvent: event,
            intensityGrid: consoleStore.get('intensityGrid'),
            viewport: { zoom: consoleStore.get('viewport').zoom },
            buildingSupport: buildBuildingSupportFacts(),
          },
          sequence: seededSequence,
        });

        consoleStore.batch(() => {
          consoleStore.set('eventSequence', seededSequence);
          consoleStore.set('sequenceSWaveKm', null);
          consoleStore.set('layerGateStatuses', layerGateStatuses);
        });
      } else {
        sequence = createInactiveSequence();
        cascadeState = null;
        cascadeStartTime = 0;
        intensityAnimStart = 0;
        intensityAnimEpicenter = null;

        selectedStaticLayers = [];
        selectedStaticKey = null;

        consoleStore.batch(() => {
          consoleStore.set('eventSequence', createDefaultEventSequenceState());
          consoleStore.set('sequenceSWaveKm', null);
          consoleStore.set('layerGateStatuses', createDefaultLayerGateStatuses());
        });
        manageCalmPulse();
      }
      requestRender();
    }),
  );

  // Intensity grid -> start animation if event selected
  function maybeStartIntensityAnim(): void {
    const event = consoleStore.get('selectedEvent');
    const grid = consoleStore.get('intensityGrid');
    if (event && grid) {
      intensityAnimStart = Date.now();
      intensityAnimEpicenter = { lat: event.lat, lng: event.lng };
      intensityAnimMaxRadiusKm = jmaThresholdDistanceKm(event.magnitude, event.depth_km, event.faultType);
      lastIntensityAnimUpdate = 0;
      requestRender();
    }
  }

  unsubs.push(
    consoleStore.subscribe('intensityGrid', (grid) => {
      if (grid && consoleStore.get('selectedEvent')) {
        maybeStartIntensityAnim();
      }
    }),
  );

  // Asset layer depends on exposures, viewport tier, and highlighted asset
  unsubs.push(watch('exposures', () => { dirtyAssets = true; requestRender(); }));
  unsubs.push(watch('viewport', () => { dirtyAssets = true; requestRender(); }));
  unsubs.push(watch('highlightedAssetId', () => { dirtyAssets = true; requestRender(); }));
  unsubs.push(watch('assetCategoryVisibility', () => { dirtyAssets = true; requestRender(); }));

  // ── Render loop ─────────────────────────────────────────────

  function buildSelectedStaticKey(
    selectedEvent: EarthquakeEvent,
    exposures: OpsAssetExposure[],
  ): string {
    const exposureKey = exposures
      .map((exposure) => `${exposure.assetId}:${exposure.severity}`)
      .join('|');
    return [
      selectedEvent.id,
      selectedEvent.lat.toFixed(4),
      selectedEvent.lng.toFixed(4),
      selectedEvent.magnitude.toFixed(2),
      selectedEvent.depth_km.toFixed(1),
      exposureKey,
    ].join('|');
  }

  function tick(): void {
    if (!running) return;
    frameId = null;
    renderRequested = false;

    const now = Date.now();
    const perfStatus = performanceGate.sample(now);
    if (perfStatus && (
      perfStatus.tone !== lastPerformanceTone
      || now - lastPerformancePublishAt >= PERFORMANCE_PUBLISH_INTERVAL
    )) {
      consoleStore.set('performanceStatus', perfStatus);
      lastPerformanceTone = perfStatus.tone;
      lastPerformancePublishAt = now;
    }
    const layers: Layer[] = [];

    // Refresh visibility cache only when changed
    if (dirtyVisibility) {
      cachedVis = consoleStore.get('layerVisibility');
      cachedBundleSettings = consoleStore.get('bundleSettings');
      dirtyVisibility = false;
    }

    const layerPolicyContext = {
      activeBundleId: consoleStore.get('activeBundleId'),
      bundleSettings: cachedBundleSettings,
      viewportTier: consoleStore.get('viewport').tier,
      performanceTone: lastPerformanceTone,
    } as const;

    // ── 1. Factory layers (ordered by factory.order) ──────────────
    const seqActive = isSequenceActive(sequence, now);
    const intensityAnimActive = intensityAnimEpicenter != null && intensityAnimStart > 0;
    const intensityDrivenBySequence = seqActive && intensityAnimActive;
    const currentState = consoleStore.getState();
    const selectedEvent = currentState.selectedEvent;
    const nextEventSequence = deriveEventSequenceFrame({
      state: selectedEvent
        ? createEventSequenceState({
          ...currentState.eventSequence,
          mode: currentState.eventSequence.mode,
          active: sequence.active,
          selectedEventId: selectedEvent.id,
          startedAt: sequence.startTime || currentState.eventSequence.startedAt,
        })
        : currentState.eventSequence,
      now,
      selectedEvent,
    });
    const eventSequenceFrame = selectedEvent == null
      && areEventSequenceStatesEqual(currentState.eventSequence, createDefaultEventSequenceState())
      ? currentState.eventSequence
      : nextEventSequence;
    const nextPublishedSequenceSWaveKm = eventSequenceFrame.sWaveRadiusKm == null
      ? null
      : toWaveHandoffDisplayKm(eventSequenceFrame.sWaveRadiusKm);
    const nextLayerGateStatuses = buildLayerGateStatuses({
      state: {
        selectedEvent,
        intensityGrid: currentState.intensityGrid,
        viewport: { zoom: currentState.viewport.zoom },
        buildingSupport: buildBuildingSupportFacts(),
      },
      sequence: eventSequenceFrame,
    });
    const shouldPublishEventSequence = !areEventSequenceStatesEqual(
      currentState.eventSequence,
      eventSequenceFrame,
    );
    const shouldPublishSequenceSWaveKm = currentState.sequenceSWaveKm !== nextPublishedSequenceSWaveKm;
    const shouldPublishLayerGateStatuses = !areLayerGateStatusMapsEqual(
      currentState.layerGateStatuses,
      nextLayerGateStatuses,
    );

    if (
      shouldPublishEventSequence
      || shouldPublishSequenceSWaveKm
      || shouldPublishLayerGateStatuses
    ) {
      suppressRenderRequests = true;
      try {
        consoleStore.batch(() => {
          if (shouldPublishEventSequence) {
            consoleStore.set('eventSequence', eventSequenceFrame);
          }
          if (shouldPublishSequenceSWaveKm) {
            consoleStore.set('sequenceSWaveKm', nextPublishedSequenceSWaveKm);
          }
          if (shouldPublishLayerGateStatuses) {
            consoleStore.set('layerGateStatuses', nextLayerGateStatuses);
          }
        });
      } finally {
        suppressRenderRequests = false;
      }
    } else {
      // No store publish needed in fast path
    }

    // Calm pulse: slow breathing for recent earthquake dots
    const calmPulseActive = !seqActive && !consoleStore.get('selectedEvent') && hasRecentEvents();
    const pulseScale = calmPulseActive
      ? 1 + 0.12 * Math.sin(now * 0.0015)
      : 1;

    if (anyFactoryDirty) {
      for (const factory of LAYER_FACTORIES) {
        if (dirty.get(factory.id)) {
          cache.set(factory.id, factory.create(consoleStore.getState()));
          dirty.set(factory.id, false);
        }
      }
      anyFactoryDirty = false;
    }

    for (const factory of LAYER_FACTORIES) {
      // Intensity handled separately (animation override below)
      if (factory.id === 'intensity' && (intensityAnimActive || intensityDrivenBySequence)) continue;

      // Earthquake layer: add ambient glow behind dots + calm pulse override
      if (factory.id === 'earthquakes') {
        if (
          isLayerEffectivelyVisible('earthquakes', cachedVis['earthquakes'], cachedBundleSettings)
          && !isLayerSuppressedByPolicy('earthquakes', layerPolicyContext)
        ) {
          const state = consoleStore.getState();
          const selectedId = state.selectedEvent?.id ?? null;

          // Suppress glow/ring effects when dense — dots alone suffice
          const dense = state.events.length > 500;

          if (!dense) {
            const ageRingLayer = createEarthquakeAgeRingLayer(state.events);
            if (ageRingLayer) layers.push(ageRingLayer);

            const outerGlow = createEarthquakeOuterGlowLayer(state.events);
            if (outerGlow) layers.push(outerGlow);
            const innerGlow = createEarthquakeInnerGlowLayer(state.events);
            if (innerGlow) layers.push(innerGlow);
          }

          if (calmPulseActive) {
            layers.push(createEarthquakeLayer(state.events, selectedId, pulseScale));
          } else {
            const cached = cache.get(factory.id);
            if (cached) layers.push(...cloneRenderableLayers(cached));
          }
        }
        continue;
      }

      if (
        isLayerEffectivelyVisible(factory.id, cachedVis[factory.id], cachedBundleSettings)
        && !isLayerSuppressedByPolicy(factory.id, layerPolicyContext)
      ) {
        const cached = cache.get(factory.id);
        if (cached) layers.push(...cloneRenderableLayers(cached));
      }
    }

    // ── 1b. Intensity animation ─────────────────────────────────
    const intensityVisible = isLayerEffectivelyVisible('intensity', cachedVis['intensity'], cachedBundleSettings)
      && !isLayerSuppressedByPolicy('intensity', layerPolicyContext);
    // Scenario events use reduced opacity so the intensity field looks less alarming
    const selectedId = consoleStore.get('selectedEvent')?.id;
    const intensityOpacity = selectedId?.startsWith('scenario-') ? 0.45 : undefined;

    if (intensityDrivenBySequence) {
      // Wave sequence drives intensity reveal — S-wave front determines visible radius
      const sWaveKm = getSWaveRadiusKm(sequence, now);
      const grid = consoleStore.get('intensityGrid');

      if (grid && sWaveKm < Infinity) {
        if (now - lastIntensityAnimUpdate >= INTENSITY_ANIM_INTERVAL) {
          const animLayer = createIntensityLayer(grid, sequence.epicenter, sWaveKm, intensityOpacity);
          cache.set('intensity', animLayer ? [animLayer] : []);
          lastIntensityAnimUpdate = now;
        }
        if (intensityVisible) {
          const cached = cache.get('intensity');
          if (cached) layers.push(...cloneRenderableLayers(cached));
        }
      }
    } else if (intensityAnimActive) {
      // Independent intensity animation (sequence ended or non-sequence trigger)
      const elapsed = now - intensityAnimStart;
      if (elapsed < INTENSITY_ANIM_DURATION) {
        if (now - lastIntensityAnimUpdate >= INTENSITY_ANIM_INTERVAL) {
          const revealRadiusKm = (elapsed / INTENSITY_ANIM_DURATION) * intensityAnimMaxRadiusKm;
          const grid = consoleStore.get('intensityGrid');
          if (grid) {
            const animLayer = createIntensityLayer(grid, intensityAnimEpicenter!, revealRadiusKm, intensityOpacity);
            cache.set('intensity', animLayer ? [animLayer] : []);
            lastIntensityAnimUpdate = now;
          }
        }
        if (intensityVisible) {
          const cached = cache.get('intensity');
          if (cached) layers.push(...cloneRenderableLayers(cached));
        }
      } else {
        // Animation complete — final full render
        dirty.set('intensity', true);
        intensityAnimStart = 0;
        intensityAnimEpicenter = null;
        lastIntensityAnimUpdate = 0;
        cache.set('intensity', LAYER_FACTORIES.find((f) => f.id === 'intensity')!.create(consoleStore.getState()));
        dirty.set('intensity', false);
        if (intensityVisible) {
          const cached = cache.get('intensity');
          if (cached) layers.push(...cloneRenderableLayers(cached));
        }
        // Resume calm pulse if appropriate
        manageCalmPulse();
      }
    } else {
      // Static intensity (no animation)
      if (intensityVisible) {
        const cached = cache.get('intensity');
        if (cached) layers.push(...cloneRenderableLayers(cached));
      }
    }

    // ── 2. Asset markers ────────────────────────────────────────
    if (dirtyAssets) {
      const vp = consoleStore.get('viewport');
      const exposures = consoleStore.get('exposures');
      const highlightId = consoleStore.get('highlightedAssetId');
      const categoryVisibility = consoleStore.get('assetCategoryVisibility');
      assetLayers = createAssetLayers(vp.tier, exposures, highlightId, vp.zoom, categoryVisibility);
      dirtyAssets = false;
    }
    // Assets always visible — they're infrastructure context, not seismic data
    layers.push(...cloneRenderableLayers(assetLayers));

    // ── 3. Impact visualization (glow ring + impact zone + connection arcs) ──
    // Rendered when an event is selected, persists beyond sequence
    if (selectedEvent) {
      const exposures = consoleStore.get('exposures');
      const selectedKey = buildSelectedStaticKey(selectedEvent, exposures);
      if (selectedStaticKey !== selectedKey) {
        selectedStaticLayers = [
          ...createImpactZoneLayers(selectedEvent, exposures),
          ...(selectedEvent.magnitude >= 6.0 ? createAfterShockZoneLayers(selectedEvent) : []),
          ...createDistanceRingLayers(selectedEvent),
          ...createBearingLineLayers(selectedEvent, exposures),
          ...createDmatDeploymentLayers(selectedEvent),
        ];
        selectedStaticKey = selectedKey;
      }
      layers.push(createImpactGlowLayer(selectedEvent, now));
      layers.push(...cloneRenderableLayers(selectedStaticLayers));
    } else if (selectedStaticKey !== null) {
      selectedStaticKey = null;
      selectedStaticLayers = [];
    }

    // ── 4. Real-time wave overlay ───────────────────────────────
    if (waveSources.length > 0) {
      if (now - lastWaveUpdate >= WAVE_UPDATE_INTERVAL) {
        updateWaveData(waveSources, now);
        lastWaveUpdate = now;
      }
      layers.push(...createWaveLayers());
    }

    // ── 5. Aftershock cascade (TripsLayer animation after sequence) ──
    // Starts after wave sequence ends, loops while event is selected
    const cascadeVisible = cascadeState != null
      && selectedEvent != null
      && (
        eventSequenceFrame.phase === 'aftershock-cascade'
        || eventSequenceFrame.phase === 'settled'
      );
    if (cascadeVisible && cascadeState) {
      if (cascadeStartTime === 0) {
        cascadeStartTime = now;
      }
      const cascadeElapsed = (now - cascadeStartTime) / 1000;
      layers.push(...createAftershockCascadeLayers(cascadeState, cascadeElapsed));
    }

    // ── 6. Wave sequence layers (flash + P-rings + S-rings + fill) ──
    // Rendered ON TOP of everything for maximum visual impact
    if (seqActive) {
      layers.push(...createSequenceLayers(sequence, now));
    }

    engine.setLayers(layers.filter(Boolean) as Layer[]);

    // ── Animation loop management ───────────────────────────────
    // Full-speed rAF for active animations; calm pulse uses its own slow timer
    if (hasActiveAnimations()) {
      frameId = requestAnimationFrame(tick);
    } else if (seqActive) {
      // Sequence just ended this frame — do final intensity render next frame
      sequence = createInactiveSequence();
      requestRender();
    }
  }

  return {
    start() {
      if (running) return;
      running = true;

      waveSources = extractWaveSources(consoleStore.get('events'));

      for (const factory of LAYER_FACTORIES) {
        dirty.set(factory.id, true);
      }
      anyFactoryDirty = true;
      dirtyAssets = true;
      dirtyVisibility = true;
      lastWaveUpdate = 0;
      selectedStaticLayers = [];
      selectedStaticKey = null;

      requestRender();
      manageCalmPulse();
    },

    stop() {
      running = false;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      stopCalmPulse();
      for (const unsub of unsubs) unsub();
    },
  };
}
