import { getAllBundleDefinitions } from './bundleRegistry';
import { getAllLayerDefinitions, type LayerId } from './layerRegistry';
import type { DataLayerPlugin } from './plugin';

export interface LayerArchitectureAuditReport {
  missingLiveLayerFactories: LayerId[];
  orphanedFactories: LayerId[];
  unknownBundleLayerRefs: string[];
}

export function auditLayerArchitecture(plugins: DataLayerPlugin[]): LayerArchitectureAuditReport {
  const layerDefs = getAllLayerDefinitions();
  const layerIdSet = new Set<LayerId>(layerDefs.map((layer) => layer.id));
  const pluginIdSet = new Set<LayerId>(plugins.map((plugin) => plugin.id));

  const missingLiveLayerFactories = layerDefs
    .filter((layer) => layer.availability === 'live' && !pluginIdSet.has(layer.id))
    .map((layer) => layer.id)
    .sort();

  const orphanedFactories = [...pluginIdSet]
    .filter((id) => !layerIdSet.has(id))
    .sort();

  const unknownBundleLayerRefs = getAllBundleDefinitions()
    .flatMap((bundle) => bundle.layerIds
      .filter((layerId) => !layerIdSet.has(layerId))
      .map((layerId) => `${bundle.id}:${String(layerId)}`))
    .sort();

  return {
    missingLiveLayerFactories,
    orphanedFactories,
    unknownBundleLayerRefs,
  };
}

export function assertLayerArchitecture(plugins: DataLayerPlugin[]): void {
  const report = auditLayerArchitecture(plugins);
  const failures: string[] = [];

  if (report.missingLiveLayerFactories.length > 0) {
    failures.push(`missing live layer factories: ${report.missingLiveLayerFactories.join(', ')}`);
  }
  if (report.orphanedFactories.length > 0) {
    failures.push(`orphaned factories: ${report.orphanedFactories.join(', ')}`);
  }
  if (report.unknownBundleLayerRefs.length > 0) {
    failures.push(`unknown bundle layer refs: ${report.unknownBundleLayerRefs.join(', ')}`);
  }

  if (failures.length > 0) {
    throw new Error(`[layer-architecture] ${failures.join(' | ')}`);
  }
}
