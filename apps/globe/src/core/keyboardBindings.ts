/**
 * Keyboard Bindings — Extracted from bootstrap.ts.
 *
 * Installs a single keydown listener that handles all console shortcuts.
 * Returns a dispose function to remove the listener.
 */

import type { EarthquakeEvent } from '../types';
import { consoleStore, toggleScenarioMode } from './store';

// ── Types ────────────────────────────────────────────────────

export interface KeyboardBindingsConfig {
  selectEvent: (event: EarthquakeEvent) => void;
  deselectEvent: () => void;
  palette: { isOpen: () => boolean };
  settings: { isOpen: () => boolean; close: () => void; toggle: () => void };
  kbHelp: { isOpen: () => boolean; close: () => void; toggle: () => void };
  engine: { map: { getPitch: () => number }; setPitch: (p: number) => void; resetView: () => void };
  shell: { root: HTMLElement };
  getPrefs: () => { keyboard: { enabled: boolean } };
}

// ── Bundle key map ───────────────────────────────────────────

const BUNDLE_KEYS: Record<string, 'seismic' | 'maritime' | 'lifelines' | 'medical' | 'built-environment'> = {
  '1': 'seismic',
  '2': 'maritime',
  '3': 'lifelines',
  '4': 'medical',
  '5': 'built-environment',
};

// ── Public API ───────────────────────────────────────────────

export function installKeyboardBindings(config: KeyboardBindingsConfig): () => void {
  const { selectEvent, deselectEvent, palette, settings, kbHelp, engine, shell, getPrefs } = config;

  // Cache sorted events to avoid O(n log n) on every arrow key press (57K+ events)
  let sortedEventsCache: EarthquakeEvent[] = [];
  let sortedEventsCacheKey = '';

  function getSortedEvents(): EarthquakeEvent[] {
    const events = consoleStore.get('events');
    const key = `${events.length}-${events[0]?.id ?? ''}`;
    if (key !== sortedEventsCacheKey) {
      sortedEventsCache = [...events].sort((a, b) => b.time - a.time);
      sortedEventsCacheKey = key;
    }
    return sortedEventsCache;
  }

  function selectNextEvent(): void {
    const sorted = getSortedEvents();
    if (sorted.length === 0) return;
    const selectedId = consoleStore.get('selectedEvent')?.id ?? null;
    if (!selectedId) {
      selectEvent(sorted[0]);
      return;
    }
    const idx = sorted.findIndex((e) => e.id === selectedId);
    if (idx < sorted.length - 1) selectEvent(sorted[idx + 1]);
  }

  function selectPrevEvent(): void {
    const sorted = getSortedEvents();
    if (sorted.length === 0) return;
    const selectedId = consoleStore.get('selectedEvent')?.id ?? null;
    if (!selectedId) {
      selectEvent(sorted[0]);
      return;
    }
    const idx = sorted.findIndex((e) => e.id === selectedId);
    if (idx > 0) selectEvent(sorted[idx - 1]);
  }

  function handleKeydown(e: KeyboardEvent): void {
    // Don't capture when typing in an input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Check if keyboard shortcuts are disabled
    if (!getPrefs().keyboard.enabled && e.key !== 'Escape') return;

    if (e.key === 'Escape') {
      if (palette.isOpen()) return; // palette handles its own Escape
      if (settings.isOpen()) { settings.close(); return; }
      if (kbHelp.isOpen()) { kbHelp.close(); return; }
      if (!consoleStore.get('selectedEvent') && consoleStore.get('searchedPlace')) {
        consoleStore.set('searchedPlace', null);
        return;
      }
      deselectEvent();
      return;
    }

    // Skip modified keys for shortcuts below (Cmd+K handled by palette)
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === '?') {
      e.preventDefault();
      kbHelp.toggle();
      return;
    }

    if (e.key === ',') {
      e.preventDefault();
      settings.toggle();
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      const visible = !consoleStore.get('panelsVisible');
      consoleStore.set('panelsVisible', visible);
      shell.root.toggleAttribute('data-panels-hidden', !visible);
      return;
    }

    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      toggleScenarioMode();
      return;
    }

    if (e.key === 'b' || e.key === 'B') {
      e.preventDefault();
      consoleStore.set('bundleDrawerOpen', !consoleStore.get('bundleDrawerOpen'));
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      deselectEvent();
      engine.resetView();
      return;
    }

    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      const vis = consoleStore.get('layerVisibility');
      consoleStore.set('layerVisibility', { ...vis, faults: !vis.faults });
      return;
    }

    if (e.key === 'j' || e.key === 'J') {
      e.preventDefault();
      selectNextEvent();
      return;
    }

    if (e.key === 'k' || e.key === 'K') {
      e.preventDefault();
      selectPrevEvent();
      return;
    }

    if (e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('nz-depth-toggle'));
      return;
    }

    if (e.key === '0') {
      e.preventDefault();
      // Toggle 3D tilt: cycle between flat (0°) → terrain (40°) → dramatic (65°) → flat
      const currentPitch = engine.map.getPitch();
      const nextPitch = currentPitch < 20 ? 40 : currentPitch < 55 ? 65 : 0;
      engine.setPitch(nextPitch);
      return;
    }

    // 1-5: bundle quick switch
    const bundleId = BUNDLE_KEYS[e.key];
    if (bundleId) {
      e.preventDefault();
      consoleStore.set('activeBundleId', bundleId);
      const bundleSettings = consoleStore.get('bundleSettings');
      consoleStore.set('bundleSettings', {
        ...bundleSettings,
        [bundleId]: { ...bundleSettings[bundleId], enabled: true },
      });
      return;
    }
  }

  document.addEventListener('keydown', handleKeydown);

  return () => {
    document.removeEventListener('keydown', handleKeydown);
  };
}
