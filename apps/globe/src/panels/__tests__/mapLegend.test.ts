import { describe, expect, it } from 'vitest';

import { buildAssetCategoryVisibility, toggleAssetCategoryVisibility } from '../../ops/assetCategoryVisibility';
import type { IntensityGrid } from '../../types';
import { renderMapLegendMarkup } from '../mapLegend';

function createGrid(values: number[]): IntensityGrid {
  return {
    data: new Float32Array(values),
    cols: values.length,
    rows: 1,
    center: { lat: 35.68, lng: 139.69 },
    radiusDeg: 1,
  };
}

describe('mapLegend', () => {
  it('renders the asset legend expanded by default with category toggles', () => {
    const markup = renderMapLegendMarkup({
      intensityGrid: createGrid([4.2, 5.7]),
      assetsExpanded: true,
      categoryVisibility: buildAssetCategoryVisibility(),
    });

    expect(markup).toContain('nz-map-legend__jma-bar');
    expect(markup).toContain('nz-map-legend__section');
    expect(markup).toContain('data-category-toggle="nuclear_plant"');
    expect(markup).toContain('aria-pressed="true"');
  });

  it('renders muted toggle state for hidden categories', () => {
    const markup = renderMapLegendMarkup({
      intensityGrid: null,
      assetsExpanded: true,
      categoryVisibility: buildAssetCategoryVisibility({ airport: false }),
    });

    expect(markup).toContain('data-category-toggle="airport"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('nz-map-legend__row--muted');
  });

  it('toggles asset category visibility immutably', () => {
    const current = buildAssetCategoryVisibility();
    const next = toggleAssetCategoryVisibility(current, 'airport');

    expect(current.airport).toBe(true);
    expect(next.airport).toBe(false);
    expect(next.nuclear_plant).toBe(true);
  });
});
