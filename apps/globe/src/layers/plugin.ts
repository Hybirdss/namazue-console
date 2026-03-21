import type { Layer } from '@deck.gl/core';

import type { ConsoleState } from '../core/store';
import type { LayerId } from './layerRegistry';

export interface DataLayerPlugin {
  id: LayerId;
  order: number;
  deps: (keyof ConsoleState)[];
  /** 'zoom' (default): only rebuild on zoom change. 'full': rebuild on every viewport update. */
  viewportMode?: 'zoom' | 'full';
  create(state: ConsoleState): Layer[];
}

export function defineLayerPlugin(plugin: DataLayerPlugin): DataLayerPlugin {
  return plugin;
}

export function buildLayerFactoryRegistry(plugins: DataLayerPlugin[]): DataLayerPlugin[] {
  const idSet = new Set<LayerId>();

  for (const plugin of plugins) {
    if (idSet.has(plugin.id)) {
      throw new Error(`[layer-plugin] duplicate layer id: ${plugin.id}`);
    }
    idSet.add(plugin.id);
  }

  return [...plugins].sort((a, b) => a.order - b.order);
}
