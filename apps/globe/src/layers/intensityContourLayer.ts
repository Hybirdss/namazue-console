/**
 * Intensity Contour Layer — JMA isoseismal contour lines from GMPE IntensityGrid.
 *
 * Applies d3-contour's marching-squares algorithm to the GMPE intensity grid to
 * produce ShakeMap-style isoseismal contours. Each threshold in the JMA scale
 * generates one ContourMultiPolygon; coordinates are transformed from grid-index
 * space back to geographic [lng, lat] using the grid's geographic extent.
 *
 * Two visual layers are produced per call:
 *   1. Filled bands (SolidPolygonLayer) — semi-transparent JMA-colored fill showing
 *      the "at or above this threshold" area for each isoseismal zone.
 *   2. Contour lines (PathLayer) — crisp stroked outlines of each isoseismal, with
 *      line width and alpha scaled by JMA severity.
 *
 * Performance: contour geometry is memoized by grid object reference. The same
 * IntensityGrid reference reuses the previous result without re-running marching
 * squares. The cache holds at most one entry (the most recent grid).
 */

import { contours } from 'd3-contour';
import { PathLayer, SolidPolygonLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { IntensityGrid } from '../types';

// ── JMA threshold definitions ────────────────────────────────

/**
 * JMA instrumental intensity thresholds used to generate contour lines.
 * Each entry defines: the d3 threshold value, the semi-transparent fill
 * color, and the stroke color + line width for the contour outline.
 *
 * Fill alphas are intentionally low (8–35) so the scatterplot intensity
 * field remains visible underneath. Stroke alphas (80–140) give crisp
 * isoseismal outlines that read well on a dark base map.
 */
interface ContourSpec {
  threshold: number;
  fillColor: [number, number, number, number];
  strokeColor: [number, number, number, number];
  lineWidthPx: number;
}

const CONTOUR_SPECS: ContourSpec[] = [
  // threshold, fillColor (RGBA), strokeColor (RGBA), lineWidthPx
  { threshold: 6.5, fillColor: [153,   0, 153, 35], strokeColor: [153,   0, 153, 140], lineWidthPx: 3.0 },  // JMA 7
  { threshold: 6.0, fillColor: [204,   0,   0, 30], strokeColor: [204,   0,   0, 130], lineWidthPx: 2.5 },  // JMA 6+
  { threshold: 5.5, fillColor: [255,  51,   0, 25], strokeColor: [255,  51,   0, 120], lineWidthPx: 2.0 },  // JMA 6-
  { threshold: 5.0, fillColor: [255, 102,   0, 20], strokeColor: [255, 102,   0, 110], lineWidthPx: 2.0 },  // JMA 5+
  { threshold: 4.5, fillColor: [255, 153,   0, 16], strokeColor: [255, 153,   0, 100], lineWidthPx: 1.5 },  // JMA 5-
  { threshold: 3.5, fillColor: [255, 255,   0, 12], strokeColor: [255, 255,   0,  90], lineWidthPx: 1.5 },  // JMA 4
  { threshold: 2.5, fillColor: [ 51, 204, 102,  8], strokeColor: [ 51, 204, 102,  80], lineWidthPx: 1.5 },  // JMA 3
];

const JMA_THRESHOLDS = CONTOUR_SPECS.map((s) => s.threshold);

// ── Geometry types ───────────────────────────────────────────

/** A single polygon ring or path in geographic [lng, lat] coordinates. */
type GeoRing = [number, number][];

/** Data record for one filled contour band (SolidPolygonLayer). */
interface ContourFillDatum {
  /** Outer ring + optional hole rings as NestedComplexPolygonGeometry. */
  polygon: GeoRing[];
  color: [number, number, number, number];
}

/** Data record for one contour line segment (PathLayer). */
interface ContourPathDatum {
  path: GeoRing;
  color: [number, number, number, number];
  widthPx: number;
}

// ── Coordinate transform helpers ─────────────────────────────

/**
 * Build the geographic extent parameters from a grid.
 * Returns the values needed to map (col, row) → (lng, lat).
 */
function buildGeoTransform(grid: IntensityGrid): {
  latMin: number;
  lngMin: number;
  latStep: number;
  lngStep: number;
} {
  const lngRadDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  return {
    latMin: grid.center.lat - grid.radiusDeg,
    lngMin: grid.center.lng - lngRadDeg,
    latStep: (2 * grid.radiusDeg) / Math.max(1, grid.rows - 1),
    lngStep: (2 * lngRadDeg) / Math.max(1, grid.cols - 1),
  };
}

/**
 * Transform one d3-contour ring (grid-index coordinates) into a
 * geographic ring ([lng, lat] pairs).
 */
function transformRing(
  ring: [number, number][],
  latMin: number,
  lngMin: number,
  latStep: number,
  lngStep: number,
): GeoRing {
  return ring.map(([x, y]) => [
    lngMin + x * lngStep,
    latMin + y * latStep,
  ]);
}

// ── Contour computation cache ────────────────────────────────

// Single-entry cache keyed on grid object reference.
let cachedGrid: IntensityGrid | null = null;
let cachedFillData: ContourFillDatum[] = [];
let cachedPathData: ContourPathDatum[] = [];

/**
 * Run (or return cached) d3-contour marching squares over the intensity grid.
 * Populates cachedFillData and cachedPathData in a single pass.
 */
function computeContours(grid: IntensityGrid): void {
  if (grid === cachedGrid) return;
  cachedGrid = grid;

  // d3-contour requires a plain number[] in row-major order [col + row * cols]
  // IntensityGrid stores data the same way (row r, col c → r * cols + c),
  // which is exactly what d3 expects given size([cols, rows]).
  const values = Array.from(grid.data) as number[];

  const generator = contours()
    .size([grid.cols, grid.rows])
    .smooth(true)
    .thresholds(JMA_THRESHOLDS);

  const features = generator(values);

  const { latMin, lngMin, latStep, lngStep } = buildGeoTransform(grid);

  const fills: ContourFillDatum[] = [];
  const paths: ContourPathDatum[] = [];

  for (let i = 0; i < features.length; i++) {
    const feature = features[i];
    const spec = CONTOUR_SPECS[i];

    // feature.coordinates is MultiPolygon: [polygon[ring[point[x,y]]]]
    for (const polygon of feature.coordinates) {
      if (polygon.length === 0) continue;

      // Transform each ring
      const geoRings: GeoRing[] = polygon.map((ring) =>
        transformRing(ring as [number, number][], latMin, lngMin, latStep, lngStep),
      );

      // Filled band: outer ring + holes
      fills.push({
        polygon: geoRings,
        color: spec.fillColor,
      });

      // Contour lines: only the outer ring (index 0) of each polygon
      paths.push({
        path: geoRings[0],
        color: spec.strokeColor,
        widthPx: spec.lineWidthPx,
      });
    }
  }

  cachedFillData = fills;
  cachedPathData = paths;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Create JMA isoseismal contour layers from a GMPE IntensityGrid.
 *
 * Returns two Deck.gl layers:
 *   - `intensity-contour-fill` (SolidPolygonLayer): semi-transparent filled bands
 *   - `intensity-contour-lines` (PathLayer): stroked isoseismal outlines
 *
 * Returns an empty array if the grid is null or has no data.
 */
export function createIntensityContourLayers(grid: IntensityGrid | null): Layer[] {
  if (!grid || grid.rows < 2 || grid.cols < 2 || !grid.data.length) return [];
  if (!Number.isFinite(grid.center.lat) || !Number.isFinite(grid.center.lng)) return [];

  computeContours(grid);

  if (cachedFillData.length === 0 && cachedPathData.length === 0) return [];

  const fillLayer = new SolidPolygonLayer<ContourFillDatum>({
    id: 'intensity-contour-fill',
    data: cachedFillData,
    pickable: false,
    filled: true,
    extruded: false,
    wireframe: false,
    getPolygon: (d) => d.polygon,
    getFillColor: (d) => d.color,
    updateTriggers: {
      getPolygon: [grid],
      getFillColor: [grid],
    },
  });

  const lineLayer = new PathLayer<ContourPathDatum>({
    id: 'intensity-contour-lines',
    data: cachedPathData,
    pickable: false,
    widthUnits: 'pixels',
    getPath: (d) => d.path,
    getColor: (d) => d.color,
    getWidth: (d) => d.widthPx,
    jointRounded: true,
    capRounded: true,
    updateTriggers: {
      getPath: [grid],
      getColor: [grid],
      getWidth: [grid],
    },
  });

  return [fillLayer, lineLayer];
}
