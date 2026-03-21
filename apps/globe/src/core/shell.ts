/**
 * Console Shell — Fullscreen map + floating panels layout.
 *
 * Creates the DOM structure for the spatial console:
 * - Fullscreen map container (z0)
 * - System bar (top)
 * - Left rail (event snapshot, asset exposure)
 * - Right rail (check these now, analyst note)
 * - Bottom bar (replay rail, layer control)
 * - All panels float over the map with backdrop-filter blur
 */

const SHELL_HTML = `
<div class="nz-console" role="application" aria-label="Namazue Earthquake Intelligence Console">
  <main class="nz-map" id="nz-map" aria-label="Seismic activity map"></main>

  <nav class="nz-system-bar" id="nz-system-bar" aria-label="System status bar">
    <span class="nz-system-bar__brand">namazue.dev</span>
    <span class="nz-system-bar__sep"></span>
    <span class="nz-system-bar__region" id="nz-region"></span>
    <span class="nz-system-bar__sep"></span>
    <span class="nz-system-bar__heartbeat" id="nz-heartbeat"></span>
    <span class="nz-system-bar__status" id="nz-status"></span>
    <span class="nz-scenario-sysbar-badge" id="nz-scenario-badge"></span>
    <span class="nz-system-bar__freshness" id="nz-freshness"></span>
    <button class="nz-system-bar__settings" id="nz-settings-btn" title="">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </button>
  </div>

  <div class="nz-scenario-overlay" id="nz-scenario-overlay"></div>

  <div class="nz-scenario-banner" id="nz-scenario-banner">
    <span class="nz-scenario-banner__icon">⚠</span>
    <span class="nz-scenario-banner__text"></span>
    <span class="nz-scenario-banner__sub"></span>
  </div>

  <div class="nz-search-stack" id="nz-search-host"></div>
  <div class="nz-rail nz-rail--left" id="nz-rail-left">
    <div class="nz-rail__handle" id="nz-rail-handle" role="button" aria-label="Toggle panel"></div>
  </div>
  <div class="nz-rail nz-rail--right" id="nz-rail-right"></div>
  <div class="nz-depth-host" id="nz-depth-host"></div>
  <div class="nz-bottom-drawer-host" id="nz-bottom-drawer-host"></div>
  <footer class="nz-bottom-bar" id="nz-bottom-bar" aria-label="Event ticker">
    <div class="nz-ticker" id="nz-ticker"></div>
  </footer>
  <button class="nz-home-btn" id="nz-home-btn" title="">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  </button>
  <button class="nz-fab nz-fab--layers" id="nz-fab-layers" aria-label="Layers">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
  </button>
</div>
`;

export interface ShellElements {
  root: HTMLElement;
  mapContainer: HTMLElement;
  systemBar: HTMLElement;
  regionEl: HTMLElement;
  statusEl: HTMLElement;
  heartbeatEl: HTMLElement;
  freshnessEl: HTMLElement;
  settingsBtn: HTMLElement;
  scenarioOverlay: HTMLElement;
  scenarioBanner: HTMLElement;
  scenarioBannerText: HTMLElement;
  scenarioBannerSub: HTMLElement;
  scenarioBadge: HTMLElement;
  searchHost: HTMLElement;
  leftRail: HTMLElement;
  rightRail: HTMLElement;
  depthHost: HTMLElement;
  bottomDrawerHost: HTMLElement;
  bottomBar: HTMLElement;
  tickerEl: HTMLElement;
  homeBtn: HTMLElement;
  layersFab: HTMLElement;
}

export function createShell(parent: HTMLElement): ShellElements {
  parent.innerHTML = SHELL_HTML;

  return {
    root: parent.querySelector('.nz-console')!,
    mapContainer: parent.querySelector('#nz-map')!,
    systemBar: parent.querySelector('#nz-system-bar')!,
    regionEl: parent.querySelector('#nz-region')!,
    statusEl: parent.querySelector('#nz-status')!,
    heartbeatEl: parent.querySelector('#nz-heartbeat')!,
    freshnessEl: parent.querySelector('#nz-freshness')!,
    settingsBtn: parent.querySelector('#nz-settings-btn')!,
    scenarioOverlay: parent.querySelector('#nz-scenario-overlay')!,
    scenarioBanner: parent.querySelector('#nz-scenario-banner')!,
    scenarioBannerText: parent.querySelector('.nz-scenario-banner__text')!,
    scenarioBannerSub: parent.querySelector('.nz-scenario-banner__sub')!,
    scenarioBadge: parent.querySelector('#nz-scenario-badge')!,
    searchHost: parent.querySelector('#nz-search-host')!,
    leftRail: parent.querySelector('#nz-rail-left')!,
    rightRail: parent.querySelector('#nz-rail-right')!,
    depthHost: parent.querySelector('#nz-depth-host')!,
    bottomDrawerHost: parent.querySelector('#nz-bottom-drawer-host')!,
    bottomBar: parent.querySelector('#nz-bottom-bar')!,
    tickerEl: parent.querySelector('#nz-ticker')!,
    homeBtn: parent.querySelector('#nz-home-btn')!,
    layersFab: parent.querySelector('#nz-fab-layers')!,
  };
}
