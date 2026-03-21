import { describe, expect, it } from 'vitest';

import type { ActiveFault } from '../../types';
import { buildScenarioCatalog } from '../scenarioCatalog';

function createFault(overrides: Partial<ActiveFault> = {}): ActiveFault {
  return {
    id: 'japan-trench-tohoku',
    name: '日本海溝',
    nameEn: 'Japan Trench',
    segments: [
      [144.454, 40.847],
      [143.518, 37.059],
      [141.883, 34.213],
    ],
    lengthKm: 800,
    estimatedMw: 9.1,
    depthKm: 24,
    faultType: 'interface',
    interval: '600年程度',
    probability30yr: 'ほぼ0%',
    source: 'PB2002 + HERP 日本海溝沿いの地震活動の長期評価（第二版）2019',
    ...overrides,
  };
}

describe('buildScenarioCatalog', () => {
  it('splits the Japan Trench scenario into historical replay and probabilistic entries', () => {
    const catalog = buildScenarioCatalog([createFault()]);

    const historical = catalog.scenarios.find((scenario) => scenario.id === 'historical-tohoku-2011');
    const probabilistic = catalog.scenarios.find((scenario) => scenario.id === 'japan-trench-probabilistic');

    expect(historical).toBeDefined();
    expect(probabilistic).toBeDefined();
    expect(historical?.kind).toBe('historical_replay');
    expect(probabilistic?.kind).toBe('probabilistic_scenario');
    expect(historical?.faultId).toBe('japan-trench-tohoku');
    expect(probabilistic?.faultId).toBe('japan-trench-tohoku');
    expect(historical?.event.magnitude).toBe(9.0);
    expect(probabilistic?.event.magnitude).toBe(9.1);
  });

  it('hides incompatible metrics when a historical replay would otherwise mix HERP recurrence and probability', () => {
    const catalog = buildScenarioCatalog([createFault()]);
    const historical = catalog.scenarios.find((scenario) => scenario.id === 'historical-tohoku-2011');

    expect(historical).toBeDefined();
    expect(historical?.metrics.recurrence.status).toBe('hidden');
    expect(historical?.metrics.probability30yr.status).toBe('hidden');
    expect(historical?.metrics.maxIntensity.status).toBe('ok');
    expect(historical?.metrics.maxIntensity.provenance?.kind).toBe('official');
  });

  it('fails closed when an official metric is missing provenance or has an invalid unit-label pairing', () => {
    const catalog = buildScenarioCatalog([
      createFault({
        id: 'synthetic-invalid',
        interval: '100年',
        probability30yr: '10%',
      }),
    ]);
    const invalid = catalog.scenarios.find((scenario) => scenario.id === 'synthetic-invalid');

    expect(invalid).toBeDefined();
    expect(invalid?.metrics.tsunamiArrival.status).toBe('hidden');
    expect(invalid?.warnings).toContain('metric:tsunamiArrival:unit-label-mismatch');
    expect(invalid?.warnings).toContain('metric:maxIntensity:missing-provenance');
  });
});
