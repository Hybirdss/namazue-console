import type { BundleDensity, BundleSettings } from '../layers/bundleRegistry';
import type { BundleId } from '../layers/layerRegistry';

export interface DensityRuntimeState {
  activeBundleId: BundleId;
  bundleSettings: BundleSettings;
}

export interface DensityRuntimeViewModel {
  activeBundleId: BundleId;
  density: BundleDensity;
}

export function buildDensityRuntimeViewModel(state: DensityRuntimeState): DensityRuntimeViewModel {
  return {
    activeBundleId: state.activeBundleId,
    density: state.bundleSettings[state.activeBundleId].density,
  };
}
