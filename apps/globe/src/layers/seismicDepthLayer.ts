/**
 * Seismic Depth Layer — "Earth's Interior" volumetric 3D visualization.
 *
 * When the map is pitched (tilted), renders a dramatic cross-section:
 *   1. Depth atmosphere gradient (stacked translucent planes)
 *   2. Slab2 subduction geometry with triple-band glow + surface fill
 *   3. Vertical glowing pillar columns (surface → hypocenter) — 4-layer gradient
 *   4. 3-layer bloom hypocenters (outer glow → inner glow → bright core)
 *   5. Surface anchor shadows at z=0
 *   6. Geological depth reference planes (Moho, 410km, 660km)
 *
 * All sizes use pixel units for guaranteed visibility at any zoom.
 * Depth exaggeration: linear 400→800× (calibrated for zoom 4-6).
 *
 * Visual references:
 *   - Pescadores Fault bathymetry cross-section
 *   - GMT pscoupe → extended to 3D volumetric
 *   - IRIS IEB 3D viewer
 *   - tectoplot Wadati-Benioff zone visualization
 *
 * Depth color ramp: GMT "seis.cpt" (Suzan van der Lee)
 */

import { ScatterplotLayer, LineLayer, PathLayer, PolygonLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';

type RGBA = [number, number, number, number];

// ── Depth color ramp (GMT seis.cpt, 10 stops) ──────────────

const DEPTH_STOPS: Array<[number, RGBA]> = [
  [0,    [255, 60, 40, 245]],    // surface: vivid red
  [25,   [255, 90, 20, 240]],    // very shallow: red-orange
  [50,   [255, 140, 0, 235]],    // shallow: orange
  [80,   [255, 200, 0, 230]],    // upper crust: amber-gold
  [120,  [255, 255, 30, 225]],   // mid crust: yellow
  [180,  [120, 255, 60, 220]],   // upper mantle: green
  [260,  [30, 240, 160, 215]],   // transition: cyan-green
  [380,  [30, 210, 255, 210]],   // deep: cyan
  [500,  [80, 130, 255, 205]],   // very deep: blue
  [700,  [120, 60, 255, 195]],   // ultra deep: purple
];

function lerpColor(a: RGBA, b: RGBA, t: number): RGBA {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

function depthToColor(depth_km: number): RGBA {
  for (let i = 0; i < DEPTH_STOPS.length - 1; i++) {
    const [d0, c0] = DEPTH_STOPS[i];
    const [d1, c1] = DEPTH_STOPS[i + 1];
    if (depth_km <= d1) {
      const t = Math.max(0, (depth_km - d0) / (d1 - d0));
      return lerpColor(c0, c1, t);
    }
  }
  return DEPTH_STOPS[DEPTH_STOPS.length - 1][1];
}

// ── Magnitude → pixel radius ────────────────────────────────
// Pixel-based: always visible at any zoom level.

function magToPixels(mag: number): number {
  return Math.max(3, 2.5 * Math.pow(10, 0.22 * (mag - 3)));
}

// ── Depth exaggeration ──────────────────────────────────────
//
// Linear 400→800× over pitch 15°-80°.
// Calibrated for Japan at zoom 4-6: 100km depth → 40-80km visual drop.

function depthToAlt(depth_km: number, pitch: number): number {
  const pitchNorm = Math.max(0, pitch - 15) / 65; // 0..1 over 15°-80°
  const exag = 400 + 400 * pitchNorm; // linear: 400→800×
  return -depth_km * exag;
}

// ── Pillar data ─────────────────────────────────────────────

interface PillarDatum {
  source: [number, number, number];
  target: [number, number, number];
  event: EarthquakeEvent;
}

function buildPillars(events: EarthquakeEvent[], pitch: number): PillarDatum[] {
  return events.map((e) => ({
    source: [e.lng, e.lat, 0],
    target: [e.lng, e.lat, depthToAlt(e.depth_km, pitch)],
    event: e,
  }));
}

// ── Slab2 Subduction Geometry ───────────────────────────────
//
// Simplified Slab2 contours (Hayes 2018) for the Pacific Plate and
// Philippine Sea Plate subduction zones beneath Japan.
//
// Data simplified from: USGS Slab2 model (doi:10.1126/science.aat4723)

interface SlabProfile {
  lat: number;
  points: Array<[lng: number, depth_km: number]>;
}

const PACIFIC_SLAB: SlabProfile[] = [
  { lat: 43, points: [
    [146.5, 10], [146.0, 20], [145.2, 40], [144.5, 60], [143.8, 90],
    [143.0, 130], [142.2, 180], [141.5, 240], [141.0, 300],
  ]},
  { lat: 41, points: [
    [145.5, 10], [145.0, 20], [144.2, 40], [143.5, 60], [142.8, 90],
    [142.0, 130], [141.2, 180], [140.5, 240], [139.8, 310], [139.2, 380],
  ]},
  { lat: 39, points: [
    [145.0, 10], [144.2, 25], [143.5, 40], [142.8, 60], [142.0, 80],
    [141.2, 110], [140.5, 150], [139.8, 200], [139.0, 280],
    [138.2, 370], [137.5, 450], [136.8, 530], [136.0, 600], [135.5, 660],
  ]},
  { lat: 36.5, points: [
    [143.0, 10], [142.2, 25], [141.5, 45], [140.8, 70], [140.0, 100],
    [139.3, 140], [138.5, 200], [137.8, 280], [137.0, 370],
  ]},
  { lat: 34.5, points: [
    [142.0, 10], [141.5, 30], [141.0, 50], [140.5, 80], [140.0, 120],
    [139.5, 170], [139.0, 230], [138.5, 300],
  ]},
];

const PHILIPPINE_SLAB: SlabProfile[] = [
  { lat: 34.5, points: [
    [137.5, 10], [137.0, 20], [136.5, 35], [136.0, 50], [135.5, 65],
    [135.0, 80], [134.5, 100], [134.0, 130],
  ]},
  { lat: 33.5, points: [
    [136.5, 10], [136.0, 20], [135.5, 35], [135.0, 50], [134.5, 65],
    [134.0, 80], [133.5, 100], [133.0, 120],
  ]},
  { lat: 32, points: [
    [133.5, 10], [133.0, 25], [132.5, 40], [132.0, 60], [131.5, 80],
    [131.0, 110], [130.5, 150],
  ]},
];

const PACIFIC_CONTOUR_DEPTHS = [40, 80, 150, 300, 500];
const PHILIPPINE_CONTOUR_DEPTHS = [30, 60, 100];

interface SlabPath {
  path: Array<[number, number, number]>;
  depth: number;
}

function buildSlabPaths(profiles: SlabProfile[], pitch: number): SlabPath[] {
  return profiles.map((p) => ({
    path: p.points.map(([lng, d]) => [lng, p.lat, depthToAlt(d, pitch)] as [number, number, number]),
    depth: p.points[p.points.length - 1][1],
  }));
}

function buildContours(
  profiles: SlabProfile[],
  depths: number[],
  pitch: number,
): SlabPath[] {
  const result: SlabPath[] = [];

  for (const target of depths) {
    const pts: Array<[number, number, number]> = [];

    for (const profile of profiles) {
      for (let i = 0; i < profile.points.length - 1; i++) {
        const [lng0, d0] = profile.points[i];
        const [lng1, d1] = profile.points[i + 1];
        if (target >= d0 && target <= d1) {
          const t = (target - d0) / (d1 - d0);
          pts.push([lng0 + t * (lng1 - lng0), profile.lat, depthToAlt(target, pitch)]);
          break;
        }
      }
    }

    if (pts.length >= 2) result.push({ path: pts, depth: target });
  }

  return result;
}

// ── Slab surface strip polygons ─────────────────────────────
// Connects adjacent profiles into filled strips for a solid slab surface.

interface SlabStrip {
  polygon: Array<[number, number, number]>;
}

function buildSlabStrips(profiles: SlabProfile[], pitch: number): SlabStrip[] {
  const strips: SlabStrip[] = [];

  for (let i = 0; i < profiles.length - 1; i++) {
    const a = profiles[i];
    const b = profiles[i + 1];

    // Forward points from profile A
    const fwd: Array<[number, number, number]> = a.points.map(
      ([lng, d]) => [lng, a.lat, depthToAlt(d, pitch)],
    );
    // Reversed points from profile B — closes the ring
    const rev: Array<[number, number, number]> = [...b.points]
      .reverse()
      .map(([lng, d]) => [lng, b.lat, depthToAlt(d, pitch)]);

    strips.push({ polygon: [...fwd, ...rev] });
  }

  return strips;
}

// ── Depth atmosphere planes ─────────────────────────────────
// Stacked semi-transparent polygons creating underwater fog effect.

interface AtmospherePlane {
  polygon: Array<[number, number, number]>;
  depth: number;
}

function buildAtmosphere(pitch: number): AtmospherePlane[] {
  const W = 126, E = 148, S = 28, N = 46;
  const depths = [50, 150, 300, 500, 700];

  return depths.map((d) => {
    const z = depthToAlt(d, pitch);
    return {
      polygon: [[W, S, z], [E, S, z], [E, N, z], [W, N, z]],
      depth: d,
    };
  });
}

// ── Geological reference planes ─────────────────────────────

interface RefPlane {
  polygon: Array<[number, number, number]>;
  label: string;
  depth: number;
}

function buildRefPlanes(pitch: number): RefPlane[] {
  const W = 126, E = 148, S = 28, N = 46;
  return [
    { depth: 35, label: 'Moho' },
    { depth: 410, label: '410km' },
    { depth: 660, label: '660km' },
  ].map(({ depth, label }) => {
    const z = depthToAlt(depth, pitch);
    return { polygon: [[W, S, z], [E, S, z], [E, N, z], [W, N, z]], label, depth };
  });
}

// ── Public API ───────────────────────────────────────────────

export function createSeismicDepthLayers(
  events: EarthquakeEvent[],
  selectedId: string | null,
  zoom: number,
  pitch: number,
): Layer[] {
  if (pitch < 15 || zoom < 3) return [];

  const pitchFade = Math.min(1, (pitch - 15) / 20); // 0..1 over 15°-35°
  const layers: Layer[] = [];

  // ── 1. Depth atmosphere ───────────────────────────────────
  // Dark navy fog planes increasing with depth — more dramatic gradient
  if (pitch > 25) {
    const atmFade = Math.min(1, (pitch - 25) / 30);
    const planes = buildAtmosphere(pitch);

    // Color anchors indexed by depths array position: [50, 150, 300, 500, 700]
    const ATM_COLORS: RGBA[] = [
      [6, 12, 30, 0],   // 50km  — dark navy
      [4, 8, 25, 0],    // 150km
      [3, 6, 20, 0],    // 300km
      [2, 4, 16, 0],    // 500km
      [1, 2, 12, 0],    // 700km — near-black abyss
    ];
    const ATM_DEPTHS = [50, 150, 300, 500, 700];

    layers.push(new PolygonLayer<AtmospherePlane>({
      id: 'depth-atmosphere',
      data: planes,
      pickable: false,
      stroked: false,
      filled: true,
      extruded: false,
      getPolygon: (d) => d.polygon,
      getFillColor: (d) => {
        const idx = ATM_DEPTHS.indexOf(d.depth);
        const base = idx >= 0 ? ATM_COLORS[idx] : ATM_COLORS[ATM_COLORS.length - 1];
        const t = d.depth / 700;
        return [base[0], base[1], base[2], Math.round((4 + t * 12) * atmFade)];
      },
      updateTriggers: { getFillColor: [pitch], getPolygon: [pitch] },
    }));
  }

  // ── 2. Geological reference planes ────────────────────────
  if (pitch > 30) {
    const refFade = Math.min(1, (pitch - 30) / 25);
    const refs = buildRefPlanes(pitch);

    layers.push(new PolygonLayer<RefPlane>({
      id: 'depth-ref-planes',
      data: refs,
      pickable: false,
      stroked: true,
      filled: true,
      extruded: false,
      getPolygon: (d) => d.polygon,
      getFillColor: (d) => {
        if (d.depth <= 50) return [140, 110, 50, Math.round(6 * refFade)];
        return [50, 70, 140, Math.round(5 * refFade)];
      },
      getLineColor: (d) => {
        if (d.depth <= 50) return [200, 160, 80, Math.round(35 * refFade)];
        return [80, 120, 220, Math.round(25 * refFade)];
      },
      getLineWidth: 1,
      lineWidthUnits: 'pixels' as const,
      updateTriggers: {
        getFillColor: [pitch], getLineColor: [pitch], getPolygon: [pitch],
      },
    }));
  }

  // ── 3. Slab subduction — triple-band glow + surface fill ──
  // Outer glow (wide, dim) + mid glow + core (thin, bright) + filled strips
  if (pitch > 20) {
    const slabFade = Math.min(1, (pitch - 20) / 20);

    const pacificProfiles = buildSlabPaths(PACIFIC_SLAB, pitch);
    const pacificContours = buildContours(PACIFIC_SLAB, PACIFIC_CONTOUR_DEPTHS, pitch);
    const philippineProfiles = buildSlabPaths(PHILIPPINE_SLAB, pitch);
    const philippineContours = buildContours(PHILIPPINE_SLAB, PHILIPPINE_CONTOUR_DEPTHS, pitch);

    const allPacific = [...pacificProfiles, ...pacificContours];
    const allPhilippine = [...philippineProfiles, ...philippineContours];

    // Pacific — outer glow
    layers.push(new PathLayer<SlabPath>({
      id: 'slab-pacific-glow-outer',
      data: allPacific,
      pickable: false,
      getPath: (d) => d.path,
      getColor: [60, 150, 255, Math.round(25 * slabFade)],
      getWidth: 10,
      widthUnits: 'pixels' as const,
      updateTriggers: { getPath: [pitch], getColor: [pitch] },
    }));

    // Pacific — mid glow
    layers.push(new PathLayer<SlabPath>({
      id: 'slab-pacific-glow-mid',
      data: allPacific,
      pickable: false,
      getPath: (d) => d.path,
      getColor: [80, 180, 255, Math.round(70 * slabFade)],
      getWidth: 4,
      widthUnits: 'pixels' as const,
      updateTriggers: { getPath: [pitch], getColor: [pitch] },
    }));

    // Pacific — core
    layers.push(new PathLayer<SlabPath>({
      id: 'slab-pacific-core',
      data: allPacific,
      pickable: false,
      getPath: (d) => d.path,
      getColor: [140, 210, 255, Math.round(160 * slabFade)],
      getWidth: 2,
      widthUnits: 'pixels' as const,
      updateTriggers: { getPath: [pitch], getColor: [pitch] },
    }));

    // Pacific — slab surface fill (strips between adjacent profiles)
    layers.push(new PolygonLayer<SlabStrip>({
      id: 'slab-pacific-surface',
      data: buildSlabStrips(PACIFIC_SLAB, pitch),
      pickable: false,
      stroked: false,
      filled: true,
      extruded: false,
      getPolygon: (d) => d.polygon,
      getFillColor: [40, 120, 200, Math.round(12 * slabFade)],
      updateTriggers: { getPolygon: [pitch], getFillColor: [pitch] },
    }));

    // Philippine — outer glow
    layers.push(new PathLayer<SlabPath>({
      id: 'slab-philippine-glow-outer',
      data: allPhilippine,
      pickable: false,
      getPath: (d) => d.path,
      getColor: [255, 150, 50, Math.round(25 * slabFade)],
      getWidth: 10,
      widthUnits: 'pixels' as const,
      updateTriggers: { getPath: [pitch], getColor: [pitch] },
    }));

    // Philippine — mid glow
    layers.push(new PathLayer<SlabPath>({
      id: 'slab-philippine-glow-mid',
      data: allPhilippine,
      pickable: false,
      getPath: (d) => d.path,
      getColor: [255, 190, 100, Math.round(70 * slabFade)],
      getWidth: 4,
      widthUnits: 'pixels' as const,
      updateTriggers: { getPath: [pitch], getColor: [pitch] },
    }));

    // Philippine — core
    layers.push(new PathLayer<SlabPath>({
      id: 'slab-philippine-core',
      data: allPhilippine,
      pickable: false,
      getPath: (d) => d.path,
      getColor: [255, 220, 140, Math.round(160 * slabFade)],
      getWidth: 2,
      widthUnits: 'pixels' as const,
      updateTriggers: { getPath: [pitch], getColor: [pitch] },
    }));

    // Philippine — slab surface fill
    layers.push(new PolygonLayer<SlabStrip>({
      id: 'slab-philippine-surface',
      data: buildSlabStrips(PHILIPPINE_SLAB, pitch),
      pickable: false,
      stroked: false,
      filled: true,
      extruded: false,
      getPolygon: (d) => d.polygon,
      getFillColor: [200, 130, 40, Math.round(12 * slabFade)],
      updateTriggers: { getPolygon: [pitch], getFillColor: [pitch] },
    }));
  }

  // ── 4. Pillar columns — 4-layer gradient ──────────────────
  // bloom → glow → mid → core, each layer using depth color × pitchFade
  const pillars = buildPillars(events, pitch);

  // Layer 1: outermost bloom (12px, 12α)
  layers.push(new LineLayer<PillarDatum>({
    id: 'depth-pillar-bloom',
    data: pillars,
    pickable: false,
    getSourcePosition: (d) => d.source,
    getTargetPosition: (d) => d.target,
    getColor: (d) => {
      const c = depthToColor(d.event.depth_km);
      return [c[0], c[1], c[2], Math.round(12 * pitchFade)] as RGBA;
    },
    getWidth: 12,
    widthUnits: 'pixels' as const,
    updateTriggers: {
      getColor: [events.length, pitch],
      getTargetPosition: [pitch],
    },
  }));

  // Layer 2: soft glow (7px, 30α)
  layers.push(new LineLayer<PillarDatum>({
    id: 'depth-pillar-glow',
    data: pillars,
    pickable: false,
    getSourcePosition: (d) => d.source,
    getTargetPosition: (d) => d.target,
    getColor: (d) => {
      const c = depthToColor(d.event.depth_km);
      return [c[0], c[1], c[2], Math.round(30 * pitchFade)] as RGBA;
    },
    getWidth: 7,
    widthUnits: 'pixels' as const,
    updateTriggers: {
      getColor: [events.length, pitch],
      getTargetPosition: [pitch],
    },
  }));

  // Layer 3: medium brightness (3px, 80α)
  layers.push(new LineLayer<PillarDatum>({
    id: 'depth-pillar-mid',
    data: pillars,
    pickable: false,
    getSourcePosition: (d) => d.source,
    getTargetPosition: (d) => d.target,
    getColor: (d) => {
      const c = depthToColor(d.event.depth_km);
      return [c[0], c[1], c[2], Math.round(80 * pitchFade)] as RGBA;
    },
    getWidth: 3,
    widthUnits: 'pixels' as const,
    updateTriggers: {
      getColor: [events.length, pitch],
      getTargetPosition: [pitch],
    },
  }));

  // Layer 4: bright center core (1.5px, 160α)
  layers.push(new LineLayer<PillarDatum>({
    id: 'depth-pillar-core',
    data: pillars,
    pickable: false,
    getSourcePosition: (d) => d.source,
    getTargetPosition: (d) => d.target,
    getColor: (d) => {
      const c = depthToColor(d.event.depth_km);
      return [c[0], c[1], c[2], Math.round(160 * pitchFade)] as RGBA;
    },
    getWidth: 1.5,
    widthUnits: 'pixels' as const,
    updateTriggers: {
      getColor: [events.length, pitch],
      getTargetPosition: [pitch],
    },
  }));

  // ── 5. Hypocenter bloom — 3 concentric layers ─────────────
  // Outer bloom (large, dim) → inner bloom (medium) → core (small, bright)

  // Outer bloom — increased scale 3.5 → 4.0
  layers.push(new ScatterplotLayer<EarthquakeEvent>({
    id: 'depth-hypo-bloom-outer',
    data: events,
    pickable: false,
    stroked: false,
    filled: true,
    radiusUnits: 'pixels' as const,
    getPosition: (d) => [d.lng, d.lat, depthToAlt(d.depth_km, pitch)],
    getRadius: (d) => magToPixels(d.magnitude) * 4.0,
    getFillColor: (d) => {
      const c = depthToColor(d.depth_km);
      return [c[0], c[1], c[2], Math.round(18 * pitchFade)] as RGBA;
    },
    updateTriggers: { getFillColor: [pitch], getPosition: [pitch] },
  }));

  // Inner bloom — increased scale 2.0 → 2.5
  layers.push(new ScatterplotLayer<EarthquakeEvent>({
    id: 'depth-hypo-bloom-inner',
    data: events,
    pickable: false,
    stroked: false,
    filled: true,
    radiusUnits: 'pixels' as const,
    getPosition: (d) => [d.lng, d.lat, depthToAlt(d.depth_km, pitch)],
    getRadius: (d) => magToPixels(d.magnitude) * 2.5,
    getFillColor: (d) => {
      const c = depthToColor(d.depth_km);
      return [c[0], c[1], c[2], Math.round(50 * pitchFade)] as RGBA;
    },
    updateTriggers: { getFillColor: [pitch], getPosition: [pitch] },
  }));

  // Core (pickable, bright)
  layers.push(new ScatterplotLayer<EarthquakeEvent>({
    id: 'depth-hypo-core',
    data: events,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 200],
    stroked: true,
    filled: true,
    radiusUnits: 'pixels' as const,
    getPosition: (d) => [d.lng, d.lat, depthToAlt(d.depth_km, pitch)],
    getRadius: (d) => magToPixels(d.magnitude),
    getFillColor: (d) => {
      if (d.id === selectedId) return [255, 255, 255, 255];
      const c = depthToColor(d.depth_km);
      return [c[0], c[1], c[2], Math.round(Math.min(255, 230 * pitchFade))] as RGBA;
    },
    getLineColor: (d) => {
      if (d.id === selectedId) return [255, 255, 255, 220];
      const c = depthToColor(d.depth_km);
      return [
        Math.min(255, c[0] + 60),
        Math.min(255, c[1] + 60),
        Math.min(255, c[2] + 60),
        Math.round(80 * pitchFade),
      ] as RGBA;
    },
    getLineWidth: 1,
    lineWidthUnits: 'pixels' as const,
    updateTriggers: {
      getFillColor: [selectedId, pitch],
      getLineColor: [selectedId, pitch],
      getPosition: [pitch],
    },
  }));

  // White inner dot — selected event only, 0.4× size, 200α white
  const selectedEvents = events.filter((e) => e.id === selectedId);
  if (selectedEvents.length > 0) {
    layers.push(new ScatterplotLayer<EarthquakeEvent>({
      id: 'depth-hypo-selected-dot',
      data: selectedEvents,
      pickable: false,
      stroked: false,
      filled: true,
      radiusUnits: 'pixels' as const,
      getPosition: (d) => [d.lng, d.lat, depthToAlt(d.depth_km, pitch)],
      getRadius: (d) => magToPixels(d.magnitude) * 0.4,
      getFillColor: [255, 255, 255, 200],
      updateTriggers: { getPosition: [pitch] },
    }));
  }

  // ── 6. Surface anchor shadows ─────────────────────────────
  // Translucent epicenter projections at z=0

  layers.push(new ScatterplotLayer<EarthquakeEvent>({
    id: 'depth-surface-anchor',
    data: events,
    pickable: false,
    stroked: true,
    filled: true,
    radiusUnits: 'pixels' as const,
    getPosition: (d) => [d.lng, d.lat, 0],
    getRadius: (d) => magToPixels(d.magnitude) * 0.7,
    getFillColor: (d) => {
      const c = depthToColor(d.depth_km);
      return [c[0], c[1], c[2], Math.round(22 * pitchFade)] as RGBA;
    },
    getLineColor: (d) => {
      const c = depthToColor(d.depth_km);
      return [c[0], c[1], c[2], Math.round(55 * pitchFade)] as RGBA;
    },
    getLineWidth: 1,
    lineWidthUnits: 'pixels' as const,
    updateTriggers: {
      getFillColor: [events.length, pitch],
      getLineColor: [events.length, pitch],
    },
  }));

  return layers;
}
