import type maplibregl from 'maplibre-gl';

import { t } from '../i18n';

export interface StartupFailureState {
  title: string;
  detail: string;
}

export type MapLoadHandle = Pick<maplibregl.Map, 'loaded' | 'once'>;

export function waitForMapLoad(map: MapLoadHandle): Promise<void> {
  if (map.loaded()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    map.once('load', () => resolve());
  });
}

export function describeStartupFailure(error: unknown): StartupFailureState {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (/webgl|webassembly|wasm/i.test(message)) {
    return {
      title: t('boot.failure.mapTitle'),
      detail: t('boot.failure.mapDetail'),
    };
  }

  return {
    title: t('boot.failure.genericTitle'),
    detail: t('boot.failure.genericDetail'),
  };
}

export function showStartupFailure(error: unknown): void {
  const failure = describeStartupFailure(error);
  const loadingScreen = document.getElementById('loading-screen');

  if (!loadingScreen) {
    return;
  }

  loadingScreen.setAttribute('data-state', 'error');
  loadingScreen.innerHTML = `
    <img class="loading-icon" src="/favicon.png" alt="Namazue" width="56" height="56" />
    <div class="loading-title">${failure.title}</div>
    <div class="loading-status">${failure.detail}</div>
    <button id="loading-retry" style="margin-top:8px;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,0.16);background:#111827;color:#e2e8f0;font:600 11px 'IBM Plex Mono','JetBrains Mono',monospace;letter-spacing:0.04em;cursor:pointer;">
      ${t('boot.failure.retry')}
    </button>
  `;

  const retry = document.getElementById('loading-retry');
  retry?.addEventListener('click', () => {
    window.location.reload();
  });
}
