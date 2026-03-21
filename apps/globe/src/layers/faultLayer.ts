/**
 * Fault Layer — Active fault lines with professional cartographic styling.
 *
 * Catmull-Rom spline smoothing for natural curved lines.
 * High-contrast warm palette for visibility on dark maps.
 *
 * Zoom hierarchy:
 *   z0-3:  MEGA only (M8.5+), thin hairline
 *   z4-5:  MAJOR subduction zones (M8.0+)
 *   z6-7:  All M7.0+ faults clearly visible
 *   z8-9:  M6.5+ faults visible with labels
 *   z10+:  All faults with full detail
 *
 * Width scales with zoom for natural feel at every level.
 */

import { PathLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { ActiveFault } from '../types';
import { t, tf } from '../i18n';
import { escapeHtml } from '../utils/escapeHtml';
import { smoothFaultLine } from './smoothPath';

type RGBA = [number, number, number, number];
type Coord = [number, number];

// ── Color Palette ────────────────────────────────────────────
// High-contrast warm palette — clearly visible on dark map

const MEGA_COLOR:  RGBA = [245, 130, 85, 245]; // bright coral
const MAJOR_COLOR: RGBA = [225, 120, 75, 220]; // warm amber
const MOD_COLOR:   RGBA = [200, 110, 75, 185]; // terracotta
const MINOR_COLOR: RGBA = [170, 100, 75, 155]; // warm clay

// Glow halo colors — visible halos for important faults
const MEGA_GLOW:   RGBA = [245, 130, 85, 70];
const MAJOR_GLOW:  RGBA = [225, 120, 75, 50];
const MOD_GLOW:    RGBA = [200, 110, 75, 30];

const SELECTED_COLOR: RGBA = [255, 210, 120, 240]; // warm gold
const SELECTED_GLOW:  RGBA = [255, 200, 100, 60];
const HIGHLIGHT_COLOR: RGBA = [220, 170, 120, 160];

function faultColor(mw: number, isSelected: boolean): RGBA {
  if (isSelected) return SELECTED_COLOR;
  if (mw >= 8.0) return MEGA_COLOR;
  if (mw >= 7.0) return MAJOR_COLOR;
  if (mw >= 6.5) return MOD_COLOR;
  return MINOR_COLOR;
}

function faultGlowColor(mw: number, isSelected: boolean): RGBA {
  if (isSelected) return SELECTED_GLOW;
  if (mw >= 8.0) return MEGA_GLOW;
  if (mw >= 7.0) return MAJOR_GLOW;
  if (mw >= 6.5) return MOD_GLOW;
  return [0, 0, 0, 0];
}

// ── Zoom-adaptive widths ─────────────────────────────────────
// Lines get thicker as you zoom in — wider than before for visibility

function faultWidth(mw: number, zoom: number): number {
  const zoomScale = Math.max(0.8, Math.min(3.0, 0.4 + zoom * 0.25));
  if (mw >= 8.5) return 3.0 * zoomScale;
  if (mw >= 8.0) return 2.5 * zoomScale;
  if (mw >= 7.0) return 2.0 * zoomScale;
  if (mw >= 6.5) return 1.5 * zoomScale;
  return 1.0 * zoomScale;
}

function faultGlowWidth(mw: number, zoom: number, isSelected: boolean): number {
  // Glow tightens at low zoom to avoid visual noise
  const zoomScale = Math.max(0.3, Math.min(2.0, -0.2 + zoom * 0.2));
  if (isSelected) return 12 * zoomScale;
  if (mw >= 8.0) return 8 * zoomScale;
  if (mw >= 7.0) return 5 * zoomScale;
  if (mw >= 6.5) return 3 * zoomScale;
  return 0;
}

// ── Zoom-based Filtering ────────────────────────────────────

function minMwForZoom(zoom: number): number {
  if (zoom >= 10) return 0;    // show all
  if (zoom >= 8) return 6.5;   // moderate+
  if (zoom >= 6) return 7.0;   // major crustal faults
  if (zoom >= 4) return 8.0;   // major subduction zones
  return 8.5;                   // mega only
}

export function filterFaultsByZoom(faults: ActiveFault[], zoom: number): ActiveFault[] {
  const minMw = minMwForZoom(zoom);
  // Plate boundary (interface) faults always visible regardless of zoom
  return faults.filter((f) => f.faultType === 'interface' || f.estimatedMw >= minMw);
}

// ── Tooltip Formatter ───────────────────────────────────────

export function formatFaultTooltip(fault: ActiveFault): string {
  const risk = fault.estimatedMw >= 8.0 ? 'MEGA' : fault.estimatedMw >= 7.0 ? 'MAJOR' : 'MOD';
  const riskColor = fault.estimatedMw >= 8.0 ? '#e68c64' : fault.estimatedMw >= 7.0 ? '#d2825a' : '#b47355';
  const faultTypeLabel = t(`faultType.${fault.faultType}`);
  return `
    <div style="font-weight:600;font-size:12px;margin-bottom:3px">${escapeHtml(fault.name)}</div>
    <div style="opacity:0.7;font-size:11px">${escapeHtml(fault.nameEn)}</div>
    <div style="margin-top:4px;display:flex;gap:12px">
      <span style="color:${riskColor};font-weight:700">M${fault.estimatedMw.toFixed(1)}</span>
      <span style="opacity:0.6">${Math.round(fault.lengthKm)}km</span>
      <span style="opacity:0.6">${tf('fault.tooltip.depth', { n: fault.depthKm })}</span>
    </div>
    <div style="opacity:0.5;font-size:10px;margin-top:3px">
      ${risk} · ${faultTypeLabel} · ${tf('fault.tooltip.probability', { prob: fault.probability30yr })} · ${tf('fault.tooltip.recurrence', { interval: fault.interval })}
    </div>
  `;
}

// ── Smoothed path cache ─────────────────────────────────────
// Fault geometry is static — cache smoothed paths to avoid
// recalculating the noise→Chaikin→Catmull-Rom pipeline every frame.

const pathCache = new Map<string, Coord[]>();

function getSmoothedPath(d: ActiveFault): Coord[] {
  let cached = pathCache.get(d.id);
  if (!cached) {
    cached = smoothFaultLine(d.segments as Coord[], d.id, d.lengthKm, d.faultType);
    pathCache.set(d.id, cached);
  }
  return cached;
}

// ── Layer Factory ───────────────────────────────────────────

export function createFaultLayer(
  faults: ActiveFault[],
  zoom: number,
  selectedFaultId: string | null = null,
): Layer[] | null {
  const visible = filterFaultsByZoom(faults, zoom);
  if (visible.length === 0) return null;

  // Always include selected fault even if below zoom threshold
  if (selectedFaultId) {
    const selected = faults.find(f => f.id === selectedFaultId);
    if (selected && !visible.includes(selected)) {
      visible.push(selected);
    }
  }

  const glowData = visible.filter((f) => f.estimatedMw >= 6.5 || f.id === selectedFaultId);
  const layers: Layer[] = [];

  // 1. Glow halo — zoom-adaptive width, smoothed
  if (glowData.length > 0) {
    layers.push(new PathLayer<ActiveFault>({
      id: 'active-faults-glow',
      data: glowData,
      pickable: false,
      widthUnits: 'pixels',
      widthMinPixels: 0,
      getPath: getSmoothedPath,
      getWidth: (d) => faultGlowWidth(d.estimatedMw, zoom, d.id === selectedFaultId),
      getColor: (d) => faultGlowColor(d.estimatedMw, d.id === selectedFaultId),
      updateTriggers: {
        getColor: [selectedFaultId],
        getWidth: [selectedFaultId, zoom],
      },
    }));
  }

  // 2. Main crisp fault lines — zoom-adaptive width, smoothed
  layers.push(new PathLayer<ActiveFault>({
    id: 'active-faults',
    data: visible,
    pickable: true,
    autoHighlight: true,
    highlightColor: HIGHLIGHT_COLOR,
    widthUnits: 'pixels',
    widthMinPixels: 1.0,
    getPath: getSmoothedPath,
    getWidth: (d) => faultWidth(d.estimatedMw, zoom),
    getColor: (d) => faultColor(d.estimatedMw, d.id === selectedFaultId),
    updateTriggers: {
      getColor: [selectedFaultId],
      getWidth: [zoom],
    },
  }));

  return layers;
}
