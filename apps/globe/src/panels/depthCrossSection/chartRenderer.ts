import { t } from '../../i18n';
import type { ActiveFault, EarthquakeEvent } from '../../types';
import {
  BOUNDARY_STYLE,
  DEPTH_RAMP,
  DEPTH_REFS,
  DEPTH_REF_LABELS,
  MAX_DEPTH_KM,
  PACIFIC_SLAB,
  PHILIPPINE_SLAB,
  TOPO_PROFILE,
  depthToColor,
  magToRadius,
} from './geologicalData.ts';

// ── Layout ──────────────────────────────────────────────────────

export const MARGIN = { top: 28, right: 64, bottom: 30, left: 52 };
export const TOPO_HEIGHT = 18;
const HIST_WIDTH = 32;

const DEG_TO_RAD = Math.PI / 180;
const KM_PER_DEG = 111.32;

// ── Slice Projection ─────────────────────────────────────────────
// Projects (lat, lng) onto a bearing-defined slice through map center.

export interface SliceState {
  centerLat: number;
  centerLng: number;
  bearing: number;
  sliceAzRad: number; // (bearing + 90) in radians — horizontal screen direction
  sinAz: number;
  cosAz: number;
  cosLat: number;
}

export function createSlice(centerLat: number, centerLng: number, bearing: number): SliceState {
  const azDeg = bearing + 90;
  const azRad = azDeg * DEG_TO_RAD;
  return {
    centerLat,
    centerLng,
    bearing,
    sliceAzRad: azRad,
    sinAz: Math.sin(azRad),
    cosAz: Math.cos(azRad),
    cosLat: Math.cos(centerLat * DEG_TO_RAD),
  };
}

export function projectToSlice(lat: number, lng: number, s: SliceState): { along: number; perp: number } {
  const dx = (lng - s.centerLng) * s.cosLat * KM_PER_DEG;
  const dy = (lat - s.centerLat) * KM_PER_DEG;
  return {
    along: dx * s.sinAz + dy * s.cosAz,
    perp: -dx * s.cosAz + dy * s.sinAz,
  };
}

// ── Coordinate transforms ───────────────────────────────────────

export interface Transform {
  plotW: number;
  plotH: number;
  distMin: number; // km (left edge of slice)
  distMax: number; // km (right edge of slice)
  bearing: number;
  slice: SliceState;
  posToX(lat: number, lng: number): number;
  distToX(km: number): number;
  depthToY(depth: number): number;
  xToDist(x: number): number;
  yToDepth(y: number): number;
}

function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1;
  return window.devicePixelRatio || 1;
}

export function buildTransform(
  canvasW: number,
  canvasH: number,
  slice: SliceState,
  distMin: number,
  distMax: number,
): Transform {
  const dpr = getDevicePixelRatio();
  const plotW = Math.max(1, canvasW / dpr - MARGIN.left - MARGIN.right);
  const plotH = Math.max(1, canvasH / dpr - MARGIN.top - MARGIN.bottom);
  const distRange = distMax - distMin;

  return {
    plotW,
    plotH,
    distMin,
    distMax,
    bearing: slice.bearing,
    slice,
    posToX(lat: number, lng: number) {
      const p = projectToSlice(lat, lng, slice);
      return MARGIN.left + ((p.along - distMin) / distRange) * plotW;
    },
    distToX(km: number) {
      return MARGIN.left + ((km - distMin) / distRange) * plotW;
    },
    depthToY(depth: number) {
      return MARGIN.top + (depth / MAX_DEPTH_KM) * plotH;
    },
    xToDist(x: number) {
      return distMin + ((x - MARGIN.left) / plotW) * distRange;
    },
    yToDepth(y: number) {
      return ((y - MARGIN.top) / plotH) * MAX_DEPTH_KM;
    },
  };
}

// Compute the slice distance range from events and viewport
export function computeSliceExtent(
  events: EarthquakeEvent[],
  slice: SliceState,
): { distMin: number; distMax: number } {
  // Use Japan extent as default range
  const corners = [
    { lat: 30, lng: 126 }, { lat: 30, lng: 148 },
    { lat: 46, lng: 126 }, { lat: 46, lng: 148 },
  ];

  let min = Infinity;
  let max = -Infinity;

  for (const c of corners) {
    const p = projectToSlice(c.lat, c.lng, slice);
    if (p.along < min) min = p.along;
    if (p.along > max) max = p.along;
  }

  // Also consider events
  for (const ev of events) {
    const p = projectToSlice(ev.lat, ev.lng, slice);
    if (p.along < min) min = p.along;
    if (p.along > max) max = p.along;
  }

  // Add 5% padding
  const range = max - min;
  return { distMin: min - range * 0.05, distMax: max + range * 0.05 };
}

// ── Render functions ────────────────────────────────────────────

const FONT_MONO = '"IBM Plex Mono", "SF Mono", "Fira Code", monospace';

// ── Plate boundary surface markers on cross-section ────────────
// Shows where each plate boundary intersects the current slice
// as a vertical tick + label at depth=0 (surface/trench).
// Color-coded to match the slab contours they connect to.

function drawPlateBoundaries(
  ctx: CanvasRenderingContext2D,
  xf: Transform,
  faults: ActiveFault[],
): void {
  const interfaces = faults.filter(f => f.faultType === 'interface');
  if (interfaces.length === 0) return;

  const surfaceY = xf.depthToY(0);
  const tickBottom = xf.depthToY(Math.min(50, MAX_DEPTH_KM * 0.07));

  // Track used X ranges to prevent label overlap
  const usedLabelRanges: Array<{ x1: number; x2: number }> = [];
  const LABEL_HALF_WIDTH = 26; // half-width reserved per label (px)

  function labelFits(x: number): boolean {
    for (const r of usedLabelRanges) {
      if (x + LABEL_HALF_WIDTH > r.x1 && x - LABEL_HALF_WIDTH < r.x2) return false;
    }
    return true;
  }

  for (const fault of interfaces) {
    const style = BOUNDARY_STYLE[fault.id] || { color: 'rgba(200,180,160,0.5)', group: '' };

    // Project all segment points, keep only those in view
    const xPositions: number[] = [];
    for (const seg of fault.segments) {
      const x = xf.posToX(seg[1], seg[0]); // [lng, lat] -> posToX(lat, lng)
      if (x >= MARGIN.left && x <= MARGIN.left + xf.plotW) {
        xPositions.push(x);
      }
    }
    if (xPositions.length === 0) continue;

    const xMin = Math.min(...xPositions);
    const xMax = Math.max(...xPositions);

    // Horizontal line at surface spanning the boundary's extent
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(xMin, surfaceY);
    ctx.lineTo(xMax, surfaceY);
    ctx.stroke();

    // Vertical ticks at endpoints
    ctx.lineWidth = 1;
    for (const x of [xMin, xMax]) {
      ctx.beginPath();
      ctx.moveTo(x, surfaceY);
      ctx.lineTo(x, tickBottom);
      ctx.stroke();
    }

    // Downward-pointing triangle at midpoint
    const xMid = (xMin + xMax) / 2;
    ctx.fillStyle = style.color;
    ctx.beginPath();
    ctx.moveTo(xMid - 4, surfaceY - 1);
    ctx.lineTo(xMid + 4, surfaceY - 1);
    ctx.lineTo(xMid, surfaceY + 5);
    ctx.closePath();
    ctx.fill();

    // Label above — use English short name, skip if it would overlap a prior label
    if (labelFits(xMid)) {
      // Derive a compact English short name from nameEn (first word or two)
      const words = fault.nameEn.split(/[\s-]/);
      const shortName = words[0].length > 7
        ? words[0].slice(0, 7)
        : words.slice(0, 2).join('-');

      ctx.fillStyle = style.color;
      ctx.font = `bold 8px ${FONT_MONO}`;
      ctx.textAlign = 'center';
      ctx.fillText(shortName, xMid, surfaceY - 5);
      usedLabelRanges.push({ x1: xMid - LABEL_HALF_WIDTH, x2: xMid + LABEL_HALF_WIDTH });
    }
  }
}

export function drawCrossSection(
  ctx: CanvasRenderingContext2D,
  events: EarthquakeEvent[],
  faults: ActiveFault[],
  selectedId: string | null,
  hoveredId: string | null,
  xf: Transform,
  dpr: number,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.save();
  ctx.scale(dpr, dpr);

  const cssW = w / dpr;
  const cssH = h / dpr;

  // 1. Background
  ctx.fillStyle = '#060810';
  ctx.fillRect(0, 0, cssW, cssH);

  const bgGrad = ctx.createLinearGradient(MARGIN.left, MARGIN.top, MARGIN.left, MARGIN.top + xf.plotH);
  bgGrad.addColorStop(0, '#0d1220');
  bgGrad.addColorStop(0.3, '#0a0f1a');
  bgGrad.addColorStop(1, '#070a12');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(MARGIN.left, MARGIN.top, xf.plotW, xf.plotH);

  // 2. Minor grid (distance-based)
  drawMinorGrid(ctx, xf);

  // 3. Major grid
  drawMajorGrid(ctx, xf);

  // 4. Geological depth references
  drawDepthReferences(ctx, xf);

  // 5. Topography/bathymetry profile along surface
  drawTopography(ctx, xf);

  // 6. Surface line
  drawSurfaceLine(ctx, xf);

  // 7. Slab2 subduction contours
  drawSlabContour(ctx, xf, PACIFIC_SLAB, 'rgba(80,180,255,0.5)', t('depth.pacificPlate'), [6, 4]);
  drawSlabContour(ctx, xf, PHILIPPINE_SLAB, 'rgba(255,170,80,0.4)', t('depth.philippineSea'), [5, 3]);

  // 7b. Plate boundary surface locations
  drawPlateBoundaries(ctx, xf, faults);

  // 8. Earthquake hypocenters
  const sorted = [...events].sort((a, b) => a.magnitude - b.magnitude);
  for (const ev of sorted) {
    if (ev.id === selectedId || ev.id === hoveredId) continue;
    drawEvent(ctx, ev, xf);
  }

  // 9. Hovered event
  const hovered = hoveredId ? events.find((e) => e.id === hoveredId) : null;
  if (hovered) drawEvent(ctx, hovered, xf, true);

  // 10. Selected event
  const selected = selectedId ? events.find((e) => e.id === selectedId) : null;
  if (selected) drawEventSelected(ctx, selected, xf);

  // 11. Plot frame
  ctx.strokeStyle = 'rgba(80,120,180,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(MARGIN.left, MARGIN.top, xf.plotW, xf.plotH);

  // Vignette
  const vigGrad = ctx.createRadialGradient(
    MARGIN.left + xf.plotW / 2, MARGIN.top + xf.plotH / 2, xf.plotW * 0.25,
    MARGIN.left + xf.plotW / 2, MARGIN.top + xf.plotH / 2, xf.plotW * 0.7,
  );
  vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vigGrad.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = vigGrad;
  ctx.fillRect(MARGIN.left, MARGIN.top, xf.plotW, xf.plotH);

  // 12. Axes
  drawAxes(ctx, xf, cssW, cssH);

  // 13. Depth histogram
  drawDepthHistogram(ctx, events, xf);

  // 14. Depth color legend
  drawDepthLegend(ctx, xf);

  // [magnitude legend and bearing indicator removed — tooltip covers M, axis covers bearing]

  ctx.restore();
}

// ── Distance grid helpers ─────────────────────────────────────────

function getGridStep(range: number): { minor: number; major: number } {
  if (range < 200) return { minor: 10, major: 50 };
  if (range < 600) return { minor: 25, major: 100 };
  if (range < 1500) return { minor: 50, major: 200 };
  if (range < 4000) return { minor: 100, major: 500 };
  return { minor: 200, major: 1000 };
}

// ── Minor grid ──────────────────────────────────────────────────

function drawMinorGrid(ctx: CanvasRenderingContext2D, xf: Transform): void {
  ctx.strokeStyle = 'rgba(50,60,80,0.05)';
  ctx.lineWidth = 0.5;

  const range = xf.distMax - xf.distMin;
  const { minor } = getGridStep(range);
  const start = Math.ceil(xf.distMin / minor) * minor;
  for (let d = start; d <= xf.distMax; d += minor) {
    const x = xf.distToX(d);
    ctx.beginPath();
    ctx.moveTo(x, MARGIN.top);
    ctx.lineTo(x, MARGIN.top + xf.plotH);
    ctx.stroke();
  }

  for (let d = 50; d < MAX_DEPTH_KM; d += 50) {
    if (d % 100 === 0) continue;
    const y = xf.depthToY(d);
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, y);
    ctx.lineTo(MARGIN.left + xf.plotW, y);
    ctx.stroke();
  }
}

// ── Major grid ──────────────────────────────────────────────────

function drawMajorGrid(ctx: CanvasRenderingContext2D, xf: Transform): void {
  ctx.strokeStyle = 'rgba(70,85,120,0.10)';
  ctx.lineWidth = 0.5;

  const range = xf.distMax - xf.distMin;
  const { major } = getGridStep(range);
  const start = Math.ceil(xf.distMin / major) * major;
  for (let d = start; d <= xf.distMax; d += major) {
    const x = xf.distToX(d);
    ctx.beginPath();
    ctx.moveTo(x, MARGIN.top);
    ctx.lineTo(x, MARGIN.top + xf.plotH);
    ctx.stroke();
  }

  for (let d = 100; d < MAX_DEPTH_KM; d += 100) {
    const y = xf.depthToY(d);
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, y);
    ctx.lineTo(MARGIN.left + xf.plotW, y);
    ctx.stroke();
  }
}

// ── Topography / Bathymetry Profile ─────────────────────────────

function drawTopography(ctx: CanvasRenderingContext2D, xf: Transform): void {
  const seaY = MARGIN.top;
  const maxElev = 3000;
  const minElev = -8000;

  function elevToY(elev: number): number {
    const normalized = (elev - minElev) / (maxElev - minElev);
    return MARGIN.top - 2 - normalized * TOPO_HEIGHT;
  }

  // Project topo points and sort by X
  const projected = TOPO_PROFILE.map((pt) => ({
    x: xf.posToX(pt.lat, pt.lng),
    elev: pt.elev,
  })).sort((a, b) => a.x - b.x);

  // Ocean fill
  ctx.beginPath();
  ctx.moveTo(projected[0].x, seaY - 2);
  for (const pt of projected) {
    const y = pt.elev < 0 ? elevToY(pt.elev) : seaY - 2;
    ctx.lineTo(pt.x, y);
  }
  ctx.lineTo(projected[projected.length - 1].x, seaY - 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(25,60,120,0.55)';
  ctx.fill();

  // Land fill
  ctx.beginPath();
  let landStarted = false;
  for (const pt of projected) {
    if (pt.elev > 0) {
      const y = elevToY(pt.elev);
      if (!landStarted) {
        ctx.moveTo(pt.x, seaY - 2);
        landStarted = true;
      }
      ctx.lineTo(pt.x, y);
    } else if (landStarted) {
      ctx.lineTo(pt.x, seaY - 2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(50,110,60,0.6)';
      ctx.fill();
      ctx.beginPath();
      landStarted = false;
    }
  }
  if (landStarted) {
    ctx.lineTo(projected[projected.length - 1].x, seaY - 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(50,110,60,0.6)';
    ctx.fill();
  }

  // Topo outline
  ctx.strokeStyle = 'rgba(140,180,220,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < projected.length; i++) {
    const pt = projected[i];
    const y = elevToY(projected[i].elev);
    if (i === 0) ctx.moveTo(pt.x, y);
    else ctx.lineTo(pt.x, y);
  }
  ctx.stroke();

  // Sea level line
  const slY = elevToY(0);
  ctx.strokeStyle = 'rgba(100,140,200,0.35)';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, slY);
  ctx.lineTo(MARGIN.left + xf.plotW, slY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(140,180,220,0.45)';
  ctx.font = `6px ${FONT_MONO}`;
  ctx.textAlign = 'right';
  ctx.fillText('TOPO', MARGIN.left - 4, MARGIN.top - TOPO_HEIGHT / 2 + 2);
}

// ── Surface line ────────────────────────────────────────────────

function drawSurfaceLine(ctx: CanvasRenderingContext2D, xf: Transform): void {
  const y = xf.depthToY(0);
  ctx.strokeStyle = 'rgba(160,190,255,0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(MARGIN.left, y);
  ctx.lineTo(MARGIN.left + xf.plotW, y);
  ctx.stroke();
}

// ── Geological depth references ─────────────────────────────────

function drawDepthReferences(ctx: CanvasRenderingContext2D, xf: Transform): void {
  for (const ref of DEPTH_REFS) {
    const y = xf.depthToY(ref.depth);
    ctx.strokeStyle = 'rgba(120,160,220,0.10)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, y);
    ctx.lineTo(MARGIN.left + xf.plotW, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Right-align at left margin — cleaner, doesn't float over data
    const shortLabel = DEPTH_REF_LABELS[ref.label] ?? ref.label;
    ctx.fillStyle = 'rgba(120,160,220,0.28)';
    ctx.font = `8px ${FONT_MONO}`;
    ctx.textAlign = 'right';
    ctx.fillText(shortLabel, MARGIN.left - 10, y + 3);
  }
}

// ── Slab contour rendering ──────────────────────────────────────

function drawSlabContour(
  ctx: CanvasRenderingContext2D,
  xf: Transform,
  slab: typeof PACIFIC_SLAB,
  color: string,
  label: string,
  dash: number[],
): void {
  if (slab.length < 2) return;

  // Project and sort by X
  const projected = slab.map((pt) => ({
    x: xf.posToX(pt.lat, pt.lng),
    y: xf.depthToY(pt.depth),
    depth: pt.depth,
  })).sort((a, b) => a.x - b.x);

  // Main contour line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dash);
  ctx.beginPath();
  let started = false;
  for (const pt of projected) {
    if (pt.x < MARGIN.left || pt.x > MARGIN.left + xf.plotW) continue;
    if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
    else ctx.lineTo(pt.x, pt.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Glow
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.setLineDash(dash);
  ctx.beginPath();
  started = false;
  for (const pt of projected) {
    if (pt.x < MARGIN.left || pt.x > MARGIN.left + xf.plotW) continue;
    if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
    else ctx.lineTo(pt.x, pt.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Slab name label — place at deepest visible point with a pill background
  const visiblePts = projected.filter(
    pt => pt.x >= MARGIN.left + 4 && pt.x <= MARGIN.left + xf.plotW - 4
  );
  if (visiblePts.length > 0) {
    // Deepest visible point
    const lp = visiblePts.reduce((a, b) => (b.depth > a.depth ? b : a));
    const FONT_SIZE = 9;
    ctx.font = `bold ${FONT_SIZE}px ${FONT_MONO}`;
    const metrics = ctx.measureText(label);
    const pw = metrics.width + 8;
    const ph = FONT_SIZE + 5;
    const lx = Math.min(lp.x, MARGIN.left + xf.plotW - pw / 2 - 4);
    const ly = Math.max(MARGIN.top + ph, lp.y - 10);

    // Pill background
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#070a14';
    ctx.beginPath();
    ctx.roundRect(lx - pw / 2, ly - ph + 2, pw, ph, 3);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = color;
    ctx.font = `bold ${FONT_SIZE}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, lx, ly);
  }
}

// ── Individual event dot ────────────────────────────────────────

function drawEvent(
  ctx: CanvasRenderingContext2D,
  ev: EarthquakeEvent,
  xf: Transform,
  isHovered: boolean = false,
): void {
  const x = xf.posToX(ev.lat, ev.lng);
  const y = xf.depthToY(ev.depth_km);
  if (x < MARGIN.left || x > MARGIN.left + xf.plotW) return;
  if (y < MARGIN.top || y > MARGIN.top + xf.plotH) return;

  const r = magToRadius(ev.magnitude);
  const c = depthToColor(ev.depth_km);

  if (isHovered) {
    ctx.shadowColor = `rgba(${c.r},${c.g},${c.b},0.8)`;
    ctx.shadowBlur = 14;
  }

  // Glow halo — reduced radius for tighter visual hierarchy
  const haloGrad = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.5);
  haloGrad.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0.22)`);
  haloGrad.addColorStop(0.5, `rgba(${c.r},${c.g},${c.b},0.07)`);
  haloGrad.addColorStop(1, `rgba(${c.r},${c.g},${c.b},0)`);
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.85)`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  if (isHovered) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ── Selected event highlight ────────────────────────────────────

function drawEventSelected(
  ctx: CanvasRenderingContext2D,
  ev: EarthquakeEvent,
  xf: Transform,
): void {
  const x = xf.posToX(ev.lat, ev.lng);
  const y = xf.depthToY(ev.depth_km);
  const r = magToRadius(ev.magnitude);

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x, MARGIN.top);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.shadowColor = 'rgba(200,225,255,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r + 5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, r + 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `bold 9px ${FONT_MONO}`;
  ctx.textAlign = 'left';
  const label = `M${ev.magnitude.toFixed(1)}  ${Math.round(ev.depth_km)}km`;
  const labelX = x + r + 12;
  if (labelX + 80 > MARGIN.left + xf.plotW) {
    ctx.textAlign = 'right';
    ctx.fillText(label, x - r - 12, y + 3);
  } else {
    ctx.fillText(label, labelX, y + 3);
  }
}

// ── Axes ────────────────────────────────────────────────────────

function formatDistLabel(km: number, xf: Transform): string {
  const b = ((xf.bearing % 360) + 360) % 360;
  // Near E-W slice: show longitude
  if (b < 15 || b > 345 || (b > 165 && b < 195)) {
    const lng = xf.slice.centerLng + km / (xf.slice.cosLat * KM_PER_DEG);
    return `${lng.toFixed(0)}\u00B0E`;
  }
  // Near N-S slice: show latitude
  if ((b > 75 && b < 105) || (b > 255 && b < 285)) {
    const lat = xf.slice.centerLat + km / KM_PER_DEG;
    return `${lat.toFixed(0)}\u00B0N`;
  }
  // Oblique: show km
  return `${km >= 0 ? '+' : ''}${km.toFixed(0)}km`;
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  xf: Transform,
  _cssW: number,
  cssH: number,
): void {
  // Y axis: depth tick labels
  ctx.fillStyle = 'rgba(150,170,210,0.6)';
  ctx.font = `11px ${FONT_MONO}`;
  ctx.textAlign = 'right';

  const depthTicks = [0, 100, 200, 300, 400, 500, 600, 700];
  for (const d of depthTicks) {
    if (d > MAX_DEPTH_KM) break;
    const y = xf.depthToY(d);
    ctx.fillText(`${d}`, MARGIN.left - 8, y + 3.5);
    ctx.strokeStyle = 'rgba(150,170,210,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left - 3, y);
    ctx.lineTo(MARGIN.left, y);
    ctx.stroke();
  }

  // Y axis title
  ctx.save();
  ctx.translate(11, MARGIN.top + xf.plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = 'rgba(140,160,200,0.4)';
  ctx.font = `10px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('DEPTH (km)', 0, 0);
  ctx.restore();

  // X axis: distance tick labels
  ctx.fillStyle = 'rgba(150,170,210,0.55)';
  ctx.textAlign = 'center';
  ctx.font = `11px ${FONT_MONO}`;

  const range = xf.distMax - xf.distMin;
  const { major } = getGridStep(range);
  const start = Math.ceil(xf.distMin / major) * major;
  for (let km = start; km <= xf.distMax; km += major) {
    const x = xf.distToX(km);
    ctx.fillText(formatDistLabel(km, xf), x, MARGIN.top + xf.plotH + 16);
    ctx.strokeStyle = 'rgba(150,170,210,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, MARGIN.top + xf.plotH);
    ctx.lineTo(x, MARGIN.top + xf.plotH + 3);
    ctx.stroke();
  }

  // X axis title
  ctx.fillStyle = 'rgba(140,160,200,0.4)';
  ctx.font = `10px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  const b = ((xf.bearing % 360) + 360) % 360;
  const axisLabel = (b < 15 || b > 345 || (b > 165 && b < 195))
    ? 'LONGITUDE'
    : (b > 75 && b < 105) || (b > 255 && b < 285)
      ? 'LATITUDE'
      : 'DISTANCE (km)';
  ctx.fillText(axisLabel, MARGIN.left + xf.plotW / 2, cssH - 2);
}

// ── Depth Histogram ──────────────────────────────────────────────

function drawDepthHistogram(
  ctx: CanvasRenderingContext2D,
  events: EarthquakeEvent[],
  xf: Transform,
): void {
  const BIN_SIZE = 25;
  const bins = new Array(Math.ceil(MAX_DEPTH_KM / BIN_SIZE)).fill(0);

  for (const ev of events) {
    const bin = Math.min(bins.length - 1, Math.floor(ev.depth_km / BIN_SIZE));
    if (bin >= 0) bins[bin]++;
  }

  const maxCount = Math.max(1, ...bins);
  const histX = MARGIN.left + xf.plotW + 4;

  for (let i = 0; i < bins.length; i++) {
    if (bins[i] === 0) continue;
    const depthMid = (i + 0.5) * BIN_SIZE;
    const y = xf.depthToY(i * BIN_SIZE);
    const h = xf.depthToY((i + 1) * BIN_SIZE) - y;
    const barW = (bins[i] / maxCount) * HIST_WIDTH;

    const c = depthToColor(depthMid);
    ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.65)`;
    ctx.fillRect(histX, y, barW, Math.max(1, h - 1));
    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.35)`;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(histX, y, barW, Math.max(1, h - 1));
  }

  ctx.fillStyle = 'rgba(140,160,200,0.45)';
  ctx.font = `7px ${FONT_MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('N', histX + HIST_WIDTH / 2, MARGIN.top - 3);
}

// ── Depth color legend ──────────────────────────────────────────

function drawDepthLegend(ctx: CanvasRenderingContext2D, xf: Transform): void {
  // Tighter gap between histogram and color bar
  const barX = MARGIN.left + xf.plotW + HIST_WIDTH + 5;
  const barW = 7;
  const yTop = MARGIN.top;
  const barH = xf.plotH;

  const grad = ctx.createLinearGradient(barX, yTop, barX, yTop + barH);
  for (const stop of DEPTH_RAMP) {
    const pct = stop.depth / MAX_DEPTH_KM;
    grad.addColorStop(Math.min(1, pct), `rgb(${stop.r},${stop.g},${stop.b})`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(barX, yTop, barW, barH);

  ctx.strokeStyle = 'rgba(80,100,140,0.25)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(barX, yTop, barW, barH);

  ctx.fillStyle = 'rgba(140,160,200,0.45)';
  ctx.font = `8px ${FONT_MONO}`;
  ctx.textAlign = 'left';
  for (const d of [0, 100, 300, 500, 700]) {
    const y = yTop + (d / MAX_DEPTH_KM) * barH;
    ctx.fillText(`${d}`, barX + barW + 2, y + 3);
  }
}

// ── Hit testing ─────────────────────────────────────────────────

export function findEventAtPoint(
  events: EarthquakeEvent[],
  canvasX: number,
  canvasY: number,
  xf: Transform,
): EarthquakeEvent | null {
  const sorted = [...events].sort((a, b) => b.magnitude - a.magnitude);
  for (const ev of sorted) {
    const x = xf.posToX(ev.lat, ev.lng);
    const y = xf.depthToY(ev.depth_km);
    const r = magToRadius(ev.magnitude) + 4;
    const dx = canvasX - x;
    const dy = canvasY - y;
    if (dx * dx + dy * dy <= r * r) return ev;
  }
  return null;
}
