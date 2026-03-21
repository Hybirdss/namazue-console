/**
 * Icon Atlas — Canvas-rendered infrastructure icon sprite sheet.
 *
 * 13 unique icons × 96×96 pixels = 1248×96 atlas (4x resolution).
 * Canvas 2D rendering: synchronous, no async loading, no URL lifecycle issues.
 *
 * Style: Bold colored symbols with colored glow — NO circle background.
 * Each icon is a distinctive pictographic silhouette in its category color.
 * This makes assets visually distinct from earthquake circles on the map.
 *
 * mask: false — icons display their embedded colors directly.
 * Severity/status is shown via separate ring layers, not icon tinting.
 *
 * Icon index:
 *   0: port             (#4A90D9 ocean blue)  — anchor
 *   1: rail_hub          (#5BA85B JR green)    — bullet train front
 *   2: hospital          (#E74C3C medical red) — bold cross
 *   3: power_substation  (#E67E22 orange)      — lightning bolt
 *   4: water_facility    (#3498DB water blue)  — water drop
 *   5: telecom_hub       (#8E44AD purple)      — antenna tower
 *   6: building_cluster  (#607D8B blue-gray)   — city skyline
 *   7: nuclear_plant     (#F39C12 amber)       — atom orbits
 *   8: airport           (#16A085 teal)        — plane silhouette
 *   9: dam               (#2980B9 deep blue)   — dam wall + water
 *  10: lng_terminal      (#D35400 burnt orange) — flame
 *  11: government_eoc    (#546E7A slate)       — landmark building
 *  12: evacuation_site   (#27AE60 green)       — running person
 */

import type { OpsAssetClass } from '../ops/types';

// ── Atlas layout ──────────────────────────────────────────────
const CELL = 96;
const ICON_COUNT = 13;

// ── Category colors ──────────────────────────────────────────
const BG: Record<string, string> = {
  port: '#4A90D9',
  rail_hub: '#5BA85B',
  hospital: '#E74C3C',
  power_substation: '#E67E22',
  water_facility: '#3498DB',
  telecom_hub: '#8E44AD',
  building_cluster: '#607D8B',
  nuclear_plant: '#F39C12',
  airport: '#16A085',
  dam: '#2980B9',
  lng_terminal: '#D35400',
  government_eoc: '#546E7A',
  evacuation_site: '#27AE60',
};

// ── Category Colors (RGBA) — exported for ring/badge layers ──
export const ICON_CATEGORY_COLORS: Record<string, [number, number, number, number]> = {
  port:             [74,  144, 217, 255],
  rail_hub:         [91,  168,  91, 255],
  hospital:         [231,  76,  60, 255],
  power_substation: [230, 126,  34, 255],
  water_facility:   [52,  152, 219, 255],
  telecom_hub:      [142,  68, 173, 255],
  building_cluster: [96,  125, 139, 255],
  nuclear_plant:    [243, 156,  18, 255],
  airport:          [22,  160, 133, 255],
  dam:              [41,  128, 185, 255],
  lng_terminal:     [211,  84,   0, 255],
  government_eoc:   [84,  110, 122, 255],
  evacuation_site:  [39,  174,  96, 255],
};

// ── Drawing helpers ──────────────────────────────────────────
type C = CanvasRenderingContext2D;

function roundedRect(ctx: C, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Icon drawing functions ───────────────────────────────────
// Each draws strokes/fills centered at origin (0,0).
// Symbols drawn in category color (set by rendering loop).
// Coordinate range: approximately -22 to +22.

type DrawFn = (ctx: C) => void;

const iconDefs: { id: string; bg: string; draw: DrawFn }[] = [
  // 0: port — anchor
  { id: 'port', bg: BG.port, draw: (ctx) => {
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, -14, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 17); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-11, 1); ctx.lineTo(11, 1); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-15, 9);
    ctx.quadraticCurveTo(-15, 20, 0, 20);
    ctx.quadraticCurveTo(15, 20, 15, 9);
    ctx.stroke();
  }},

  // 1: rail_hub — shinkansen side silhouette
  { id: 'rail_hub', bg: BG.rail_hub, draw: (ctx) => {
    // Sleek bullet train side profile
    ctx.beginPath();
    ctx.moveTo(-18, -3);
    ctx.lineTo(6, -3);
    ctx.quadraticCurveTo(17, -3, 21, 5);
    ctx.lineTo(21, 9);
    ctx.lineTo(-18, 9);
    ctx.closePath();
    ctx.fill();
    // Window band (dark cutout)
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(-16, 0, 30, 4);
    // Rail line
    ctx.fillStyle = BG.rail_hub;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-22, 13); ctx.lineTo(22, 13); ctx.stroke();
  }},

  // 2: hospital — bold medical cross
  { id: 'hospital', bg: BG.hospital, draw: (ctx) => {
    roundedRect(ctx, -6, -20, 12, 40, 2);
    ctx.fill();
    roundedRect(ctx, -20, -6, 40, 12, 2);
    ctx.fill();
  }},

  // 3: power_substation — lightning bolt
  { id: 'power_substation', bg: BG.power_substation, draw: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(3, -22);
    ctx.lineTo(-10, 2);
    ctx.lineTo(-1, 2);
    ctx.lineTo(-6, 22);
    ctx.lineTo(10, -2);
    ctx.lineTo(1, -2);
    ctx.closePath();
    ctx.fill();
  }},

  // 4: water_facility — water droplet
  { id: 'water_facility', bg: BG.water_facility, draw: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.bezierCurveTo(-4, -12, -16, -1, -16, 8);
    ctx.bezierCurveTo(-16, 17, -9, 22, 0, 22);
    ctx.bezierCurveTo(9, 22, 16, 17, 16, 8);
    ctx.bezierCurveTo(16, -1, 4, -12, 0, -22);
    ctx.closePath();
    ctx.fill();
  }},

  // 5: telecom_hub — radio tower with signal arcs
  { id: 'telecom_hub', bg: BG.telecom_hub, draw: (ctx) => {
    ctx.lineWidth = 4;
    // Tower legs
    ctx.beginPath();
    ctx.moveTo(-10, 22); ctx.lineTo(0, -5); ctx.lineTo(10, 22);
    ctx.stroke();
    // Crossbar
    ctx.beginPath(); ctx.moveTo(-5, 12); ctx.lineTo(5, 12); ctx.stroke();
    // Antenna mast
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, -16); ctx.stroke();
    // Tip
    ctx.beginPath(); ctx.arc(0, -17, 3, 0, Math.PI * 2); ctx.fill();
    // Signal arcs
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -17, 8, -2.2, -0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -17, 8, Math.PI + 0.9, Math.PI + 2.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -17, 13, -2.0, -1.1); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -17, 13, Math.PI + 1.1, Math.PI + 2.0); ctx.stroke();
  }},

  // 6: building_cluster — three buildings skyline
  { id: 'building_cluster', bg: BG.building_cluster, draw: (ctx) => {
    // Tall center
    roundedRect(ctx, -5, -18, 12, 38, 1.5);
    ctx.fill();
    // Short left
    roundedRect(ctx, -18, -2, 12, 22, 1.5);
    ctx.fill();
    // Medium right
    roundedRect(ctx, 8, -9, 11, 29, 1.5);
    ctx.fill();
    // Windows (dark cutouts)
    ctx.fillStyle = '#0d1117';
    const win = (x: number, y: number) => ctx.fillRect(x, y, 4, 3);
    // Center windows
    win(-2, -14); win(4, -14);
    win(-2, -9); win(4, -9);
    win(-2, -4); win(4, -4);
    win(-2, 1); win(4, 1);
    win(-2, 6); win(4, 6);
    // Left windows
    win(-16, 2); win(-10, 2);
    win(-16, 7); win(-10, 7);
    win(-16, 12); win(-10, 12);
    // Right windows
    win(10, -5); win(10, 0);
    win(10, 5); win(10, 10);
  }},

  // 7: nuclear_plant — atom symbol (3 orbital ellipses + nucleus)
  { id: 'nuclear_plant', bg: BG.nuclear_plant, draw: (ctx) => {
    ctx.lineWidth = 3.5;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 3);
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Nucleus
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  }},

  // 8: airport — airplane from above
  { id: 'airport', bg: BG.airport, draw: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(4, -12);
    ctx.lineTo(20, -2);
    ctx.lineTo(20, 2);
    ctx.lineTo(4, -3);
    ctx.lineTo(4, 10);
    ctx.lineTo(12, 16);
    ctx.lineTo(12, 19);
    ctx.lineTo(0, 14);
    ctx.lineTo(-12, 19);
    ctx.lineTo(-12, 16);
    ctx.lineTo(-4, 10);
    ctx.lineTo(-4, -3);
    ctx.lineTo(-20, 2);
    ctx.lineTo(-20, -2);
    ctx.lineTo(-4, -12);
    ctx.closePath();
    ctx.fill();
  }},

  // 9: dam — curved wall + water waves
  { id: 'dam', bg: BG.dam, draw: (ctx) => {
    ctx.lineWidth = 5;
    // Dam wall
    ctx.beginPath();
    ctx.moveTo(-20, -10);
    ctx.quadraticCurveTo(0, 6, 20, -10);
    ctx.stroke();
    // Water waves
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-18, 5);
    ctx.bezierCurveTo(-12, 0, -6, 10, 0, 5);
    ctx.bezierCurveTo(6, 0, 12, 10, 18, 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-16, 14);
    ctx.bezierCurveTo(-10, 9, -4, 19, 2, 14);
    ctx.bezierCurveTo(8, 9, 14, 19, 20, 14);
    ctx.stroke();
  }},

  // 10: lng_terminal — flame
  { id: 'lng_terminal', bg: BG.lng_terminal, draw: (ctx) => {
    // Outer flame
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.bezierCurveTo(-5, -13, -17, -2, -17, 8);
    ctx.bezierCurveTo(-17, 17, -9, 23, 0, 23);
    ctx.bezierCurveTo(9, 23, 17, 17, 17, 8);
    ctx.bezierCurveTo(17, -2, 5, -13, 0, -22);
    ctx.closePath();
    ctx.fill();
    // Inner flame cutout (dark)
    ctx.fillStyle = '#0d1117';
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-3, 8, -7, 12, -7, 16);
    ctx.bezierCurveTo(-7, 20, -4, 23, 0, 23);
    ctx.bezierCurveTo(4, 20, 7, 20, 7, 16);
    ctx.bezierCurveTo(7, 12, 3, 8, 0, 3);
    ctx.closePath();
    ctx.fill();
  }},

  // 11: government_eoc — landmark building with pediment and pillars
  { id: 'government_eoc', bg: BG.government_eoc, draw: (ctx) => {
    // Pediment (triangle)
    ctx.beginPath();
    ctx.moveTo(-18, -4);
    ctx.lineTo(0, -20);
    ctx.lineTo(18, -4);
    ctx.closePath();
    ctx.fill();
    // Entablature
    ctx.fillRect(-19, -5, 38, 5);
    // Pillars
    ctx.fillRect(-15, 0, 5, 18);
    ctx.fillRect(-4, 0, 5, 18);
    ctx.fillRect(8, 0, 5, 18);
    // Steps
    ctx.fillRect(-19, 18, 38, 4);
  }},

  // 12: evacuation_site — running person
  { id: 'evacuation_site', bg: BG.evacuation_site, draw: (ctx) => {
    // Head
    ctx.beginPath(); ctx.arc(2, -15, 5, 0, Math.PI * 2); ctx.fill();
    // Body
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(-2, 6); ctx.stroke();
    // Legs
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(-2, 6); ctx.lineTo(-12, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-2, 6); ctx.lineTo(9, 20); ctx.stroke();
    // Arms
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(-12, -10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(14, 0); ctx.stroke();
  }},
];

// ── Canvas rendering ─────────────────────────────────────────
// Synchronous atlas generation — ready before first deck.gl frame.
// Uses blob URL (not data URL) because CSP connect-src blocks data: URIs.
//
// Style: NO background circle. Colored symbols with colored glow.
// Drawn in 2 passes for a thick, luminous glow effect on dark maps.

let ICON_ATLAS_URL = '';

if (typeof document !== 'undefined') {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * ICON_COUNT;
  canvas.height = CELL;
  const ctx = canvas.getContext('2d')!;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  for (let i = 0; i < iconDefs.length; i++) {
    const def = iconDefs[i];
    const cx = i * CELL + CELL / 2;
    const cy = CELL / 2;

    // Pass 1: outer glow (wider blur)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.25, 1.25);
    ctx.shadowColor = def.bg;
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = def.bg;
    ctx.fillStyle = def.bg;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    def.draw(ctx);
    ctx.restore();

    // Pass 2: crisp symbol with tighter glow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.25, 1.25);
    ctx.shadowColor = def.bg;
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = def.bg;
    ctx.fillStyle = def.bg;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    def.draw(ctx);
    ctx.restore();
  }

  // Convert to blob URL — CSP-safe (blob: in connect-src, data: is not)
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  ICON_ATLAS_URL = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
}

export { ICON_ATLAS_URL };

// ── Icon Mapping ─────────────────────────────────────────────

function cell(index: number) {
  return { x: index * CELL, y: 0, width: CELL, height: CELL, anchorY: CELL / 2, mask: false };
}

export const ICON_MAPPING: Record<string, { x: number; y: number; width: number; height: number; anchorY: number; mask: boolean }> = {
  port: cell(0),
  rail_hub: cell(1),
  hospital: cell(2),
  power_substation: cell(3),
  water_facility: cell(4),
  telecom_hub: cell(5),
  building_cluster: cell(6),
  nuclear_plant: cell(7),
  airport: cell(8),
  dam: cell(9),
  lng_terminal: cell(10),
  government_eoc: cell(11),
  evacuation_site: cell(12),
};

// Legacy aliases
ICON_MAPPING['nuclear'] = ICON_MAPPING['nuclear_plant'];
ICON_MAPPING['thermal'] = ICON_MAPPING['power_substation'];

// ── Icon Sizes ───────────────────────────────────────────────
// Larger than circle-backed version since symbols have no background padding.

export const ASSET_ICON_SIZE: Record<OpsAssetClass, number> = {
  nuclear_plant: 28,
  port: 26,
  airport: 26,
  dam: 24,
  lng_terminal: 24,
  rail_hub: 24,
  hospital: 24,
  power_substation: 24,
  water_facility: 22,
  telecom_hub: 22,
  building_cluster: 22,
  government_eoc: 24,
  evacuation_site: 20,
};
