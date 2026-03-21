import { beforeEach, describe, expect, it } from 'vitest';

import { setLocale } from '../../i18n';
import { renderOperatorPulseMarkup } from '../operatorPulse';

describe('operatorPulse', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('renders degraded realtime and scenario-on posture', () => {
    const markup = renderOperatorPulseMarkup({
      realtimeStatus: {
        source: 'fallback',
        state: 'degraded',
        updatedAt: Date.parse('2026-03-09T13:00:00.000Z'),
        staleAfterMs: 60_000,
      },
      performanceStatus: {
        fps: 28.3,
        tone: 'degraded',
      },
      scenarioMode: true,
      activeBundleId: 'lifelines',
      now: Date.parse('2026-03-09T13:02:30.000Z'),
    });

    expect(markup).toContain('Operator Pulse');
    expect(markup).toContain('FALLBACK');
    expect(markup).toContain('Degraded');
    expect(markup).toContain('28 FPS');
    expect(markup).toContain('Lifelines');
    expect(markup).toContain('ON');
    expect(markup).toContain('2m ago');
  });

  it('renders fresh realtime and scenario-off posture', () => {
    const markup = renderOperatorPulseMarkup({
      realtimeStatus: {
        source: 'server',
        state: 'fresh',
        updatedAt: Date.parse('2026-03-09T13:10:00.000Z'),
        staleAfterMs: 60_000,
      },
      performanceStatus: {
        fps: 59.8,
        tone: 'nominal',
      },
      scenarioMode: false,
      activeBundleId: 'seismic',
      now: Date.parse('2026-03-09T13:10:20.000Z'),
    });

    expect(markup).toContain('SERVER');
    expect(markup).toContain('Fresh');
    expect(markup).toContain('60 FPS');
    expect(markup).toContain('Seismic');
    expect(markup).toContain('OFF');
    expect(markup).toContain('20s ago');
  });
});
