import { describe, expect, it } from 'vitest';

import { createDefaultBundleSettings } from '../bundleRegistry';
import { isLayerSuppressedByPolicy } from '../layerRenderPolicy';

describe('layerRenderPolicy', () => {
  it('suppresses high-cost seismic layers in minimal density mode', () => {
    const bundleSettings = createDefaultBundleSettings();
    bundleSettings.seismic = { enabled: true, density: 'minimal' };

    expect(isLayerSuppressedByPolicy('heatmap', {
      activeBundleId: 'seismic',
      bundleSettings,
      viewportTier: 'city',
      performanceTone: 'nominal',
    })).toBe(true);

    expect(isLayerSuppressedByPolicy('earthquakes', {
      activeBundleId: 'seismic',
      bundleSettings,
      viewportTier: 'city',
      performanceTone: 'nominal',
    })).toBe(false);
  });

  it('suppresses tier-inappropriate infrastructure layers at national tier', () => {
    const bundleSettings = createDefaultBundleSettings();

    expect(isLayerSuppressedByPolicy('airports', {
      activeBundleId: 'lifelines',
      bundleSettings,
      viewportTier: 'national',
      performanceTone: 'nominal',
    })).toBe(true);

    expect(isLayerSuppressedByPolicy('rail', {
      activeBundleId: 'lifelines',
      bundleSettings,
      viewportTier: 'national',
      performanceTone: 'nominal',
    })).toBe(false);
  });

  it('adds performance suppression when rendering tone is degraded', () => {
    const bundleSettings = createDefaultBundleSettings();

    expect(isLayerSuppressedByPolicy('ais', {
      activeBundleId: 'maritime',
      bundleSettings,
      viewportTier: 'city',
      performanceTone: 'degraded',
    })).toBe(true);
  });
});
