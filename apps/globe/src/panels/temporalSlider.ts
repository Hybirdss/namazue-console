/**
 * Temporal Slider — Historical earthquake time range selector.
 *
 * Full-width bar at the bottom of the console with:
 *   - Decade-labeled track spanning 1900 → now
 *   - Draggable window (handles) to select time range
 *   - Event density histogram (counts per year)
 *   - Play button for animated scrubbing through decades
 *   - LIVE button to return to real-time mode
 *
 * When a time window is selected, the catalogLoader fetches
 * matching events from the Worker API and pushes them into
 * consoleStore.catalogEvents for 3D rendering.
 */

import { consoleStore } from '../core/store';
import { t, tf } from '../i18n';

// ── Config ─────────────────────────────────────────────────────

const FIRST_YEAR = 1900;
const PLAY_STEP_MS = 800;  // ms between animation frames
const WINDOW_YEARS = 10;   // default time window when entering historical mode

// ── State ──────────────────────────────────────────────────────

interface SliderState {
  active: boolean;       // false = live mode, true = historical
  startYear: number;     // left handle (inclusive)
  endYear: number;       // right handle (inclusive)
  playing: boolean;
  playTimer: ReturnType<typeof setInterval> | null;
}

// ── Helpers ────────────────────────────────────────────────────

function currentYear(): number {
  return new Date().getFullYear();
}

function yearToMs(year: number): number {
  return Date.UTC(year, 0, 1);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Render ──────────────────────────────────────────────────────

function renderSlider(state: SliderState): string {
  const nowYear = currentYear();
  const totalYears = nowYear - FIRST_YEAR + 1;

  // Decade labels
  const decades: string[] = [];
  for (let y = FIRST_YEAR; y <= nowYear; y += 10) {
    const pct = ((y - FIRST_YEAR) / totalYears) * 100;
    decades.push(`<span class="nz-ts__decade" style="left:${pct.toFixed(1)}%">${y}</span>`);
  }

  // Selection window
  const startPct = ((state.startYear - FIRST_YEAR) / totalYears) * 100;
  const endPct = ((state.endYear - FIRST_YEAR + 1) / totalYears) * 100;

  const windowHtml = state.active
    ? `<div class="nz-ts__window" style="left:${startPct.toFixed(1)}%;width:${(endPct - startPct).toFixed(1)}%">
        <div class="nz-ts__handle nz-ts__handle--left" data-handle="left"></div>
        <div class="nz-ts__range-label">${state.startYear}–${state.endYear}</div>
        <div class="nz-ts__handle nz-ts__handle--right" data-handle="right"></div>
      </div>`
    : '';

  const playBtn = state.active
    ? `<button class="nz-ts__play" id="nz-ts-play" title="${t('temporal.playAnimation')}">
        ${state.playing ? '⏸' : '▶'}
      </button>`
    : '';

  const catalogCount = consoleStore.get('catalogEvents').length;
  const countLabel = state.active && catalogCount > 0
    ? `<span class="nz-ts__catalog-count">${tf('temporal.events', { n: catalogCount.toLocaleString() })}</span>`
    : '';

  return `
    <div class="nz-ts ${state.active ? 'nz-ts--active' : ''}" id="nz-temporal-slider">
      <div class="nz-ts__controls">
        <span class="nz-ts__title">${t('temporal.catalog')}</span>
        ${playBtn}
        <button class="nz-ts__mode ${state.active ? '' : 'nz-ts__mode--live'}" id="nz-ts-mode">
          ${state.active ? t('temporal.exit') : t('temporal.live')}
        </button>
        ${countLabel}
      </div>
      <div class="nz-ts__track" id="nz-ts-track">
        <div class="nz-ts__histogram" id="nz-ts-histogram"></div>
        ${windowHtml}
        <div class="nz-ts__decades">${decades.join('')}</div>
      </div>
    </div>
  `;
}

// ── CSS ─────────────────────────────────────────────────────────

const SLIDER_CSS = `
.nz-ts {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 12px 8px;
  background: rgba(10, 12, 16, 0.85);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  user-select: none;
}

.nz-ts__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.nz-ts__title {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 10px;
}

.nz-ts__mode {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  padding: 2px 8px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}

.nz-ts__mode:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.nz-ts__mode--live {
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.3);
}

.nz-ts__play {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 10px;
  padding: 2px 6px;
  cursor: pointer;
  font-family: inherit;
}

.nz-ts__play:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.nz-ts__catalog-count {
  color: rgba(125, 211, 252, 0.8);
  font-size: 10px;
  margin-left: auto;
}

.nz-ts__track {
  position: relative;
  height: 32px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
  cursor: pointer;
  overflow: hidden;
}

.nz-ts__histogram {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
}

.nz-ts__histogram .nz-ts__bar {
  flex: 1;
  background: rgba(96, 165, 250, 0.15);
  min-height: 0;
  transition: background 0.2s;
}

.nz-ts--active .nz-ts__histogram .nz-ts__bar {
  background: rgba(96, 165, 250, 0.08);
}

.nz-ts__window {
  position: absolute;
  top: 0;
  bottom: 0;
  background: rgba(96, 165, 250, 0.12);
  border: 1px solid rgba(125, 211, 252, 0.4);
  border-radius: 3px;
  cursor: grab;
  z-index: 2;
}

.nz-ts__window:active {
  cursor: grabbing;
}

.nz-ts__handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  z-index: 3;
}

.nz-ts__handle::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 2px;
  height: 14px;
  background: rgba(125, 211, 252, 0.8);
  border-radius: 1px;
}

.nz-ts__handle--left {
  left: -4px;
}

.nz-ts__handle--left::after {
  left: 3px;
}

.nz-ts__handle--right {
  right: -4px;
}

.nz-ts__handle--right::after {
  right: 3px;
}

.nz-ts__range-label {
  position: absolute;
  top: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  color: rgba(125, 211, 252, 0.9);
  white-space: nowrap;
  pointer-events: none;
  font-weight: 600;
}

.nz-ts__decades {
  position: absolute;
  bottom: 2px;
  left: 0;
  right: 0;
  height: 12px;
  pointer-events: none;
  z-index: 1;
}

.nz-ts__decade {
  position: absolute;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.25);
  transform: translateX(-50%);
  white-space: nowrap;
}

.nz-ts--active .nz-ts__decade {
  color: rgba(255, 255, 255, 0.35);
}
`;

// ── Mount ───────────────────────────────────────────────────────

export interface TemporalSliderControl {
  enterHistorical(startYear?: number, endYear?: number): void;
  exitHistorical(): void;
  isActive(): boolean;
  dispose(): void;
}

export function mountTemporalSlider(
  container: HTMLElement,
): TemporalSliderControl {
  // Inject CSS once
  if (!document.getElementById('nz-ts-style')) {
    const style = document.createElement('style');
    style.id = 'nz-ts-style';
    style.textContent = SLIDER_CSS;
    document.head.appendChild(style);
  }

  const nowYear = currentYear();
  const totalYears = nowYear - FIRST_YEAR + 1;

  const state: SliderState = {
    active: false,
    startYear: nowYear - WINDOW_YEARS,
    endYear: nowYear,
    playing: false,
    playTimer: null,
  };

  function syncToStore(): void {
    if (!state.active) {
      consoleStore.set('catalogTimeRange', null);
      return;
    }
    consoleStore.set('catalogTimeRange', {
      since: yearToMs(state.startYear),
      until: yearToMs(state.endYear + 1) - 1,
    });
  }

  function render(): void {
    // Prevent document-level drag listener accumulation across re-renders.
    (container as any).__cleanupDrag?.();
    container.innerHTML = renderSlider(state);
    bindEvents();
  }

  function bindEvents(): void {
    const modeBtn = container.querySelector('#nz-ts-mode') as HTMLElement | null;
    const playBtn = container.querySelector('#nz-ts-play') as HTMLElement | null;
    const track = container.querySelector('#nz-ts-track') as HTMLElement | null;

    modeBtn?.addEventListener('click', () => {
      if (state.active) {
        exitHistorical();
      } else {
        enterHistorical();
      }
    });

    playBtn?.addEventListener('click', () => {
      if (state.playing) {
        stopPlay();
      } else {
        startPlay();
      }
      render();
    });

    // Track click — set window center to click position
    track?.addEventListener('click', (e: MouseEvent) => {
      if (!state.active) {
        // Click on track enters historical mode at clicked position
        const rect = track.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const year = Math.round(FIRST_YEAR + pct * totalYears);
        enterHistorical(year - Math.floor(WINDOW_YEARS / 2), year + Math.ceil(WINDOW_YEARS / 2));
        return;
      }

      // If clicking outside window, move window there
      const windowEl = container.querySelector('.nz-ts__window');
      if (windowEl && !windowEl.contains(e.target as Node)) {
        const rect = track.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        const clickYear = Math.round(FIRST_YEAR + pct * totalYears);
        const span = state.endYear - state.startYear;
        const half = Math.floor(span / 2);
        state.startYear = clamp(clickYear - half, FIRST_YEAR, nowYear - span);
        state.endYear = state.startYear + span;
        syncToStore();
        render();
      }
    });

    // Drag handles
    setupDrag();
  }

  function setupDrag(): void {
    const track = container.querySelector('#nz-ts-track') as HTMLElement | null;
    if (!track) return;

    const handles = container.querySelectorAll<HTMLElement>('.nz-ts__handle');
    const windowEl = container.querySelector('.nz-ts__window') as HTMLElement | null;

    let dragging: 'left' | 'right' | 'window' | null = null;
    let dragStartX = 0;
    let dragStartLeft = 0;
    let dragStartRight = 0;

    function yearFromX(clientX: number): number {
      const rect = track!.getBoundingClientRect();
      const pct = (clientX - rect.left) / rect.width;
      return Math.round(FIRST_YEAR + pct * totalYears);
    }

    handles.forEach((handle) => {
      handle.addEventListener('mousedown', (e: MouseEvent) => {
        e.stopPropagation();
        dragging = handle.dataset.handle as 'left' | 'right';
        dragStartX = e.clientX;
        dragStartLeft = state.startYear;
        dragStartRight = state.endYear;
        document.body.style.cursor = 'ew-resize';
      });
    });

    windowEl?.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('nz-ts__handle')) return;
      dragging = 'window';
      dragStartX = e.clientX;
      dragStartLeft = state.startYear;
      dragStartRight = state.endYear;
      document.body.style.cursor = 'grabbing';
    });

    function onMouseMove(e: MouseEvent): void {
      if (!dragging) return;

      const year = yearFromX(e.clientX);
      const span = dragStartRight - dragStartLeft;

      if (dragging === 'left') {
        state.startYear = clamp(year, FIRST_YEAR, state.endYear - 1);
      } else if (dragging === 'right') {
        state.endYear = clamp(year, state.startYear + 1, nowYear);
      } else if (dragging === 'window') {
        const deltaYears = yearFromX(e.clientX) - yearFromX(dragStartX);
        const newStart = clamp(dragStartLeft + deltaYears, FIRST_YEAR, nowYear - span);
        state.startYear = newStart;
        state.endYear = newStart + span;
      }

      syncToStore();
      render();
    }

    function onMouseUp(): void {
      if (!dragging) return;
      dragging = null;
      document.body.style.cursor = '';
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Store cleanup refs
    (container as any).__cleanupDrag = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }

  function enterHistorical(start?: number, end?: number): void {
    state.active = true;
    state.startYear = clamp(start ?? nowYear - WINDOW_YEARS, FIRST_YEAR, nowYear - 1);
    state.endYear = clamp(end ?? nowYear, state.startYear + 1, nowYear);
    syncToStore();
    render();
  }

  function exitHistorical(): void {
    stopPlay();
    state.active = false;
    syncToStore();
    render();
  }

  function startPlay(): void {
    if (state.playTimer) return;
    state.playing = true;
    const span = state.endYear - state.startYear;

    state.playTimer = setInterval(() => {
      if (state.endYear >= nowYear) {
        // Reached end, loop back
        state.startYear = FIRST_YEAR;
        state.endYear = FIRST_YEAR + span;
      } else {
        state.startYear += 1;
        state.endYear += 1;
      }
      syncToStore();
      render();
    }, PLAY_STEP_MS);
  }

  function stopPlay(): void {
    if (state.playTimer) {
      clearInterval(state.playTimer);
      state.playTimer = null;
    }
    state.playing = false;
  }

  // Subscribe to catalogEvents changes to update count display
  const unsubCatalog = consoleStore.subscribe('catalogEvents', () => {
    const countEl = container.querySelector('.nz-ts__catalog-count');
    if (countEl) {
      const count = consoleStore.get('catalogEvents').length;
      countEl.textContent = count > 0 ? tf('temporal.events', { n: count.toLocaleString() }) : '';
    }
  });

  // Initial render
  render();

  return {
    enterHistorical,
    exitHistorical,
    isActive() { return state.active; },
    dispose() {
      stopPlay();
      unsubCatalog();
      (container as any).__cleanupDrag?.();
      container.innerHTML = '';
    },
  };
}
