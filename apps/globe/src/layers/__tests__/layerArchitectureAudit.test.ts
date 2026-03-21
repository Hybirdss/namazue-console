import { describe, expect, it } from 'vitest';

import type { DataLayerPlugin } from '../plugin';
import { auditLayerArchitecture, assertLayerArchitecture } from '../layerArchitectureAudit';
import { LAYER_PLUGINS } from '../layerFactories';

describe('layerArchitectureAudit', () => {
  it('passes for the production layer architecture wiring', () => {
    expect(() => assertLayerArchitecture(LAYER_PLUGINS)).not.toThrow();
  });

  it('detects missing live layer factories', () => {
    const truncated = LAYER_PLUGINS.filter((plugin) => plugin.id !== 'heatmap');
    const report = auditLayerArchitecture(truncated);

    expect(report.missingLiveLayerFactories).toContain('heatmap');
  });

  it('detects orphaned layer factories', () => {
    const withOrphan = [
      ...LAYER_PLUGINS,
      {
        id: 'phantom-layer',
        order: 999,
        deps: ['events'],
        create: () => [],
      } as unknown as DataLayerPlugin,
    ];

    const report = auditLayerArchitecture(withOrphan);
    expect(report.orphanedFactories).toContain('phantom-layer' as any);
  });
});
