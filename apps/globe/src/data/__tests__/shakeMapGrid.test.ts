import { describe, expect, it } from 'vitest';

import {
  coverageMmiToIntensityGrid,
  gridXmlToIntensityGrid,
  shakeMapProductsToIntensityGrid,
} from '../shakeMapGrid';

const sampleCoverage = {
  type: 'Coverage',
  parameters: {
    MMI: {},
  },
  domain: {
    axes: {
      x: { start: 139.0, stop: 139.2, num: 2 },
      y: { start: 35.0, stop: 35.2, num: 2 },
    },
  },
  ranges: {
    MMI: {
      type: 'NdArray',
      shape: [2, 2],
      values: [4, 5, 6, 7],
    },
  },
};

const sampleGridXml = `
<shakemap_grid>
  <grid_specification lon_min="139.0" lat_min="35.0" lon_max="139.2" lat_max="35.2" nominal_lon_spacing="0.2" nominal_lat_spacing="0.2" nlon="2" nlat="2" />
  <grid_field index="1" name="LON" units="dd" />
  <grid_field index="2" name="LAT" units="dd" />
  <grid_field index="3" name="MMI" units="intensity" />
  <grid_data>
139.0 35.0 3.5
139.2 35.0 4.5
139.0 35.2 5.5
139.2 35.2 6.5
  </grid_data>
</shakemap_grid>
`.trim();

describe('shakeMapGrid', () => {
  it('parses CoverageJSON MMI grids into IntensityGrid values', () => {
    const grid = coverageMmiToIntensityGrid(sampleCoverage as never);

    expect(grid).not.toBeNull();
    expect(grid?.cols).toBe(2);
    expect(grid?.rows).toBe(2);
    expect(grid?.center.lat).toBeCloseTo(35.1, 6);
    expect(grid?.center.lng).toBeCloseTo(139.1, 6);
    expect(grid?.radiusDeg).toBeCloseTo(0.1, 6);
    expect(grid?.radiusLngDeg).toBeCloseTo(0.1, 6);

    expect(grid?.data[0]).toBeCloseTo(2.86, 2);
    expect(grid?.data[1]).toBeCloseTo(3.78, 2);
    expect(grid?.data[2]).toBeCloseTo(4.55, 2);
    expect(grid?.data[3]).toBeCloseTo(5.32, 2);
  });

  it('parses ShakeMap grid.xml fallback when CoverageJSON is unavailable', () => {
    const grid = gridXmlToIntensityGrid(sampleGridXml);

    expect(grid).not.toBeNull();
    expect(grid?.cols).toBe(2);
    expect(grid?.rows).toBe(2);
    expect(grid?.center.lat).toBeCloseTo(35.1, 6);
    expect(grid?.center.lng).toBeCloseTo(139.1, 6);

    expect(grid?.data[0]).toBeCloseTo(2.40, 2);
    expect(grid?.data[1]).toBeCloseTo(3.32, 2);
    expect(grid?.data[2]).toBeCloseTo(4.165, 3);
    expect(grid?.data[3]).toBeCloseTo(4.935, 3);
  });

  it('prefers CoverageJSON over lossy fallback sources', () => {
    const grid = shakeMapProductsToIntensityGrid({
      mmiCoverage: sampleCoverage as never,
      gridXml: sampleGridXml,
    });

    expect(grid).not.toBeNull();
    expect(grid?.data[0]).toBeCloseTo(2.86, 2);
    expect(grid?.data[3]).toBeCloseTo(5.32, 2);
  });
});
