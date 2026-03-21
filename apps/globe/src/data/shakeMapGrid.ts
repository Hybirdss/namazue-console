/**
 * ShakeMap Grid Parsers — Convert authoritative USGS ShakeMap rasters into IntensityGrid.
 *
 * We prefer CoverageJSON/grid.xml raster products over cont_mmi contour lines because
 * contour products are lossy display geometry, not analysis-grade rasters.
 */

import type { IntensityGrid } from '../types';

interface CoverageAxis {
  start?: number;
  stop?: number;
  num?: number;
}

interface CoverageRange {
  type?: string;
  shape?: number[];
  values?: number[];
}

export interface ShakeMapCoverageJson {
  type?: string;
  domain?: {
    axes?: {
      x?: CoverageAxis;
      y?: CoverageAxis;
    };
  };
  parameters?: Record<string, unknown>;
  ranges?: Record<string, CoverageRange>;
}

export interface ShakeMapGridProducts {
  mmiCoverage: ShakeMapCoverageJson | null;
  gridXml: string | null;
  eventId: string;
}

function mmiToJma(mmi: number): number {
  if (!Number.isFinite(mmi) || mmi <= 1) return 0;
  if (mmi <= 5) return mmi * 0.92 - 0.82;
  if (mmi <= 8) return mmi * 0.77 - 0.07;
  return Math.min(7.0, mmi * 0.55 + 1.65);
}

function buildGridFrame(
  latMin: number,
  latMax: number,
  lngMin: number,
  lngMax: number,
): Pick<IntensityGrid, 'center' | 'radiusDeg' | 'radiusLngDeg'> {
  return {
    center: {
      lat: (latMin + latMax) / 2,
      lng: (lngMin + lngMax) / 2,
    },
    radiusDeg: (latMax - latMin) / 2,
    radiusLngDeg: (lngMax - lngMin) / 2,
  };
}

export function coverageMmiToIntensityGrid(
  coverage: ShakeMapCoverageJson | null | undefined,
): IntensityGrid | null {
  const x = coverage?.domain?.axes?.x;
  const y = coverage?.domain?.axes?.y;
  const xStart = x?.start;
  const xStop = x?.stop;
  const xNum = x?.num;
  const yStart = y?.start;
  const yStop = y?.stop;
  const yNum = y?.num;
  const range = coverage?.ranges?.MMI;
  const values = range?.values;

  if (
    !Number.isFinite(xStart) || !Number.isFinite(xStop) || !Number.isFinite(xNum) || xNum! < 1
    || !Number.isFinite(yStart) || !Number.isFinite(yStop) || !Number.isFinite(yNum) || yNum! < 1
    || !Array.isArray(values)
  ) {
    return null;
  }

  const cols = Math.trunc(xNum!);
  const rows = Math.trunc(yNum!);
  if (rows <= 0 || cols <= 0 || values.length < rows * cols) {
    return null;
  }

  const data = new Float32Array(rows * cols);
  for (let i = 0; i < rows * cols; i++) {
    data[i] = mmiToJma(values[i]);
  }

  const lngMin = Math.min(xStart!, xStop!);
  const lngMax = Math.max(xStart!, xStop!);
  const latMin = Math.min(yStart!, yStop!);
  const latMax = Math.max(yStart!, yStop!);

  return {
    data,
    rows,
    cols,
    ...buildGridFrame(latMin, latMax, lngMin, lngMax),
  };
}

function parseXmlAttributes(tagSource: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z_][\w:-]*)="([^"]*)"/g;
  for (let match = attrRegex.exec(tagSource); match; match = attrRegex.exec(tagSource)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function parseFiniteNumber(value: string | undefined): number | null {
  if (!value) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function gridXmlToIntensityGrid(xml: string | null | undefined): IntensityGrid | null {
  if (!xml) return null;

  const gridSpecMatch = xml.match(/<grid_specification\b([^>]*)\/?>/i);
  const gridDataMatch = xml.match(/<grid_data>([\s\S]*?)<\/grid_data>/i);
  if (!gridSpecMatch || !gridDataMatch) return null;

  const attrs = parseXmlAttributes(gridSpecMatch[1]);
  const lngMin = parseFiniteNumber(attrs.lon_min);
  const lngMax = parseFiniteNumber(attrs.lon_max);
  const latMin = parseFiniteNumber(attrs.lat_min);
  const latMax = parseFiniteNumber(attrs.lat_max);
  const lonSpacing = parseFiniteNumber(attrs.nominal_lon_spacing);
  const latSpacing = parseFiniteNumber(attrs.nominal_lat_spacing);
  const cols = parseFiniteNumber(attrs.nlon);
  const rows = parseFiniteNumber(attrs.nlat);

  if (
    lngMin == null || lngMax == null || latMin == null || latMax == null
    || lonSpacing == null || latSpacing == null
    || cols == null || rows == null
    || cols < 1 || rows < 1
  ) {
    return null;
  }

  const width = Math.trunc(cols);
  const height = Math.trunc(rows);
  const data = new Float32Array(width * height);
  const lines = gridDataMatch[1].trim().split(/\r?\n+/);

  for (const line of lines) {
    const [lonRaw, latRaw, mmiRaw] = line.trim().split(/\s+/);
    const lon = Number(lonRaw);
    const lat = Number(latRaw);
    const mmi = Number(mmiRaw);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(mmi)) continue;

    const col = Math.round((lon - lngMin) / lonSpacing);
    const row = Math.round((lat - latMin) / latSpacing);
    if (row < 0 || row >= height || col < 0 || col >= width) continue;

    data[row * width + col] = mmiToJma(mmi);
  }

  return {
    data,
    rows: height,
    cols: width,
    ...buildGridFrame(latMin, latMax, lngMin, lngMax),
  };
}

export function shakeMapProductsToIntensityGrid(
  products: Pick<ShakeMapGridProducts, 'mmiCoverage' | 'gridXml'> | null | undefined,
): IntensityGrid | null {
  const coverageGrid = coverageMmiToIntensityGrid(products?.mmiCoverage);
  if (coverageGrid) return coverageGrid;
  return gridXmlToIntensityGrid(products?.gridXml);
}
