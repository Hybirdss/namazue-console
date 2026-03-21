/**
 * Depth Cross-Section Panel — Bearing-responsive seismological depth profile.
 *
 * The cross-section dynamically rotates with the map bearing:
 * - bearing=0°: E-W slice (longitude on X axis) — classic view
 * - bearing=90°: N-S slice through Japan (latitude on X axis)
 * - any bearing: arbitrary slice through the viewport center
 *
 * Based on standard tools: GMT pscoupe, tectoplot, IRIS IEB, Hi-net Hypomap.
 *
 * References:
 *   GMT seis.cpt — github.com/GenericMappingTools/gmt/blob/master/share/cpt/gmt/seis.cpt
 *   tectoplot — github.com/wardahfadil/tectoplot
 *   IRIS IEB — ds.iris.edu/ieb/
 */

import { consoleStore } from '../core/store';
import { t, tf as tfFmt } from '../i18n';
import { escapeHtml } from '../utils/escapeHtml';
import { getLocalizedPlace } from '../utils/japanGeo';
import type { EarthquakeEvent } from '../types';

import {
  buildTransform,
  computeSliceExtent,
  createSlice,
  drawCrossSection,
  findEventAtPoint,
  MARGIN,
  type Transform,
} from './depthCrossSection/chartRenderer.ts';
import { depthToColor } from './depthCrossSection/geologicalData.ts';

// Re-export public API used by tests and other modules
export { buildTransform } from './depthCrossSection/chartRenderer.ts';
export { magToRadius } from './depthCrossSection/geologicalData.ts';

// ── Layout constants ────────────────────────────────────────────

const DEFAULT_HEIGHT = 260;

// Default Japan viewport (used as fallback)
const JAPAN_CENTER_LAT = 36.5;
const JAPAN_CENTER_LNG = 137.0;

// ── Tooltip ─────────────────────────────────────────────────────

function showTooltip(
  tooltip: HTMLElement,
  ev: EarthquakeEvent,
  mouseX: number,
  mouseY: number,
  containerRect: DOMRect,
): void {
  const c = depthToColor(ev.depth_km);
  tooltip.innerHTML = `
    <div style="color:rgb(${c.r},${c.g},${c.b});font-weight:700;font-size:12px">M${ev.magnitude.toFixed(1)}</div>
    <div style="margin-top:2px">${escapeHtml(getLocalizedPlace(ev.lat, ev.lng, ev.place.text))}</div>
    <div style="opacity:0.6;margin-top:2px">${tfFmt('depth.depthLabel', { n: ev.depth_km.toFixed(1) })}</div>
    <div style="opacity:0.5">${ev.lng.toFixed(2)}\u00B0E \u00B7 ${t(`faultType.${ev.faultType}`)}</div>
  `;
  tooltip.style.display = 'block';
  const tx = mouseX + 16;
  const ty = mouseY - 45;
  tooltip.style.left = `${Math.min(tx, containerRect.width - 200)}px`;
  tooltip.style.top = `${Math.max(4, ty)}px`;
}

// ── Mount ────────────────────────────────────────────────────────

export function mountDepthCrossSection(
  container: HTMLElement,
  onSelectEvent: (event: EarthquakeEvent) => void,
): () => void {
  container.innerHTML = `
    <div class="nz-depth-profile nz-depth-profile--hidden" id="nz-depth-panel">
      <div class="nz-depth-profile__header">
        <span class="nz-depth-profile__title">${t('depth.title')}</span>
        <span class="nz-depth-profile__count" id="nz-depth-count"></span>
        <span class="nz-depth-profile__subtitle">${t('depth.subtitle')}</span>
        <button class="nz-depth-profile__close" id="nz-depth-close" title="${t('depth.close')}">\u00d7</button>
      </div>
      <div class="nz-depth-profile__canvas-wrap">
        <canvas id="nz-depth-canvas"></canvas>
        <div class="nz-depth-profile__tooltip" id="nz-depth-tooltip"></div>
      </div>
      <div class="nz-depth-profile__resize" id="nz-depth-resize"></div>
    </div>
  `;

  const panel = container.querySelector('#nz-depth-panel') as HTMLElement;
  const canvas = container.querySelector('#nz-depth-canvas') as HTMLCanvasElement;
  const tooltip = container.querySelector('#nz-depth-tooltip') as HTMLElement;
  const closeBtn = container.querySelector('#nz-depth-close') as HTMLButtonElement;
  const resizeHandle = container.querySelector('#nz-depth-resize') as HTMLElement;
  const countEl = container.querySelector('#nz-depth-count') as HTMLElement;
  const maybeCtx = canvas.getContext('2d');
  if (!maybeCtx) return () => {};
  const ctx: CanvasRenderingContext2D = maybeCtx;

  let panelHeight = DEFAULT_HEIGHT;
  let hoveredId: string | null = null;
  let renderScheduled = false;

  // Bearing state — updated in real-time from map rotation
  let currentBearing = 0;
  let currentCenterLat = JAPAN_CENTER_LAT;
  let currentCenterLng = JAPAN_CENTER_LNG;

  function resize(): boolean {
    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement;
    if (!parent) return false;
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    return rect.width > MARGIN.left + MARGIN.right && rect.height > MARGIN.top + MARGIN.bottom;
  }

  function render(): void {
    renderScheduled = false;
    const events = consoleStore.get('events');
    const catalogEvents = consoleStore.get('catalogEvents');
    const selectedEvent = consoleStore.get('selectedEvent');

    const allEvents = catalogEvents.length > 0
      ? mergeEvents(events, catalogEvents)
      : events;

    countEl.textContent = tfFmt('temporal.events', { n: allEvents.length });

    const slice = createSlice(currentCenterLat, currentCenterLng, currentBearing);
    const { distMin, distMax } = computeSliceExtent(allEvents, slice);
    const xf = buildTransform(canvas.width, canvas.height, slice, distMin, distMax);

    const faults = consoleStore.get('faults');
    drawCrossSection(ctx, allEvents, faults, selectedEvent?.id ?? null, hoveredId, xf, window.devicePixelRatio || 1);
  }

  function scheduleRender(): void {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      if (!resize()) {
        renderScheduled = false;
        return;
      }
      render();
    });
  }

  function getMousePos(e: MouseEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function getCurrentTransform(): Transform {
    const events = consoleStore.get('events');
    const catalogEvents = consoleStore.get('catalogEvents');
    const allEvents = catalogEvents.length > 0
      ? mergeEvents(events, catalogEvents)
      : events;
    const slice = createSlice(currentCenterLat, currentCenterLng, currentBearing);
    const { distMin, distMax } = computeSliceExtent(allEvents, slice);
    return buildTransform(canvas.width, canvas.height, slice, distMin, distMax);
  }

  function handleMouseMove(e: MouseEvent): void {
    const pos = getMousePos(e);
    const xf = getCurrentTransform();
    const events = consoleStore.get('events');
    const catalogEvents = consoleStore.get('catalogEvents');
    const allEvents = catalogEvents.length > 0
      ? mergeEvents(events, catalogEvents) : events;

    const found = findEventAtPoint(allEvents, pos.x, pos.y, xf);
    if (found) {
      canvas.style.cursor = 'pointer';
      hoveredId = found.id;
      const parentRect = canvas.parentElement?.getBoundingClientRect();
      if (parentRect) showTooltip(tooltip, found, pos.x, pos.y, parentRect);
    } else {
      canvas.style.cursor = 'crosshair';
      hoveredId = null;
      tooltip.style.display = 'none';
    }
    scheduleRender();
  }

  function handleClick(e: MouseEvent): void {
    const pos = getMousePos(e);
    const xf = getCurrentTransform();
    const events = consoleStore.get('events');
    const catalogEvents = consoleStore.get('catalogEvents');
    const allEvents = catalogEvents.length > 0
      ? mergeEvents(events, catalogEvents) : events;

    const found = findEventAtPoint(allEvents, pos.x, pos.y, xf);
    if (found) onSelectEvent(found);
  }

  function handleMouseLeave(): void {
    hoveredId = null;
    tooltip.style.display = 'none';
    scheduleRender();
  }

  // Real-time bearing updates from map rotation
  const handleBearingUpdate = ((e: CustomEvent) => {
    const { bearing, center } = e.detail;
    const bearingChanged = Math.abs(bearing - currentBearing) > 0.3;
    const centerChanged = center && (
      Math.abs(center.lat - currentCenterLat) > 0.01 ||
      Math.abs(center.lng - currentCenterLng) > 0.01
    );

    if (bearingChanged || centerChanged) {
      currentBearing = bearing;
      if (center) {
        currentCenterLat = center.lat;
        currentCenterLng = center.lng;
      }
      scheduleRender();
    }
  }) as EventListener;

  // Also sync from store viewport (for moveend updates)
  function syncFromViewport(): void {
    const vp = consoleStore.get('viewport');
    if (vp) {
      currentBearing = vp.bearing;
      currentCenterLat = vp.center.lat;
      currentCenterLng = vp.center.lng;
      scheduleRender();
    }
  }

  // Resize handle drag
  let isResizing = false;
  let startY = 0;
  let startHeight = 0;

  function handleResizeStart(e: MouseEvent): void {
    e.preventDefault();
    isResizing = true;
    startY = e.clientY;
    startHeight = panelHeight;
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }

  function handleResizeMove(e: MouseEvent): void {
    if (!isResizing) return;
    const dy = startY - e.clientY;
    panelHeight = Math.max(140, Math.min(500, startHeight + dy));
    panel.style.height = `${panelHeight}px`;
    window.dispatchEvent(new CustomEvent('nz-depth-resize', { detail: { height: panelHeight } }));
    scheduleRender();
  }

  function handleResizeEnd(): void {
    isResizing = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }

  function handleClose(): void {
    setVisible(false);
  }

  function setVisible(visible: boolean): void {
    panel.classList.toggle('nz-depth-profile--hidden', !visible);
    window.dispatchEvent(new CustomEvent('nz-depth-visibility', { detail: { visible } }));
    if (visible) {
      requestAnimationFrame(() => {
        if (!resize()) return;
        render();
      });
    }
  }

  function handleToggle(): void {
    const isVisible = !panel.classList.contains('nz-depth-profile--hidden');
    setVisible(!isVisible);
  }

  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('click', handleClick);
  canvas.addEventListener('mouseleave', handleMouseLeave);
  resizeHandle.addEventListener('mousedown', handleResizeStart);
  closeBtn.addEventListener('click', handleClose);
  window.addEventListener('nz-depth-toggle', handleToggle);
  window.addEventListener('resize', scheduleRender);
  window.addEventListener('nz-bearing-update', handleBearingUpdate);

  const unsub1 = consoleStore.subscribe('events', scheduleRender);
  const unsub2 = consoleStore.subscribe('catalogEvents', scheduleRender);
  const unsub3 = consoleStore.subscribe('selectedEvent', scheduleRender);
  const unsub4 = consoleStore.subscribe('viewport', syncFromViewport);

  // Initialize from current viewport
  syncFromViewport();

  if (resize()) {
    render();
  }

  return () => {
    canvas.removeEventListener('mousemove', handleMouseMove);
    canvas.removeEventListener('click', handleClick);
    canvas.removeEventListener('mouseleave', handleMouseLeave);
    resizeHandle.removeEventListener('mousedown', handleResizeStart);
    closeBtn.removeEventListener('click', handleClose);
    window.removeEventListener('nz-depth-toggle', handleToggle);
    window.removeEventListener('resize', scheduleRender);
    window.removeEventListener('nz-bearing-update', handleBearingUpdate);
    unsub1();
    unsub2();
    unsub3();
    unsub4();
  };
}

function mergeEvents(live: EarthquakeEvent[], catalog: EarthquakeEvent[]): EarthquakeEvent[] {
  const map = new Map<string, EarthquakeEvent>();
  for (const e of catalog) map.set(e.id, e);
  for (const e of live) map.set(e.id, e);
  return [...map.values()];
}
