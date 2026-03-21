import { describe, expect, it } from 'vitest';

import { OPS_ASSETS } from '../assetCatalog';

describe('ops asset catalog', () => {
  it('keeps ids unique across the manual overrides', () => {
    const ids = OPS_ASSETS.map((asset) => asset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes all 18 nuclear plants as manual overrides', () => {
    const nuclear = OPS_ASSETS.filter((a) => a.class === 'nuclear_plant');
    expect(nuclear.length).toBe(18);
  });

  it('covers multiple regions in manual overrides', () => {
    const regions = new Set(OPS_ASSETS.map((asset) => asset.region));
    // Nuclear plants span multiple regions
    expect(regions.size).toBeGreaterThanOrEqual(6);
  });

  it('all manual assets have nameJa', () => {
    for (const asset of OPS_ASSETS) {
      expect(asset.nameJa).toBeTruthy();
    }
  });

  it('all manual assets have valid coordinates within Japan', () => {
    for (const asset of OPS_ASSETS) {
      expect(asset.lat).toBeGreaterThan(24);
      expect(asset.lat).toBeLessThan(46);
      expect(asset.lng).toBeGreaterThan(122);
      expect(asset.lng).toBeLessThan(154);
    }
  });
});
