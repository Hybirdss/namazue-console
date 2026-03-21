import { describe, expect, it } from 'vitest';

import { createDefaultBundleSettings } from '../../layers/bundleRegistry';
import { buildDensityRuntimeViewModel } from '../densityRuntime';

describe('buildDensityRuntimeViewModel', () => {
  it('selects active bundle density for shell runtime attributes', () => {
    const bundleSettings = createDefaultBundleSettings();
    bundleSettings.lifelines = { enabled: true, density: 'dense' };

    expect(buildDensityRuntimeViewModel({
      activeBundleId: 'lifelines',
      bundleSettings,
    })).toEqual({
      activeBundleId: 'lifelines',
      density: 'dense',
    });
  });
});
