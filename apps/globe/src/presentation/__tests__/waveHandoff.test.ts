import { describe, expect, it } from 'vitest';

import { buildWaveHandoffModel, toWaveHandoffDisplayKm } from '../waveHandoff';

describe('buildWaveHandoffModel', () => {
  it('rounds wave distance to coarse display buckets to avoid per-frame churn', () => {
    expect(toWaveHandoffDisplayKm(183)).toBe(180);
    expect(toWaveHandoffDisplayKm(187)).toBe(190);
    expect(toWaveHandoffDisplayKm(0)).toBe(0);
  });

  it('returns idle when there is no active wave sequence', () => {
    expect(buildWaveHandoffModel({
      sequenceSWaveKm: null,
      selectedEvent: null,
    })).toEqual({
      phase: 'idle',
      label: 'Wave standby',
      tone: 'nominal',
    });
  });

  it('returns propagating status while wave front is still inside threshold', () => {
    const model = buildWaveHandoffModel({
      sequenceSWaveKm: 180,
      selectedEvent: { magnitude: 6.4, depth_km: 32 },
    });

    expect(model.phase).toBe('propagating');
    expect(model.label).toContain('180 km');
    expect(model.tone).toBe('watch');
  });

  it('returns arrived status when wave front crosses the threshold', () => {
    const model = buildWaveHandoffModel({
      sequenceSWaveKm: 720,
      selectedEvent: { magnitude: 7.2, depth_km: 18 },
    });

    expect(model.phase).toBe('arrived');
    expect(model.label).toContain('720 km');
    expect(model.tone).toBe('priority');
  });
});
