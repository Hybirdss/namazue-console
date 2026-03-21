import type { PerformanceTone } from '../core/store';
import type { ZoomTier } from '../core/viewportManager';
import type { BundleDensity, BundleSettings } from './bundleRegistry';
import type { BundleId, LayerId } from './layerRegistry';

interface LayerRenderPolicyContext {
  activeBundleId: BundleId;
  bundleSettings: BundleSettings;
  viewportTier: ZoomTier;
  performanceTone: PerformanceTone;
}

const DENSITY_SUPPRESSIONS: Record<BundleDensity, LayerId[]> = {
  minimal: ['heatmap', 'seismic-depth', 'airports', 'transport'],
  standard: [],
  dense: [],
};

const TIER_SUPPRESSIONS: Partial<Record<ZoomTier, LayerId[]>> = {
  national: ['airports', 'transport', 'hospitals'],
};

const WATCH_SUPPRESSIONS: LayerId[] = [];
const DEGRADED_SUPPRESSIONS: LayerId[] = ['seismic-depth', 'heatmap', 'ais'];

function buildSuppressedSet(context: LayerRenderPolicyContext): Set<LayerId> {
  const density = context.bundleSettings[context.activeBundleId].density;
  const suppressed = new Set<LayerId>(DENSITY_SUPPRESSIONS[density]);

  for (const layerId of TIER_SUPPRESSIONS[context.viewportTier] ?? []) {
    suppressed.add(layerId);
  }

  const performanceSuppression = context.performanceTone === 'degraded'
    ? DEGRADED_SUPPRESSIONS
    : context.performanceTone === 'watch'
      ? WATCH_SUPPRESSIONS
      : [];

  for (const layerId of performanceSuppression) {
    suppressed.add(layerId);
  }

  return suppressed;
}

export function isLayerSuppressedByPolicy(
  layerId: LayerId,
  context: LayerRenderPolicyContext,
): boolean {
  return buildSuppressedSet(context).has(layerId);
}
