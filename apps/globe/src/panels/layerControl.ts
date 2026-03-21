import {
  applyOperatorViewPreset,
  getAllBundleDefinitions,
  getAllOperatorViewPresets,
  getBundleDefinition,
  getOperatorViewPreset,
  isLayerEffectivelyVisible,
  type BundleDensity,
} from '../layers/bundleRegistry';
import { t } from '../i18n';
import { getLayerDefinition, type BundleId, type LayerId, type LegendEntry } from '../layers/layerRegistry';
import type { LayerGateCode, LayerGateLayerId, LayerGateStatus } from '../layers/layerGateStatus';
import { consoleStore, toggleScenarioMode, type ConsoleState } from '../core/store';
import type {
  OperatorBundleCounter,
  OperatorBundleDomain,
  OperatorBundleSignal,
  OperatorBundleSummary,
} from '../ops/readModelTypes';
import { createEmptyServiceReadModel } from '../ops/serviceReadModel';
import { buildCommandDeckModel } from '../presentation/commandDeck';

export type BundleSummary = Pick<
  OperatorBundleSummary,
  'title' | 'metric' | 'detail' | 'availability' | 'trust' | 'counters' | 'signals' | 'domains'
>;

export interface LayerControlRow {
  id: LayerGateLayerId;
  label: string;
  availability: 'live' | 'planned';
  visible: boolean;
  effectiveVisible: boolean;
  gateDetail?: string;
  gateTone?: 'nominal' | 'watch' | 'degraded';
}

export interface LayerControlModel {
  activeBundle: {
    id: BundleId;
    label: string;
    description: string;
  };
  activeView: {
    id: string;
    label: string;
  };
  bundleSummaries: Array<{
    id: BundleId;
    enabled: boolean;
    summary: BundleSummary;
  }>;
  operatorViews: ReturnType<typeof getAllOperatorViewPresets>;
  layerRows: LayerControlRow[];
}

const LAYER_GATE_PRESENTATION: Record<LayerGateCode, {
  detailKey: string;
  tone: NonNullable<LayerControlRow['gateTone']>;
}> = {
  'requires-m5': { detailKey: 'layer.gate.requiresM5', tone: 'degraded' },
  'requires-city-zoom': { detailKey: 'layer.gate.requiresCityZoom', tone: 'watch' },
  'requires-intensity-grid': { detailKey: 'layer.gate.requiresIntensityGrid', tone: 'watch' },
  'unsupported-city': { detailKey: 'layer.gate.unsupportedCity', tone: 'degraded' },
  'waiting-sequence': { detailKey: 'layer.gate.waitingSequence', tone: 'watch' },
  'waiting-handoff': { detailKey: 'layer.gate.waitingHandoff', tone: 'watch' },
};

export function buildBundleSummary(bundleId: BundleId, state: ConsoleState): BundleSummary {
  const readModel = state.readModel;
  const backendSummary = readModel.bundleSummaries[bundleId]
    ?? createEmptyServiceReadModel(state.realtimeStatus).bundleSummaries[bundleId];

  if (backendSummary) {
    return {
      title: backendSummary.title,
      metric: backendSummary.metric,
      detail: backendSummary.detail,
      availability: backendSummary.availability,
      trust: backendSummary.trust,
      counters: backendSummary.counters,
      signals: backendSummary.signals,
      domains: backendSummary.domains,
    };
  }

  const definition = getBundleDefinition(bundleId);
  return {
    title: definition.label,
    metric: t('bundle.syncing'),
    detail: `${definition.description} ${t('bundle.awaiting')}`,
    availability: 'planned',
    trust: 'pending',
    counters: [],
    signals: [],
    domains: [],
  };
}

function buildLayerGateCopy(status: LayerGateStatus | null): Pick<LayerControlRow, 'gateDetail' | 'gateTone'> {
  if (!status) return {};
  const presentation = LAYER_GATE_PRESENTATION[status.code];
  return {
    gateDetail: t(presentation.detailKey),
    gateTone: presentation.tone,
  };
}

function buildLayerRow(
  rowId: LayerGateLayerId,
  state: ConsoleState,
): LayerControlRow {
  const gateStatus = state.layerGateStatuses[rowId];

  if (rowId === 'aftershock-cascade') {
    const visible = gateStatus === null;
    return {
      id: rowId,
      label: t('layer.name.aftershockCascade'),
      availability: 'live',
      visible,
      effectiveVisible: visible,
      ...buildLayerGateCopy(gateStatus),
    };
  }

  const definition = getLayerDefinition(rowId);
  const gateBlocking = gateStatus?.blocking ?? false;
  const visible = gateBlocking ? false : state.layerVisibility[rowId];
  const effectiveVisible = gateBlocking
    ? false
    : isLayerEffectivelyVisible(
        rowId,
        state.layerVisibility[rowId],
        state.bundleSettings,
      );

  return {
    id: rowId,
    label: definition.label,
    availability: definition.availability,
    visible,
    effectiveVisible,
    ...buildLayerGateCopy(gateStatus),
  };
}

function getLayerRowIds(state: ConsoleState): LayerGateLayerId[] {
  const activeBundle = getBundleDefinition(state.activeBundleId);
  const rowIds: LayerGateLayerId[] = [...activeBundle.layerIds];

  if (
    activeBundle.id === 'seismic'
    && (state.selectedEvent !== null || state.layerGateStatuses['aftershock-cascade'] !== null)
  ) {
    rowIds.push('aftershock-cascade');
  }

  return rowIds;
}

function formatAvailabilityLabel(availability: BundleSummary['availability']): string {
  switch (availability) {
    case 'live': return t('bundle.live');
    case 'modeled': return t('bundle.modeled');
    case 'planned': return t('bundle.planned');
  }
}

function renderCounter(counter: OperatorBundleCounter): string {
  return `
    <span class="nz-bundle-counter nz-bundle-counter--${counter.tone}">
      <span class="nz-bundle-counter__label">${counter.label}</span>
      <span class="nz-bundle-counter__value">${counter.value}</span>
    </span>
  `;
}

function renderSummaryMeta(summary: BundleSummary): string {
  return `
    <div class="nz-bundle-summary-meta">
      <span class="nz-bundle-availability nz-bundle-availability--${summary.availability}">${formatAvailabilityLabel(summary.availability)}</span>
      <span class="nz-bundle-trust nz-bundle-trust--${summary.trust}">${summary.trust}</span>
      ${summary.counters.map(renderCounter).join('')}
    </div>
  `;
}

function renderSignal(signal: OperatorBundleSignal): string {
  return `
    <div class="nz-bundle-signal nz-bundle-signal--${signal.tone}">
      <span class="nz-bundle-signal__label">${signal.label}</span>
      <span class="nz-bundle-signal__value">${signal.value}</span>
    </div>
  `;
}

function renderSignals(summary: BundleSummary): string {
  if (summary.signals.length === 0) {
    return '';
  }

  return `
    <div class="nz-bundle-signals">
      ${summary.signals.map(renderSignal).join('')}
    </div>
  `;
}

function renderDomain(domain: OperatorBundleDomain): string {
  return `
    <div class="nz-bundle-card">
      <div class="nz-bundle-card__label">${domain.label}</div>
      <div class="nz-bundle-card__metric">${domain.metric}</div>
      <div class="nz-bundle-card__detail">${domain.detail}</div>
      ${domain.signals.length > 0 ? `
        <div class="nz-bundle-signals">
          ${domain.signals.map(renderSignal).join('')}
        </div>
      ` : ''}
      <div class="nz-bundle-summary-meta">
        <span class="nz-bundle-availability nz-bundle-availability--${domain.availability}">${formatAvailabilityLabel(domain.availability)}</span>
        <span class="nz-bundle-trust nz-bundle-trust--${domain.trust}">${domain.trust}</span>
        ${domain.counters.map(renderCounter).join('')}
      </div>
    </div>
  `;
}

export function buildLayerControlModel(state: ConsoleState): LayerControlModel {
  const activeBundle = getBundleDefinition(state.activeBundleId);
  const activeView = getOperatorViewPreset(state.activeViewId);

  return {
    activeBundle: {
      id: activeBundle.id,
      label: activeBundle.label,
      description: activeBundle.description,
    },
    activeView: {
      id: activeView.id,
      label: activeView.label,
    },
    bundleSummaries: getAllBundleDefinitions().map((bundle) => ({
      id: bundle.id,
      enabled: state.bundleSettings[bundle.id].enabled,
      summary: buildBundleSummary(bundle.id, state),
    })),
    operatorViews: getAllOperatorViewPresets(),
    layerRows: getLayerRowIds(state).map((layerId) => buildLayerRow(layerId, state)),
  };
}

function renderDock(state: ConsoleState): string {
  const deck = buildCommandDeckModel(state);

  return `
    <div class="nz-bottom-bar__info">
      <span class="nz-bottom-bar__zoom">${deck.viewportFact.split(' ')[0]}</span>
      <span class="nz-bottom-bar__tier">${state.viewport.tier}</span>
      ${state.showCoordinates ? `<span class="nz-bottom-bar__coords">
        ${state.viewport.center.lat.toFixed(3)}° ${state.viewport.center.lng.toFixed(3)}°
      </span>` : ''}
    </div>
    <div class="nz-bundle-dock">
      <div class="nz-bundle-dock__bundles">
        ${deck.bundleChips.map((chip) => `
          <button
            class="nz-bundle-chip${chip.active ? ' nz-bundle-chip--active' : ''}${chip.enabled ? ' nz-bundle-chip--enabled' : ''}"
            data-bundle="${chip.id}"
          >${chip.label}</button>
        `).join('')}
      </div>
      <div class="nz-bundle-dock__actions">
        <span class="nz-bundle-dock__view">${deck.controls.map((control) => `${control.label}:${control.value}`).join(' · ')}</span>
        <button class="nz-depth-toggle" data-action="depth" title="${t('depth.toggle')}">
          ${t('depth.button')}
        </button>
        <button class="nz-scenario-btn${state.scenarioMode ? ' nz-scenario-btn--on' : ''}" data-action="scenario">
          ${t('bundle.scenario')}
        </button>
        <button class="nz-drawer-toggle${state.bundleDrawerOpen ? ' nz-drawer-toggle--open' : ''}" data-action="drawer">
          ${state.bundleDrawerOpen ? t('bundle.hideControls') : t('bundle.showControls')}
        </button>
      </div>
    </div>
  `;
}

function renderLegendEntries(layerRows: LayerControlRow[]): string {
  const entries: Array<{ layerLabel: string; legend: LegendEntry[] }> = [];
  for (const row of layerRows) {
    if (!row.visible) continue;
    if (row.id === 'aftershock-cascade') continue;
    const def = getLayerDefinition(row.id);
    if (def.legend && def.legend.length > 0) {
      entries.push({ layerLabel: def.label, legend: def.legend });
    }
  }
  if (entries.length === 0) return '';

  return `
    <div class="nz-bundle-card">
      <div class="nz-bundle-card__label">${t('bundle.legend')}</div>
      <div class="nz-bundle-legend">
        ${entries.map((e) =>
          e.legend.map((entry) => `
            <div class="nz-bundle-legend__row">
              <span class="nz-bundle-legend__swatch" style="background:${entry.color}"></span>
              <span class="nz-bundle-legend__label">${entry.label}</span>
            </div>
          `).join('')
        ).join('')}
      </div>
    </div>
  `;
}

export function renderLayerControlDrawer(state: ConsoleState, model?: LayerControlModel): string {
  if (!model) model = buildLayerControlModel(state);
  return renderDrawerImpl(state, model);
}

function renderDrawerImpl(state: ConsoleState, model: LayerControlModel): string {
  const activeBundleEnabled = state.bundleSettings[state.activeBundleId].enabled;
  const activeSummary = buildBundleSummary(state.activeBundleId, state);
  const density = state.bundleSettings[state.activeBundleId].density;

  return `
    <div class="nz-bundle-drawer${state.bundleDrawerOpen ? ' nz-bundle-drawer--open' : ''}">
      <div class="nz-bundle-drawer__header">
        <div>
          <div class="nz-bundle-drawer__eyebrow">${t('bundle.operatorView')}</div>
          <div class="nz-bundle-drawer__title">${model.activeBundle.label}</div>
          <div class="nz-bundle-drawer__detail">${model.activeBundle.description}</div>
          <div class="nz-bundle-drawer__density">
            <span class="nz-bundle-drawer__density-label">${t('bundle.density')}</span>
            <div class="nz-bundle-drawer__density-group">
              <button class="nz-density-btn${density === 'minimal' ? ' nz-density-btn--active' : ''}" data-density="minimal">${t('bundle.density.minimal')}</button>
              <button class="nz-density-btn${density === 'standard' ? ' nz-density-btn--active' : ''}" data-density="standard">${t('bundle.density.standard')}</button>
              <button class="nz-density-btn${density === 'dense' ? ' nz-density-btn--active' : ''}" data-density="dense">${t('bundle.density.dense')}</button>
            </div>
          </div>
        </div>
        <button
          class="nz-bundle-drawer__enable${activeBundleEnabled ? ' nz-bundle-drawer__enable--on' : ''}"
          data-action="toggle-bundle"
        >
          ${activeBundleEnabled ? t('bundle.enabled') : t('bundle.disabled')}
        </button>
      </div>

      <div class="nz-bundle-drawer__views">
        ${model.operatorViews.map((view) => `
          <button
            class="nz-view-chip${state.activeViewId === view.id ? ' nz-view-chip--active' : ''}"
            data-view="${view.id}"
          >${view.label}</button>
        `).join('')}
      </div>

      <div class="nz-bundle-drawer__content">
        <div class="nz-bundle-drawer__primary">
          <div class="nz-bundle-card">
            <div class="nz-bundle-card__label">${t('bundle.activeSummary')}</div>
            <div class="nz-bundle-card__metric">${activeSummary.metric}</div>
            <div class="nz-bundle-card__detail">${activeSummary.detail}</div>
            ${renderSignals(activeSummary)}
            ${renderSummaryMeta(activeSummary)}
          </div>
          ${activeSummary.domains.length > 0 ? `
            <div class="nz-bundle-card">
              <div class="nz-bundle-card__label">${t('bundle.domainBreakdown')}</div>
              ${activeSummary.domains.map(renderDomain).join('')}
            </div>
          ` : ''}
          <div class="nz-bundle-card">
            <div class="nz-bundle-card__label">${t('bundle.layers')}</div>
            <div class="nz-bundle-layer-list">
              ${model.layerRows.map((row) => {
                const rowDisabled = row.availability === 'planned' || row.id === 'aftershock-cascade';
                const rowStatic = row.id === 'aftershock-cascade';
                return `
                <button class="nz-bundle-layer-row${row.availability === 'planned' ? ' nz-bundle-layer-row--planned' : ''}${rowStatic ? ' nz-bundle-layer-row--static' : ''}" ${rowDisabled ? 'disabled' : `data-layer="${row.id}"`}>
                  <span class="nz-bundle-layer-row__copy">
                    <span class="nz-bundle-layer-row__title">${row.label}</span>
                    <span class="nz-bundle-layer-row__state">${row.availability === 'planned' ? t('bundle.planned') : row.effectiveVisible ? t('bundle.visibleInView') : t('bundle.hiddenInView')}</span>
                    ${row.gateDetail ? `<span class="nz-bundle-layer-row__gate-detail nz-bundle-layer-row__gate-detail--${row.gateTone ?? 'nominal'}">${row.gateDetail}</span>` : ''}
                  </span>
                  <span class="nz-bundle-layer-row__toggle${row.visible ? ' nz-bundle-layer-row__toggle--on' : ''}">
                    ${row.availability === 'planned' ? t('bundle.soon') : row.visible ? t('bundle.on') : t('bundle.off')}
                  </span>
                </button>
              `;
              }).join('')}
            </div>
          </div>
          ${renderLegendEntries(model.layerRows)}
        </div>

        <div class="nz-bundle-drawer__secondary">
          ${model.bundleSummaries.map((entry) => `
            <button class="nz-bundle-summary-card${state.activeBundleId === entry.id ? ' nz-bundle-summary-card--active' : ''}" data-bundle="${entry.id}">
              <span class="nz-bundle-summary-card__title">${entry.summary.title}</span>
              <span class="nz-bundle-summary-card__metric">${entry.summary.metric}</span>
              <span class="nz-bundle-summary-card__detail">${entry.summary.detail}</span>
              ${renderSignals(entry.summary)}
              ${renderSummaryMeta(entry.summary)}
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function toggleLayer(layerId: LayerId): void {
  const current = consoleStore.get('layerVisibility');
  consoleStore.set('layerVisibility', {
    ...current,
    [layerId]: !current[layerId],
  });
}

function toggleActiveBundle(): void {
  const current = consoleStore.get('bundleSettings');
  const activeBundleId = consoleStore.get('activeBundleId');
  consoleStore.set('bundleSettings', {
    ...current,
    [activeBundleId]: {
      ...current[activeBundleId],
      enabled: !current[activeBundleId].enabled,
    },
  });
}

function bindDockInteractions(dock: HTMLElement, drawer: HTMLElement): void {
  const bindBundleSelection = (button: HTMLButtonElement): void => {
    button.addEventListener('click', () => {
      const bundleId = button.dataset.bundle as BundleId;
      const current = consoleStore.get('activeBundleId');
      if (bundleId === current) {
        consoleStore.set('bundleDrawerOpen', !consoleStore.get('bundleDrawerOpen'));
        return;
      }
      consoleStore.set('activeBundleId', bundleId);
      consoleStore.set('bundleDrawerOpen', true);
    });
  };

  dock.querySelectorAll<HTMLButtonElement>('[data-bundle]').forEach(bindBundleSelection);
  drawer.querySelectorAll<HTMLButtonElement>('[data-bundle]').forEach(bindBundleSelection);

  dock.querySelector<HTMLButtonElement>('[data-action="scenario"]')?.addEventListener('click', () => {
    toggleScenarioMode();
  });

  dock.querySelector<HTMLButtonElement>('[data-action="depth"]')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('nz-depth-toggle'));
  });

  dock.querySelector<HTMLButtonElement>('[data-action="drawer"]')?.addEventListener('click', () => {
    consoleStore.set('bundleDrawerOpen', !consoleStore.get('bundleDrawerOpen'));
  });

  drawer.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const viewId = button.dataset.view as ConsoleState['activeViewId'];
      consoleStore.set('activeViewId', viewId);
      consoleStore.set('bundleSettings', applyOperatorViewPreset(viewId, consoleStore.get('bundleSettings')));
      consoleStore.set('activeBundleId', getOperatorViewPreset(viewId).primaryBundle);
      consoleStore.set('bundleDrawerOpen', true);
    });
  });

  drawer.querySelector<HTMLButtonElement>('[data-action="toggle-bundle"]')?.addEventListener('click', () => {
    toggleActiveBundle();
  });

  drawer.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach((button) => {
    button.addEventListener('click', () => {
      const layerId = button.dataset.layer as LayerId;
      toggleLayer(layerId);
    });
  });

  drawer.querySelectorAll<HTMLButtonElement>('[data-density]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const density = btn.dataset.density as BundleDensity;
      const activeBundleId = consoleStore.get('activeBundleId');
      const current = consoleStore.get('bundleSettings');
      consoleStore.set('bundleSettings', {
        ...current,
        [activeBundleId]: { ...current[activeBundleId], density },
      });
    });
  });
}

export function mountLayerControl(dock: HTMLElement, drawerHost: HTMLElement): () => void {
  let renderScheduled = false;

  const render = (): void => {
    renderScheduled = false;
    const state = consoleStore.getState();
    const model = buildLayerControlModel(state);
    dock.innerHTML = renderDock(state);
    drawerHost.innerHTML = renderDrawerImpl(state, model);
    bindDockInteractions(dock, drawerHost);
  };

  // Coalesce rapid store changes into a single render per frame
  const scheduleRender = (): void => {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(render);
  };

  // Fast path: only update zoom/coords text without full DOM rebuild
  const renderViewportFast = (): void => {
    const state = consoleStore.getState();
    const deck = buildCommandDeckModel(state);
    const zoomEl = dock.querySelector('.nz-bottom-bar__zoom');
    const tierEl = dock.querySelector('.nz-bottom-bar__tier');
    const coordsEl = dock.querySelector('.nz-bottom-bar__coords');
    if (zoomEl) zoomEl.textContent = deck.viewportFact.split(' ')[0];
    if (tierEl) tierEl.textContent = state.viewport.tier;
    if (coordsEl) {
      coordsEl.textContent = `${state.viewport.center.lat.toFixed(3)}° ${state.viewport.center.lng.toFixed(3)}°`;
    }
  };

  render();

  const unsubs = [
    consoleStore.subscribe('viewport', renderViewportFast),
    consoleStore.subscribe('selectedEvent', scheduleRender),
    consoleStore.subscribe('layerGateStatuses', scheduleRender),
    consoleStore.subscribe('scenarioMode', scheduleRender),
    consoleStore.subscribe('activeBundleId', scheduleRender),
    consoleStore.subscribe('activeViewId', scheduleRender),
    consoleStore.subscribe('bundleSettings', scheduleRender),
    consoleStore.subscribe('bundleDrawerOpen', scheduleRender),
    consoleStore.subscribe('layerVisibility', scheduleRender),
    consoleStore.subscribe('vessels', scheduleRender),
    consoleStore.subscribe('readModel', scheduleRender),
    consoleStore.subscribe('showCoordinates', scheduleRender),
  ];

  return () => {
    for (const unsub of unsubs) unsub();
  };
}
