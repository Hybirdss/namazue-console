import { computeGmpe, haversine } from '../engine/gmpe';
import type { EarthquakeEvent, IntensityGrid } from '../types';

export function sampleIntensityGrid(
  grid: IntensityGrid,
  siteLat: number,
  siteLng: number,
): number | null {
  const lngRadiusDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const latMin = grid.center.lat - grid.radiusDeg;
  const latMax = grid.center.lat + grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadiusDeg;
  const lngMax = grid.center.lng + lngRadiusDeg;

  if (siteLat < latMin || siteLat > latMax || siteLng < lngMin || siteLng > lngMax) {
    return null;
  }

  if (grid.rows <= 1 || grid.cols <= 1) {
    return grid.data[0] ?? 0;
  }

  const rowPos = ((siteLat - latMin) / (latMax - latMin)) * (grid.rows - 1);
  const colPos = ((siteLng - lngMin) / (lngMax - lngMin)) * (grid.cols - 1);

  const row0 = Math.max(0, Math.min(grid.rows - 1, Math.floor(rowPos)));
  const col0 = Math.max(0, Math.min(grid.cols - 1, Math.floor(colPos)));
  const row1 = Math.min(grid.rows - 1, row0 + 1);
  const col1 = Math.min(grid.cols - 1, col0 + 1);

  const rowT = rowPos - row0;
  const colT = colPos - col0;

  const topLeft = grid.data[row0 * grid.cols + col0] ?? 0;
  const topRight = grid.data[row0 * grid.cols + col1] ?? topLeft;
  const bottomLeft = grid.data[row1 * grid.cols + col0] ?? topLeft;
  const bottomRight = grid.data[row1 * grid.cols + col1] ?? bottomLeft;

  const top = topLeft + (topRight - topLeft) * colT;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * colT;
  return top + (bottom - top) * rowT;
}

export function estimateSiteIntensity(
  event: EarthquakeEvent,
  siteLat: number,
  siteLng: number,
  grid?: IntensityGrid | null,
): number {
  if (grid) {
    const sampled = sampleIntensityGrid(grid, siteLat, siteLng);
    if (sampled != null) {
      return Math.max(0, sampled);
    }
  }

  const surfaceDist = haversine(event.lat, event.lng, siteLat, siteLng);
  const hypo = Math.sqrt(surfaceDist * surfaceDist + event.depth_km * event.depth_km);
  const result = computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(hypo, 3),
    faultType: event.faultType,
  });

  return Math.max(0, result.jmaIntensity);
}
