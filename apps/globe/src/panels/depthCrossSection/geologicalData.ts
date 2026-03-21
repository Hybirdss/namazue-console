export const MAX_DEPTH_KM = 700;

// ── GMT "seis" Colormap (Suzan van der Lee) ─────────────────────

export interface ColorStop { depth: number; r: number; g: number; b: number }

export const DEPTH_RAMP: ColorStop[] = [
  { depth: 0,   r: 230, g: 50,  b: 50 },
  { depth: 25,  r: 255, g: 60,  b: 30 },
  { depth: 50,  r: 255, g: 120, b: 0 },
  { depth: 80,  r: 255, g: 190, b: 0 },
  { depth: 120, r: 255, g: 255, b: 30 },
  { depth: 180, r: 120, g: 255, b: 60 },
  { depth: 260, r: 30,  g: 240, b: 140 },
  { depth: 380, r: 30,  g: 210, b: 255 },
  { depth: 500, r: 60,  g: 120, b: 255 },
  { depth: 700, r: 80,  g: 60,  b: 240 },
];

export function depthToColor(depth_km: number): { r: number; g: number; b: number } {
  if (depth_km <= 0) return DEPTH_RAMP[0];
  for (let i = 1; i < DEPTH_RAMP.length; i++) {
    if (depth_km <= DEPTH_RAMP[i].depth) {
      const prev = DEPTH_RAMP[i - 1];
      const curr = DEPTH_RAMP[i];
      const frac = (depth_km - prev.depth) / (curr.depth - prev.depth);
      return {
        r: Math.round(prev.r + frac * (curr.r - prev.r)),
        g: Math.round(prev.g + frac * (curr.g - prev.g)),
        b: Math.round(prev.b + frac * (curr.b - prev.b)),
      };
    }
  }
  return DEPTH_RAMP[DEPTH_RAMP.length - 1];
}

// ── Magnitude to pixel radius ───────────────────────────────────

const CROSS_SECTION_RADIUS_SCALE = 0.55;

export function magToRadius(mag: number): number {
  return Math.max(2.0, 1.1 * CROSS_SECTION_RADIUS_SCALE * Math.pow(10, 0.25 * (mag - 2)));
}

// ── Simplified Slab2 Contours (Japan) ───────────────────────────
// Each point has (lat, lng, depth) for proper projection onto any slice.

export interface SlabPoint { lat: number; lng: number; depth: number }

export const PACIFIC_SLAB: SlabPoint[] = [
  { lat: 39.0, lng: 145.0, depth: 10 },
  { lat: 39.0, lng: 144.2, depth: 25 },
  { lat: 39.0, lng: 143.5, depth: 40 },
  { lat: 38.8, lng: 142.8, depth: 60 },
  { lat: 38.6, lng: 142.0, depth: 80 },
  { lat: 38.4, lng: 141.2, depth: 110 },
  { lat: 38.2, lng: 140.5, depth: 150 },
  { lat: 37.8, lng: 139.8, depth: 200 },
  { lat: 37.5, lng: 139.0, depth: 280 },
  { lat: 37.2, lng: 138.2, depth: 370 },
  { lat: 37.0, lng: 137.5, depth: 450 },
  { lat: 36.8, lng: 136.8, depth: 530 },
  { lat: 36.5, lng: 136.0, depth: 600 },
  { lat: 36.3, lng: 135.5, depth: 660 },
];

export const PHILIPPINE_SLAB: SlabPoint[] = [
  { lat: 33.5, lng: 137.0, depth: 10 },
  { lat: 33.8, lng: 136.5, depth: 20 },
  { lat: 34.0, lng: 136.0, depth: 35 },
  { lat: 34.2, lng: 135.5, depth: 50 },
  { lat: 34.4, lng: 135.0, depth: 65 },
  { lat: 34.5, lng: 134.5, depth: 80 },
  { lat: 34.6, lng: 134.0, depth: 100 },
  { lat: 34.7, lng: 133.5, depth: 130 },
];

// ── Simplified Topography/Bathymetry Profile ────────────────────
// ETOPO1-based transect across NE Japan (~37°N)

export interface TopoPoint { lat: number; lng: number; elev: number }

export const TOPO_PROFILE: TopoPoint[] = [
  { lat: 37, lng: 126, elev: -100 },
  { lat: 37, lng: 127, elev: -80 },
  { lat: 37, lng: 128, elev: -50 },
  { lat: 37, lng: 129, elev: 50 },
  { lat: 37, lng: 130, elev: 200 },
  { lat: 37, lng: 131, elev: 100 },
  { lat: 37, lng: 132, elev: -20 },
  { lat: 37, lng: 133, elev: 300 },
  { lat: 37, lng: 134, elev: 600 },
  { lat: 37, lng: 135, elev: 400 },
  { lat: 37, lng: 136, elev: 1200 },
  { lat: 37, lng: 137, elev: 2500 },
  { lat: 37, lng: 138, elev: 2000 },
  { lat: 37, lng: 139, elev: 800 },
  { lat: 37, lng: 140, elev: 200 },
  { lat: 37, lng: 141, elev: 50 },
  { lat: 37, lng: 142, elev: -200 },
  { lat: 37, lng: 143, elev: -2000 },
  { lat: 37, lng: 144, elev: -5500 },
  { lat: 37, lng: 145, elev: -7500 },
  { lat: 37, lng: 146, elev: -5800 },
  { lat: 37, lng: 147, elev: -5200 },
  { lat: 37, lng: 148, elev: -5000 },
];

// ── Geological depth references ─────────────────────────────────

export const DEPTH_REFS: Array<{ depth: number; label: string; style: 'named' }> = [
  { depth: 35,  label: 'Moho ~35km',   style: 'named' },
  { depth: 410, label: '410km',         style: 'named' },
  { depth: 660, label: '660km',         style: 'named' },
];

// ── Plate boundary surface style map ────────────────────────────

export const BOUNDARY_STYLE: Record<string, { color: string; group: string }> = {
  'nankai-trough':        { color: 'rgba(255,170,80,0.8)',  group: 'PS' },
  'suruga-trough':        { color: 'rgba(255,170,80,0.8)',  group: 'PS' },
  'sagami-trough':        { color: 'rgba(255,170,80,0.8)',  group: 'PS' },
  'japan-trench-tohoku':  { color: 'rgba(80,180,255,0.8)',  group: 'PA' },
  'kuril-trench':         { color: 'rgba(80,180,255,0.8)',  group: 'PA' },
  'izu-bonin-trench':     { color: 'rgba(120,160,255,0.7)', group: 'PA' },
  'ryukyu-trench':        { color: 'rgba(255,140,100,0.7)', group: 'ON' },
  'japan-sea-eastern-margin': { color: 'rgba(140,210,130,0.7)', group: 'AM' },
  'kyushu-okinawa-junction':  { color: 'rgba(200,170,120,0.6)', group: 'AM' },
};

// Shortened depth reference labels for reduced clutter
export const DEPTH_REF_LABELS: Record<string, string> = {
  'Moho ~35km': 'Moho',
  '410km':      '410',
  '660km':      '660',
};
