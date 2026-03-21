import { describe, expect, it } from 'vitest';

import { buildLayerFactoryRegistry, defineLayerPlugin } from '../plugin';

describe('layer plugin registry', () => {
  it('sorts plugins by order for deterministic layer stacking', () => {
    const plugins = buildLayerFactoryRegistry([
      defineLayerPlugin({
        id: 'earthquakes',
        order: 400,
        deps: ['events'],
        create: () => [],
      }),
      defineLayerPlugin({
        id: 'intensity',
        order: 100,
        deps: ['intensityGrid'],
        create: () => [],
      }),
    ]);

    expect(plugins.map((entry) => entry.id)).toEqual(['intensity', 'earthquakes']);
  });

  it('rejects duplicate plugin ids to prevent non-deterministic factory overrides', () => {
    expect(() => buildLayerFactoryRegistry([
      defineLayerPlugin({
        id: 'intensity',
        order: 100,
        deps: ['intensityGrid'],
        create: () => [],
      }),
      defineLayerPlugin({
        id: 'intensity',
        order: 200,
        deps: ['selectedEvent'],
        create: () => [],
      }),
    ])).toThrowError('duplicate layer id: intensity');
  });
});
