/**
 * Console Bootstrap — Wires map engine, viewport, layers, and panels.
 *
 * Boot sequence:
 *   1. Shell + loading progress
 *   2. Map engine (MapLibre + deck.gl)
 *   3. Viewport manager
 *   4. Layer compositor
 *   5. Panels (snapshot, feed, exposure, check-these-now)
 *   6. Picking (earthquake dots, fault lines, empty space)
 *   7. Keyboard (Tab=panels, Escape=deselect)
 *   8. Data fetch + ops compute + poll
 */

import 'maplibre-gl/dist/maplibre-gl.css';
import './console.css';

import { createMapEngine } from './mapEngine';
import { createViewportManager } from './viewportManager';
import { createShell } from './shell';
import { installSheetGesture } from './sheetGesture';
import { parseDeepLink } from './deepLink';
import {
  applyConsoleRealtimeError,
  refreshConsoleBundleTruth,
} from './consoleOps';
import { consoleStore } from './store';
import { buildSystemBarState } from './systemBar';
import { OPS_ASSETS, loadOpsAssets } from '../ops/assetCatalog';
import { loadPowerCatalog } from '../ops/powerCatalog';
import { loadImpactPlaybook } from '../ops/impactPlaybook';
import { createLayerCompositor } from '../layers/layerCompositor';
import { mountEventSnapshot } from '../panels/eventSnapshot';
import { mountRecentFeed } from '../panels/recentFeed';
import { mountAssetExposure } from '../panels/assetExposure';
import { mountFaultCatalog } from '../panels/faultCatalog';
import { mountImpactIntelligence } from '../panels/impactIntelligence';
import { mountLayerControl } from '../panels/layerControl';
import { earthquakeStore } from '../data/earthquakeStore';
import { fetchEventsWithMeta } from '../data/eventFeed';
import { createUnifiedPoller, resolveDynamicSectionData } from '../data/unifiedPoller';
import { createCommandPalette } from '../panels/commandPalette';
import { createKeyboardHelp } from '../panels/keyboardHelp';
import { createNotificationQueue } from '../panels/notificationQueue';

import { mountDataTicker } from '../panels/dataTicker';
import { mountMapLegend } from '../panels/mapLegend';
import { mountAssetCard } from '../panels/assetCard';
import { mountMapSearch } from '../panels/mapSearch';
import { mountTemporalSlider } from '../panels/temporalSlider';
import { startCatalogLoader } from '../data/catalogLoader';
import { loadMunicipalities } from '../data/municipalities';
import { buildScenarioCatalog, scenarioToEvent } from '../data/scenarioCatalog';
import { mountDepthCrossSection } from '../panels/depthCrossSection';
import { mountLocationSafetyCard } from '../panels/locationSafetyCard';
import { createSettingsPanel } from '../panels/settingsPanel';
import { loadPreferences, type ConsolePreferences } from './preferences';
import { buildClientRefreshPlan } from '../governor/clientGovernor';
import { buildDensityRuntimeViewModel } from './densityRuntime';
import type { ActiveFault, EarthquakeEvent, ScenarioDefinition } from '../types';
import { onLocaleChange, t, tf } from '../i18n';
import { invalidateLayerDefinitionCache } from '../layers/layerRegistry';
import { waitForMapLoad } from './startupRecovery';
import { createSelectionManager } from './selectionManager';
import { installKeyboardBindings } from './keyboardBindings';
import { createTooltipHandler, createClickHandler } from './pickingHandlers';

// ── Loading Progress ────────────────────────────────────────

function setLoadingProgress(pct: number, label: string): void {
  const bar = document.getElementById('loading-bar');
  const status = document.getElementById('loading-status');
  if (bar) bar.style.width = `${pct}%`;
  if (status) status.textContent = label;
}

function dismissLoading(): void {
  const el = document.getElementById('loading-screen');
  if (el) {
    el.classList.add('exit');
    setTimeout(() => el.remove(), 700);
  }
}

// ── Scenario helpers ────────────────────────────────────────

function getScenarioFault(scenario: ScenarioDefinition): ActiveFault | null {
  return consoleStore.get('faults').find((fault) => fault.id === scenario.faultId) ?? null;
}

function toScenarioEvent(scenario: ScenarioDefinition): EarthquakeEvent | null {
  const fault = getScenarioFault(scenario);
  return fault ? scenarioToEvent(scenario, fault) : null;
}

// ── Static Data Loaders ─────────────────────────────────────

async function loadFaultData(): Promise<void> {
  try {
    const res = await fetch('/data/active-faults.json');
    if (!res.ok) return;
    const rawFaults: ActiveFault[] = await res.json();
    const catalog = buildScenarioCatalog(rawFaults);
    consoleStore.batch(() => {
      consoleStore.set('faults', catalog.faults);
      consoleStore.set('scenarios', catalog.scenarios);
    });
  } catch {
    // Non-critical
  }
}

// ── Main Bootstrap ──────────────────────────────────────────

export async function bootstrapConsole(root: HTMLElement): Promise<void> {
  setLoadingProgress(10, t('boot.buildingConsole'));
  let refreshPlan = buildClientRefreshPlan(null);

  // 0. Parse deep link BEFORE MapLibre init (hash:true overwrites the URL hash)
  const deepLink = parseDeepLink();

  // 0b. Restore cached events for instant display on subsequent visits
  // Stale-while-revalidate: show cached data immediately, replace with fresh on next poll.
  const EVENTS_CACHE_KEY = 'nz-events-v1';
  try {
    const raw = localStorage.getItem(EVENTS_CACHE_KEY);
    if (raw) {
      const { events, ts } = JSON.parse(raw);
      if (Date.now() - ts < 600_000 && Array.isArray(events) && events.length > 0) {
        consoleStore.set('events', events);
      }
    }
  } catch { /* ignore corrupt cache */ }

  // 1. Shell
  const shell = createShell(root);

  function syncDensityRuntime(): void {
    const model = buildDensityRuntimeViewModel({
      activeBundleId: consoleStore.get('activeBundleId'),
      bundleSettings: consoleStore.get('bundleSettings'),
    });
    shell.root.setAttribute('data-active-bundle', model.activeBundleId);
    shell.root.setAttribute('data-density', model.density);
  }
  syncDensityRuntime();

  // 2. Map engine
  setLoadingProgress(20, t('boot.initMap'));
  const engine = createMapEngine(shell.mapContainer);
  const mapReadyPromise = waitForMapLoad(engine.map);

  // 3. Viewport
  const viewport = createViewportManager(engine.map);
  viewport.subscribe((state) => {
    consoleStore.set('viewport', state);
    // NOTE: Do NOT call syncOperationalTruth() here.
    // The intensity grid, exposures, and priorities depend on selectedEvent,
    // not on viewport. Recomputing GMPE on every pan/zoom was a perf bug.
    // Layer compositor handles viewport-dependent layers via dirty flags.
    updateSystemBar(consoleStore.get('mode'), consoleStore.get('events').length);
  });

  // 4. Compositor
  const compositor = createLayerCompositor(engine);

  // 4b. Selection manager — encapsulates event selection state machine
  const selection = createSelectionManager({ map: engine.map });

  // 5. Panels — each gets its own wrapper so innerHTML won't clobber siblings
  setLoadingProgress(30, t('boot.mountingPanels'));
  const snapContainer = document.createElement('div');
  shell.leftRail.appendChild(snapContainer);
  const disposeSnapshot = mountEventSnapshot(snapContainer, () => selection.deselectEvent());

  const feedContainer = document.createElement('div');
  shell.leftRail.appendChild(feedContainer);
  const disposeFeed = mountRecentFeed(feedContainer, (event) => {
    selectEvent(event);
  });

  // Fault catalog — in left rail, toggled with recent feed by scenario mode
  const faultContainer = document.createElement('div');
  shell.leftRail.insertBefore(faultContainer, feedContainer.nextSibling);
  const disposeFaultCatalog = mountFaultCatalog(faultContainer, (scenario) => {
    const event = toScenarioEvent(scenario);
    if (event) {
      selection.selectEvent(event);
    }
  });

  // Toggle feed vs fault catalog visibility based on scenario mode
  function syncScenarioPanels(scenarioOn: boolean): void {
    feedContainer.style.display = scenarioOn ? 'none' : '';
    faultContainer.style.display = scenarioOn ? '' : 'none';
  }
  syncScenarioPanels(consoleStore.get('scenarioMode'));
  consoleStore.subscribe('scenarioMode', syncScenarioPanels);

  const expoContainer = document.createElement('div');
  shell.leftRail.appendChild(expoContainer);
  const disposeExpo = mountAssetExposure(expoContainer);

  const intelContainer = document.createElement('div');
  shell.rightRail.appendChild(intelContainer);
  const disposeIntel = mountImpactIntelligence(intelContainer);

  const disposeLayerControl = mountLayerControl(shell.bottomBar, shell.bottomDrawerHost);
  const disposeTicker = mountDataTicker(shell.tickerEl);

  // Depth cross-section panel — seismological longitude vs depth profile
  const disposeDepthProfile = mountDepthCrossSection(shell.depthHost, (event) => selection.selectEvent(event));

  // Sync depth profile visibility with map container
  let depthOpen = false;
  const onDepthVisibility = ((e: CustomEvent) => {
    depthOpen = e.detail.visible;
    shell.root.toggleAttribute('data-depth-open', depthOpen);
    if (depthOpen) {
      shell.root.style.setProperty('--nz-depth-height', '260px');
    } else {
      // Reset auto-pitch so tilt can re-trigger the depth panel
      autoPitchOpen = false;
    }
    // Trigger MapLibre resize so it renders correctly in the new space
    setTimeout(() => engine.map.resize(), 350);
  }) as EventListener;
  const onDepthResize = ((e: CustomEvent) => {
    const h = e.detail.height;
    const profile = shell.depthHost.querySelector('.nz-depth-profile') as HTMLElement;
    if (profile) {
      // Update CSS custom property for map bottom offset
      shell.root.style.setProperty('--nz-depth-height', `${h}px`);
    }
    engine.map.resize();
  }) as EventListener;
  window.addEventListener('nz-depth-visibility', onDepthVisibility);
  window.addEventListener('nz-depth-resize', onDepthResize);

  // Auto-open depth panel when pitch exceeds threshold (geological cross-section mode)
  let autoPitchOpen = false;
  const AUTO_PITCH_THRESHOLD = 45;
  const AUTO_PITCH_CLOSE = 25;
  const unsubAutoPitch = consoleStore.subscribe('viewport', (vp) => {
    const pitch = vp.pitch ?? 0;
    if (!autoPitchOpen && !depthOpen && pitch >= AUTO_PITCH_THRESHOLD) {
      autoPitchOpen = true;
      window.dispatchEvent(new CustomEvent('nz-depth-toggle'));
    } else if (autoPitchOpen && depthOpen && pitch < AUTO_PITCH_CLOSE) {
      autoPitchOpen = false;
      window.dispatchEvent(new CustomEvent('nz-depth-toggle'));
    }
  });

  // Temporal slider — historical earthquake catalog browser
  const temporalHost = document.createElement('div');
  temporalHost.className = 'nz-temporal-host';
  shell.root.appendChild(temporalHost);
  const temporalSlider = mountTemporalSlider(temporalHost);
  const disposeCatalogLoader = startCatalogLoader();

  // Map legend (asset categories + JMA intensity) — bottom-left
  // Replaces the old standalone intensity legend
  const mapLegendContainer = document.createElement('div');
  shell.root.appendChild(mapLegendContainer);
  const disposeMapLegend = mountMapLegend(mapLegendContainer);

  // Asset detail card — floating card on asset click
  const assetCardContainer = document.createElement('div');
  shell.root.appendChild(assetCardContainer);
  const disposeAssetCard = mountAssetCard(assetCardContainer);

  const searchInputContainer = document.createElement('div');
  const searchCardContainer = document.createElement('div');
  shell.searchHost.appendChild(searchInputContainer);
  shell.searchHost.appendChild(searchCardContainer);

  function getSearchPlaceZoom(population: number): number {
    if (population >= 2_000_000) return 9.5;
    if (population >= 500_000) return 10.3;
    return 11.1;
  }

  const disposeMapSearch = mountMapSearch(searchInputContainer, {
    onSelectPlace(place) {
      consoleStore.set('searchedPlace', place);
      engine.map.flyTo({
        center: [place.lng, place.lat],
        zoom: getSearchPlaceZoom(place.population),
        duration: 1200,
        essential: true,
      });
    },
  });

  const disposeLocationSafetyCard = mountLocationSafetyCard(searchCardContainer);

  // Preferences (loaded early so notification queue + timeline can use them)
  let prefs = loadPreferences();
  consoleStore.set('showCoordinates', prefs.display.showCoordinates);

  // 5b. Command Palette (Cmd+K)
  const palette = createCommandPalette(
    (lat, lng, zoom) => {
      engine.map.flyTo({ center: [lng, lat], zoom, duration: 1500 });
    },
    (event) => selection.selectEvent(event),
  );

  // 5c. Notification Queue
  const notifications = createNotificationQueue(
    (event) => selection.selectEvent(event),
    { enabled: prefs.notifications.enabled, minMagnitude: prefs.notifications.minMagnitude, soundEnabled: prefs.notifications.soundEnabled },
  );

  // 6. Picking — tooltip + click handlers (extracted to pickingHandlers.ts)
  engine.setTooltip(createTooltipHandler());
  engine.onClick(createClickHandler({
    selectEvent: (e) => selection.selectEvent(e),
    deselectEvent: () => selection.deselectEvent(),
    toScenarioEvent,
  }));

  // Selection helpers — delegate to selectionManager
  const { selectEvent, deselectEvent } = selection;

  // 7. Keyboard shortcuts
  const kbHelp = createKeyboardHelp();

  // 7a. Settings panel
  const settings = createSettingsPanel((newPrefs: ConsolePreferences) => {
    prefs = newPrefs;
    notifications.configure({ enabled: newPrefs.notifications.enabled, minMagnitude: newPrefs.notifications.minMagnitude, soundEnabled: newPrefs.notifications.soundEnabled });
    consoleStore.set('showCoordinates', newPrefs.display.showCoordinates);
  });
  shell.settingsBtn.addEventListener('click', () => settings.toggle());

  // Home button — reset to default Japan overview
  shell.homeBtn.addEventListener('click', () => {
    deselectEvent();
    engine.resetView();
  });

  // Mobile bottom sheet — 3-snap gesture (peek / half / full)
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  let sheetGesture: ReturnType<typeof installSheetGesture> | null = null;
  if (isMobile) {
    sheetGesture = installSheetGesture({
      sheetEl: shell.leftRail,
      handleSelector: '.nz-rail__handle',
      onSnap(snap) {
        shell.leftRail.setAttribute('data-snap', snap);
      },
    });
  }

  // Mobile rail toggle — tap handle to expand/collapse (desktop fallback)
  const railHandle = shell.leftRail.querySelector('#nz-rail-handle');
  if (railHandle && !isMobile) {
    railHandle.addEventListener('click', () => {
      shell.leftRail.classList.toggle('nz-rail--expanded');
    });
  }

  // Collapse rail / sheet when tapping on the map
  shell.mapContainer.addEventListener('click', () => {
    if (sheetGesture) {
      sheetGesture.snapTo('peek');
    } else {
      shell.leftRail.classList.remove('nz-rail--expanded');
    }
  });

  // Layers FAB — open bundle drawer
  shell.layersFab.addEventListener('click', () => {
    consoleStore.set('bundleDrawerOpen', !consoleStore.get('bundleDrawerOpen'));
  });

  const disposeKeyboard = installKeyboardBindings({
    selectEvent: (e) => selection.selectEvent(e),
    deselectEvent: () => selection.deselectEvent(),
    palette,
    settings,
    kbHelp,
    engine: { map: engine.map, setPitch: engine.setPitch, resetView: engine.resetView },
    shell,
    getPrefs: () => prefs,
  });

  // 8. Scenario UI class — single source of truth
  //    Only apply nz-console--scenario when scenarioMode is explicitly ON.
  //    The scenarioMode store value is the sole authority; selectedEvent does NOT control it.
  function syncScenarioClass(): void {
    shell.root.classList.toggle('nz-console--scenario', consoleStore.get('scenarioMode'));
  }

  consoleStore.subscribe('scenarioMode', (on) => {
    syncScenarioClass();
    if (!on) {
      // Purge scenario events from the persistent earthquake store.
      // Without this, a stale scenario event (e.g. M8.5 Nankai) could be
      // auto-selected by selectOperationalFocusEvent on the next poll cycle.
      earthquakeStore.removeByPrefix('scenario-');
      const selected = consoleStore.get('selectedEvent');
      if (selected?.id.startsWith('scenario-')) {
        deselectEvent();
      }
    }
  });
  consoleStore.subscribe('activeBundleId', syncDensityRuntime);
  consoleStore.subscribe('bundleSettings', syncDensityRuntime);

  // 9. System bar — coalesced updates (mode, events, readModel, realtimeStatus all affect it)
  let sysBarScheduled = false;
  const scheduleSysBar = (): void => {
    if (sysBarScheduled) return;
    sysBarScheduled = true;
    requestAnimationFrame(() => {
      sysBarScheduled = false;
      updateSystemBar(consoleStore.get('mode'), consoleStore.get('events').length);
    });
  };
  consoleStore.subscribe('mode', scheduleSysBar);
  consoleStore.subscribe('events', scheduleSysBar);
  consoleStore.subscribe('readModel', scheduleSysBar);
  consoleStore.subscribe('realtimeStatus', scheduleSysBar);
  consoleStore.subscribe('performanceStatus', scheduleSysBar);

  function updateSystemBar(mode: string, eventCount: number): void {
    const state = buildSystemBarState({
      mode: mode === 'event' ? 'event' : 'calm',
      eventCount,
      readModel: consoleStore.get('readModel'),
      realtimeStatus: consoleStore.get('realtimeStatus'),
      performanceStatus: consoleStore.get('performanceStatus'),
    });

    shell.regionEl.textContent = state.regionLabel;
    shell.statusEl.textContent = state.statusText;
    shell.statusEl.setAttribute('data-mode', state.statusMode);
    shell.statusEl.setAttribute('data-tone', state.statusTone);
    shell.heartbeatEl.setAttribute('data-mode', state.statusMode);
  }

  // 9b. Locale change — update static shell text and invalidate i18n caches
  function updateShellLocale(): void {
    invalidateLayerDefinitionCache();
    shell.scenarioBannerText.textContent = t('shell.scenarioBannerText');
    shell.scenarioBannerSub.textContent = t('shell.scenarioBannerSub');
    shell.scenarioBadge.textContent = t('shell.scenarioBadge');
    shell.settingsBtn.title = t('settings.tooltip');
    shell.homeBtn.title = t('home.tooltip');
    scheduleSysBar();
  }
  updateShellLocale();
  const unsubLocale = onLocaleChange(updateShellLocale);

  // 10. Data freshness indicators
  function renderFreshness(el: HTMLElement): void {
    const f = consoleStore.get('dataFreshness');
    const now = Date.now();

    function ageLabel(ts: number): string {
      if (ts === 0) return '--';
      const sec = Math.floor((now - ts) / 1000);
      if (sec < 60) return `${sec}s`;
      return `${Math.floor(sec / 60)}m`;
    }

    function staleClass(ts: number): string {
      if (ts === 0) return 'nz-freshness__dot--offline';
      const age = now - ts;
      if (age > 120_000) return 'nz-freshness__dot--stale';
      return '';
    }

    const sources = [
      { key: 'usgs', label: 'USGS', ts: f.usgs },
      { key: 'ais', label: 'AIS', ts: f.ais },
      { key: 'odpt', label: 'ODPT', ts: f.odpt },
    ];

    el.innerHTML = `<div class="nz-freshness">${sources.map(s => `
      <span class="nz-freshness__src">
        <span class="nz-freshness__dot ${staleClass(s.ts)}"></span>
        <span class="nz-freshness__label">${s.label}</span>
        <span class="nz-freshness__age">${ageLabel(s.ts)}</span>
      </span>
    `).join('')}</div>`;
  }

  const unsubFreshness = consoleStore.subscribe('dataFreshness', () => renderFreshness(shell.freshnessEl));
  const freshnessTimer = setInterval(() => renderFreshness(shell.freshnessEl), 5_000);
  renderFreshness(shell.freshnessEl);

  // 11. Load fault data + infrastructure assets in parallel
  setLoadingProgress(40, t('boot.loadingFaults'));
  const [, assetCount] = await Promise.all([
    loadFaultData(),
    loadOpsAssets(),
    loadPowerCatalog(),
    loadMunicipalities(),
    loadImpactPlaybook(),
  ]);
  setLoadingProgress(45, tf('boot.eventsLoaded', { n: assetCount }));

  // 12. Unified Poller — single poll loop for all dynamic data (events + vessels + rail)
  // 1 fetch per cycle → snapshot.json from R2 CDN → distribute to all stores.
  // Adding a new layer = adding a key to snapshot + 1 store dispatch. Zero extra HTTP requests.

  function handlePollResult(result: import('../data/unifiedPoller').UnifiedPollResult): void {
    selection.updateRealtimeState(result.realtimeStatus.source, result.realtimeStatus.updatedAt, result.realtimeStatus);
    refreshPlan = buildClientRefreshPlan(result.governor);
    unifiedPoller.setRefreshMs(refreshPlan.events.refreshMs);

    // Merge new events with existing (preserves historical data from custom range searches).
    // Without merge, each poll replaces all events with only the last 7 days,
    // wiping any historical events the user loaded via the period picker.
    const existing = new Map(consoleStore.get('events').map((e) => [e.id, e]));
    for (const e of result.events) existing.set(e.id, e);
    const merged = [...existing.values()].sort((a, b) => b.time - a.time);

    const now = Date.now();
    const prevFreshness = consoleStore.get('dataFreshness');
    const dynamicSections = resolveDynamicSectionData({
      previousVessels: consoleStore.get('vessels'),
      previousRailStatuses: consoleStore.get('railStatuses'),
      previousDomainOverrides: consoleStore.get('domainOverrides'),
      result,
    });
    consoleStore.batch(() => {
      consoleStore.set('events', merged);
      consoleStore.set('vessels', dynamicSections.vessels);
      consoleStore.set('railStatuses', dynamicSections.railStatuses);
      consoleStore.set('domainOverrides', dynamicSections.domainOverrides);
      consoleStore.set('realtimeStatus', result.realtimeStatus);
      consoleStore.set('readModel', refreshConsoleBundleTruth({
        readModel: consoleStore.get('readModel'),
        realtimeStatus: result.realtimeStatus,
        selectedEvent: consoleStore.get('selectedEvent'),
        exposures: consoleStore.get('exposures'),
        vessels: dynamicSections.vessels,
        assets: OPS_ASSETS,
        domainOverrides: dynamicSections.domainOverrides,
        railStatuses: dynamicSections.railStatuses,
      }));
      consoleStore.set('dataFreshness', {
        usgs: result.projectionFreshness.events || prevFreshness.usgs || now,
        ais: result.projectionFreshness.maritime || prevFreshness.ais,
        odpt: result.projectionFreshness.rail || prevFreshness.odpt,
      });
    });

    // Cache events in localStorage for instant display on next visit
    try {
      localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify({
        events: result.events.slice(0, 60),
        ts: Date.now(),
      }));
    } catch { /* quota exceeded */ }

    // In scenario mode with a scenario event selected, preserve the selection.
    // Without this, the ops focus algorithm would auto-select a real earthquake
    // and override the user's scenario choice on every poll cycle.
    const selected = consoleStore.get('selectedEvent');
    const lockedId = selection.getLockedSelectedEventId();
    if (lockedId) {
      const lockedEvent = selected?.id === lockedId
        ? selected
        : merged.find((event) => event.id === lockedId) ?? null;
      if (lockedEvent) {
        selection.scheduleOperationalTruth(lockedEvent);
      } else {
        selection.setLockedSelectedEventId(null);
        selection.scheduleOperationalTruth();
      }
    } else {
      selection.scheduleOperationalTruth();
    }
  }

  function syncRealtimeError(error: unknown): void {
    const rt = selection.getRealtimeState();
    const degraded = applyConsoleRealtimeError({
      now: Date.now(),
      source: rt.source,
      updatedAt: rt.updatedAt || Date.now(),
      message: error instanceof Error ? error.message : 'Realtime poll failed',
      readModel: consoleStore.get('readModel'),
    });
    selection.updateRealtimeState(rt.source, rt.updatedAt, degraded.realtimeStatus);
    consoleStore.batch(() => {
      consoleStore.set('realtimeStatus', degraded.realtimeStatus);
      consoleStore.set('readModel', degraded.readModel);
    });
  }

  const unifiedPoller = createUnifiedPoller({
    onUpdate: handlePollResult,
    onError: (err) => {
      syncRealtimeError(err);
    },
    initialRefreshMs: refreshPlan.events.refreshMs,
    fallbackFetchEvents: async () => {
      const result = await fetchEventsWithMeta();
      return {
        events: result.events,
        governor: result.governor,
        source: result.source,
        updatedAt: result.updatedAt,
      };
    },
  });

  // 12a. Pre-fetch earthquake data while map tiles are still loading.
  // This runs in parallel with MapLibre's tile download (3-5s), so events
  // are ready the instant the map fires 'load'.
  setLoadingProgress(50, t('boot.fetchingEvents'));
  const prefetchPromise = unifiedPoller.poll().catch((err) => {
    syncRealtimeError(err);
  });

  // 13. Start once the map is ready.
  await mapReadyPromise;
  setLoadingProgress(75, t('boot.mapReady'));
  compositor.start();

  // Await the prefetch that was already running in parallel
  await prefetchPromise;
  setLoadingProgress(90, tf('boot.eventsLoaded', { n: consoleStore.get('events').length }));

  // Deep link: select event from URL (/event/{id})
  if (deepLink.eventId) {
    const match = consoleStore.get('events').find((e) => e.id === deepLink.eventId);
    if (match) selectEvent(match);
  } else if (deepLink.camera) {
    engine.map.flyTo({
      center: [deepLink.camera.lng, deepLink.camera.lat],
      zoom: deepLink.camera.zoom,
      duration: 1500,
    });
  } else {
    // First visit: show Japan overview at responsive zoom.
    // No auto-select — let users explore the map first.
  }

  setLoadingProgress(100, t('boot.ready'));
  updateSystemBar(consoleStore.get('mode'), consoleStore.get('events').length);
  dismissLoading();
  unifiedPoller.start();

  // 14. HMR cleanup
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      selection.dispose();
      unifiedPoller.stop();
      clearInterval(freshnessTimer);
      unsubFreshness();
      unsubLocale();
      disposeKeyboard();
      compositor.stop();
      disposeSnapshot();
      disposeFeed();
      disposeExpo();
      disposeIntel();
      disposeLayerControl();
      disposeTicker();
      disposeDepthProfile();
      disposeMapLegend();
      disposeAssetCard();
      disposeMapSearch();
      disposeLocationSafetyCard();
      temporalSlider.dispose();
      disposeCatalogLoader();
      disposeFaultCatalog();
      palette.dispose();
      kbHelp.dispose();
      notifications.dispose();
      settings.dispose();
      sheetGesture?.dispose();
      window.removeEventListener('nz-depth-visibility', onDepthVisibility);
      window.removeEventListener('nz-depth-resize', onDepthResize);
      unsubAutoPitch();
      viewport.dispose();
      engine.dispose();
    });
  }
}
