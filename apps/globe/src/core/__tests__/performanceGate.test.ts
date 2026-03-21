import { describe, expect, it } from 'vitest';

import { createPerformanceGate } from '../performanceGate';

describe('createPerformanceGate', () => {
  it('reports degraded when fps drops below the minimum threshold', () => {
    const gate = createPerformanceGate({
      minFps: 45,
      watchFps: 52,
      sampleWindowMs: 1000,
      minFramesPerWindow: 10,
    });

    let status = gate.sample(1);
    expect(status).toBeNull();

    for (let i = 1; i <= 11; i += 1) {
      const next = gate.sample(1 + (i * 120)); // ~8.3fps
      if (next) {
        status = next;
      }
    }

    expect(status).not.toBeNull();
    expect(status?.tone).toBe('degraded');
    expect(status?.fps).toBeLessThan(45);
  });

  it('reports watch before crossing into nominal fps range', () => {
    const gate = createPerformanceGate({
      minFps: 45,
      watchFps: 52,
      sampleWindowMs: 1000,
      minFramesPerWindow: 20,
    });

    expect(gate.sample(1)).toBeNull();

    let status = null;
    for (let i = 1; i <= 55; i += 1) {
      const next = gate.sample(1 + (i * 20)); // ~50fps
      if (next) {
        status = next;
      }
    }

    expect(status?.tone).toBe('watch');
    expect(status?.fps).toBeGreaterThanOrEqual(45);
    expect(status?.fps).toBeLessThan(52);
  });

  it('reports nominal once frame rate is healthy', () => {
    const gate = createPerformanceGate({
      minFps: 45,
      watchFps: 52,
      sampleWindowMs: 1000,
      minFramesPerWindow: 20,
    });

    expect(gate.sample(1)).toBeNull();

    let status = null;
    for (let i = 1; i <= 70; i += 1) {
      const next = gate.sample(1 + (i * 16)); // ~62.5fps
      if (next) {
        status = next;
      }
    }

    expect(status?.tone).toBe('nominal');
    expect(status?.fps).toBeGreaterThanOrEqual(52);
  });
});
