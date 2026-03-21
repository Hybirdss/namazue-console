/**
 * Selection Manager — Encapsulates event selection state and derived ops truth.
 *
 * Extracted from bootstrap.ts to isolate the mutable selection state machine:
 *   - selectedEvent locking (lockedSelectedEventId)
 *   - ShakeMap fetch lifecycle (token, cache, pending ID)
 *   - Operational truth scheduling (rAF-debounced syncOperationalTruth)
 *   - Realtime feed metadata (lastFetchSource, lastUpdatedAt, lastRealtimeStatus)
 *
 * Usage:
 *   const selection = createSelectionManager({ engine, getRealtimeStatus });
 *   selection.selectEvent(event);
 *   selection.deselectEvent();
 *   selection.dispose();
 */

import type { EarthquakeEvent, IntensityGrid } from '../types';
import type { RealtimeSource, RealtimeStatus } from '../ops/readModelTypes';
import { consoleStore } from './store';
import { deriveConsoleOperationalState, refreshConsoleBundleTruth } from './consoleOps';
import { createEmptyServiceReadModel } from '../ops/serviceReadModel';
import { OPS_ASSETS } from '../ops/assetCatalog';
import { abortShakeMapFetch, fetchShakeMap } from '../data/shakeMapApi';
import { shakeMapProductsToIntensityGrid } from '../data/shakeMapGrid';
import { jmaThresholdDistanceKm } from '../engine/gmpe';

// ── Public interface ─────────────────────────────────────────

export interface SelectionManagerDeps {
  /** MapLibre map instance — used for fitBounds on selectEvent. */
  map: { fitBounds: (...args: any[]) => void };
}

export interface SelectionManager {
  selectEvent(event: EarthquakeEvent): void;
  deselectEvent(): void;
  scheduleOperationalTruth(selectedOverride?: EarthquakeEvent | null): void;
  syncShakeMapForEvent(event: EarthquakeEvent | null): void;
  cancelPendingSelectionSync(): void;
  /** Called by the data poller whenever fresh feed metadata arrives. */
  updateRealtimeState(source: RealtimeSource, updatedAt: number, status: RealtimeStatus): void;
  /** Returns the current realtime metadata (for error-path reads). */
  getRealtimeState(): { source: RealtimeSource; updatedAt: number; status: RealtimeStatus };
  getLockedSelectedEventId(): string | null;
  setLockedSelectedEventId(id: string | null): void;
  dispose(): void;
}

// ── Factory ──────────────────────────────────────────────────

export function createSelectionManager(deps: SelectionManagerDeps): SelectionManager {
  const { map } = deps;

  // ── Mutable state ────────────────────────────────────────
  let selectionSyncFrame: number | null = null;
  let selectionSyncToken = 0;
  let lockedSelectedEventId: string | null = null;
  const shakeMapGridCache = new Map<string, IntensityGrid | null>();
  let shakeMapRequestToken = 0;
  let pendingShakeMapEventId: string | null = null;

  // Realtime feed metadata — updated by the data poller via updateRealtimeState()
  let lastFetchSource: RealtimeSource = 'server';
  let lastUpdatedAt = 0;
  let lastRealtimeStatus: RealtimeStatus = consoleStore.get('realtimeStatus');

  // ── Internal helpers ─────────────────────────────────────

  function cancelPendingSelectionSync(): void {
    selectionSyncToken += 1;
    if (selectionSyncFrame !== null) {
      cancelAnimationFrame(selectionSyncFrame);
      selectionSyncFrame = null;
    }
  }

  function buildPendingSelectionReadModel(
    selectedEvent: EarthquakeEvent,
  ): ReturnType<typeof createEmptyServiceReadModel> {
    return refreshConsoleBundleTruth({
      readModel: createEmptyServiceReadModel(consoleStore.get('realtimeStatus')),
      realtimeStatus: consoleStore.get('realtimeStatus'),
      selectedEvent,
      exposures: [],
      vessels: consoleStore.get('vessels'),
      assets: OPS_ASSETS,
      domainOverrides: consoleStore.get('domainOverrides'),
      railStatuses: consoleStore.get('railStatuses'),
    });
  }

  function getCachedShakeMapGrid(event: EarthquakeEvent | null | undefined): IntensityGrid | null {
    if (!event || event.id.startsWith('scenario-') || !shakeMapGridCache.has(event.id)) {
      return null;
    }
    return shakeMapGridCache.get(event.id) ?? null;
  }

  function syncShakeMapForEvent(event: EarthquakeEvent | null): void {
    if (!event || event.id.startsWith('scenario-')) {
      shakeMapRequestToken += 1;
      pendingShakeMapEventId = null;
      abortShakeMapFetch();
      return;
    }

    if (shakeMapGridCache.has(event.id) || pendingShakeMapEventId === event.id) {
      return;
    }

    const requestToken = ++shakeMapRequestToken;
    pendingShakeMapEventId = event.id;
    fetchShakeMap(event.id)
      .then((products) => {
        if (requestToken !== shakeMapRequestToken) return;
        pendingShakeMapEventId = null;
        shakeMapGridCache.set(event.id, shakeMapProductsToIntensityGrid(products));
        if (
          consoleStore.get('selectedEvent')?.id === event.id ||
          lockedSelectedEventId === event.id
        ) {
          scheduleOperationalTruth(event);
        }
      })
      .catch(() => {
        if (requestToken !== shakeMapRequestToken) return;
        pendingShakeMapEventId = null;
        shakeMapGridCache.set(event.id, null);
      });
  }

  function syncOperationalTruth(
    selectedOverride?: EarthquakeEvent | null,
    token?: number,
  ): void {
    const baseEvents = consoleStore.get('events');
    const events =
      selectedOverride && !baseEvents.some((entry) => entry.id === selectedOverride.id)
        ? [selectedOverride, ...baseEvents]
        : baseEvents;

    const selectedEvent = selectedOverride ?? consoleStore.get('selectedEvent') ?? null;
    const shakeMapGrid = getCachedShakeMapGrid(selectedEvent);
    const result = deriveConsoleOperationalState({
      now: Date.now(),
      events,
      currentSelectedEventId: selectedEvent?.id ?? null,
      forceSelection: selectedOverride !== undefined,
      source: lastFetchSource,
      updatedAt: lastUpdatedAt || Date.now(),
      realtimeStatusOverride: lastRealtimeStatus,
      viewport: consoleStore.get('viewport'),
      faults: consoleStore.get('faults'),
      domainOverrides: consoleStore.get('domainOverrides'),
      railStatuses: consoleStore.get('railStatuses'),
      shakeMapGrid,
      shakeMapEventId: shakeMapGrid ? (selectedEvent?.id ?? null) : null,
    });

    if (token !== undefined && token !== selectionSyncToken) {
      return;
    }

    // Batch: all 7 updates fire subscribers only once per key, after batch completes.
    // Without batch: 7 sequential .set() → 15+ cascading subscriber callbacks.
    consoleStore.batch(() => {
      consoleStore.set('mode', result.mode);
      consoleStore.set('selectedEvent', result.selectedEvent);
      consoleStore.set('intensityGrid', result.intensityGrid);
      consoleStore.set('exposures', result.exposures);
      consoleStore.set('priorities', result.priorities);
      consoleStore.set('readModel', result.readModel);
      consoleStore.set('realtimeStatus', result.realtimeStatus);
    });

    syncShakeMapForEvent(result.selectedEvent);
  }

  function scheduleOperationalTruth(selectedOverride?: EarthquakeEvent | null): void {
    const token = ++selectionSyncToken;
    if (selectionSyncFrame !== null) {
      cancelAnimationFrame(selectionSyncFrame);
    }
    selectionSyncFrame = requestAnimationFrame(() => {
      selectionSyncFrame = null;
      syncOperationalTruth(selectedOverride, token);
    });
  }

  function selectEvent(event: EarthquakeEvent): void {
    lockedSelectedEventId = event.id;
    consoleStore.batch(() => {
      consoleStore.set('selectedEvent', event);
      consoleStore.set('mode', 'event');
      consoleStore.set('intensityGrid', null);
      consoleStore.set('exposures', []);
      consoleStore.set('priorities', []);
      consoleStore.set('readModel', buildPendingSelectionReadModel(event));
    });
    scheduleOperationalTruth(event);

    // Auto-zoom: fit the JMA felt area in the viewport.
    // Compute radius from GMPE, convert to bounds, use fitBounds for adaptive zoom.
    const threshKm = jmaThresholdDistanceKm(event.magnitude, event.depth_km, event.faultType, 1.5);
    const radiusDeg = Math.max(0.5, threshKm / 111);
    const cosLat = Math.cos((event.lat * Math.PI) / 180);
    const lngSpan = radiusDeg / Math.max(0.1, cosLat);
    map.fitBounds(
      [
        [event.lng - lngSpan, event.lat - radiusDeg],
        [event.lng + lngSpan, event.lat + radiusDeg],
      ],
      { padding: { top: 60, bottom: 60, left: 300, right: 300 }, duration: 1500, maxZoom: 10 },
    );
  }

  function deselectEvent(): void {
    lockedSelectedEventId = null;
    syncShakeMapForEvent(null);
    cancelPendingSelectionSync();
    consoleStore.batch(() => {
      consoleStore.set('selectedEvent', null);
      consoleStore.set('intensityGrid', null);
      consoleStore.set('exposures', []);
      consoleStore.set('priorities', []);
      consoleStore.set('readModel', createEmptyServiceReadModel(consoleStore.get('realtimeStatus')));
      consoleStore.set('mode', 'calm');
    });
  }

  // ── Public API ───────────────────────────────────────────

  return {
    selectEvent,
    deselectEvent,
    scheduleOperationalTruth,
    syncShakeMapForEvent,
    cancelPendingSelectionSync,

    updateRealtimeState(source: RealtimeSource, updatedAt: number, status: RealtimeStatus): void {
      lastFetchSource = source;
      lastUpdatedAt = updatedAt;
      lastRealtimeStatus = status;
    },

    getRealtimeState() {
      return { source: lastFetchSource, updatedAt: lastUpdatedAt, status: lastRealtimeStatus };
    },

    getLockedSelectedEventId(): string | null {
      return lockedSelectedEventId;
    },

    setLockedSelectedEventId(id: string | null): void {
      lockedSelectedEventId = id;
    },

    dispose(): void {
      cancelPendingSelectionSync();
      abortShakeMapFetch();
      shakeMapGridCache.clear();
    },
  };
}
