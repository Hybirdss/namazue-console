import { consoleStore, type PerformanceTone } from '../core/store';
import { onLocaleChange, t } from '../i18n';
import type { RealtimeStatus } from '../ops/readModelTypes';
import type { BundleId } from '../layers/layerRegistry';

export interface OperatorPulseSnapshot {
  realtimeStatus: RealtimeStatus;
  performanceStatus: {
    fps: number;
    tone: PerformanceTone;
  };
  scenarioMode: boolean;
  activeBundleId: BundleId;
  now: number;
}

function labelForBundle(bundleId: BundleId): string {
  switch (bundleId) {
    case 'seismic':
      return t('panel.operatorPulse.bundle.seismic');
    case 'maritime':
      return t('panel.operatorPulse.bundle.maritime');
    case 'lifelines':
      return t('panel.operatorPulse.bundle.lifelines');
    case 'medical':
      return t('panel.operatorPulse.bundle.medical');
    case 'built-environment':
      return t('panel.operatorPulse.bundle.builtEnvironment');
    default:
      return bundleId;
  }
}

function labelForTone(tone: PerformanceTone): string {
  switch (tone) {
    case 'degraded':
      return t('panel.operatorPulse.tone.degraded');
    case 'watch':
      return t('panel.operatorPulse.tone.watch');
    default:
      return t('panel.operatorPulse.tone.nominal');
  }
}

function labelForRealtime(status: RealtimeStatus): string {
  const sourceMap: Record<string, string> = {
    server: t('realtime.source.server'),
    sse: t('realtime.source.sse'),
    poll: t('realtime.source.poll'),
  };
  const sourceLabel = sourceMap[status.source] ?? status.source.toUpperCase();
  const stateLabel = status.state === 'degraded'
    ? t('panel.operatorPulse.realtime.degraded')
    : status.state === 'stale'
      ? t('panel.operatorPulse.realtime.stale')
      : t('panel.operatorPulse.realtime.fresh');
  return `${sourceLabel} · ${stateLabel}`;
}

function formatAgeMs(ms: number): string {
  if (ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

function renderHealthRows(snapshot: OperatorPulseSnapshot): string {
  const freshnessAge = snapshot.realtimeStatus.updatedAt > 0
    ? snapshot.now - snapshot.realtimeStatus.updatedAt
    : 0;

  return `
    <div class="nz-pulse__rows">
      <div class="nz-pulse__row">
        <span class="nz-pulse__label">${t('panel.operatorPulse.realtime')}</span>
        <span class="nz-pulse__value">${labelForRealtime(snapshot.realtimeStatus)}</span>
      </div>
      <div class="nz-pulse__row">
        <span class="nz-pulse__label">${t('panel.operatorPulse.performance')}</span>
        <span class="nz-pulse__value nz-pulse__value--${snapshot.performanceStatus.tone}">${Math.round(snapshot.performanceStatus.fps)} FPS · ${labelForTone(snapshot.performanceStatus.tone)}</span>
      </div>
      <div class="nz-pulse__row">
        <span class="nz-pulse__label">${t('panel.operatorPulse.bundle')}</span>
        <span class="nz-pulse__value">${labelForBundle(snapshot.activeBundleId)}</span>
      </div>
      <div class="nz-pulse__row">
        <span class="nz-pulse__label">${t('panel.operatorPulse.scenario')}</span>
        <span class="nz-pulse__value ${snapshot.scenarioMode ? 'nz-pulse__value--watch' : ''}">${snapshot.scenarioMode ? t('panel.operatorPulse.scenario.on') : t('panel.operatorPulse.scenario.off')}</span>
      </div>
      <div class="nz-pulse__row">
        <span class="nz-pulse__label">${t('panel.operatorPulse.freshness')}</span>
        <span class="nz-pulse__value">${formatAgeMs(freshnessAge)} ${t('panel.operatorPulse.ago')}</span>
      </div>
    </div>
  `;
}

export function renderOperatorPulseMarkup(snapshot: OperatorPulseSnapshot): string {
  return `
    <div class="nz-panel" id="nz-operator-pulse">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('panel.operatorPulse.title')}</span>
      </div>
      ${renderHealthRows(snapshot)}
    </div>
  `;
}

export function mountOperatorPulse(container: HTMLElement): () => void {
  const render = (): void => {
    container.innerHTML = renderOperatorPulseMarkup({
      realtimeStatus: consoleStore.get('realtimeStatus'),
      performanceStatus: {
        fps: consoleStore.get('performanceStatus').fps,
        tone: consoleStore.get('performanceStatus').tone,
      },
      scenarioMode: consoleStore.get('scenarioMode'),
      activeBundleId: consoleStore.get('activeBundleId'),
      now: Date.now(),
    });
  };

  let scheduled = false;
  const scheduleRender = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      render();
    });
  };

  render();

  const unsubs = [
    consoleStore.subscribe('realtimeStatus', scheduleRender),
    consoleStore.subscribe('performanceStatus', scheduleRender),
    consoleStore.subscribe('scenarioMode', scheduleRender),
    consoleStore.subscribe('activeBundleId', scheduleRender),
    onLocaleChange(() => scheduleRender()),
  ];

  return () => {
    for (const unsub of unsubs) unsub();
  };
}
