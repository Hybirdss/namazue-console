import { describe, expect, it } from 'vitest';

import { buildMissionStripModel } from '../missionStrip';

describe('buildMissionStripModel', () => {
  it('emits compact cells for view, bundle, density, freshness, and trust', () => {
    const model = buildMissionStripModel({
      mode: 'event',
      activeViewId: 'national-impact',
      activeBundleId: 'seismic',
      density: 'dense',
      region: {
        tier: 'regional',
        activeRegion: 'kanto',
      },
      freshness: {
        source: 'server',
        state: 'degraded',
        components: [
          {
            id: 'maritime',
            label: 'Maritime',
            state: 'degraded',
            message: 'AIS timeout',
          },
        ],
      },
      trust: {
        healthLevel: 'watch',
        eventTruth: {
          confidence: 'high',
          hasConflictingRevision: true,
          divergenceSeverity: 'minor',
        },
      },
    });

    expect(model.regionLabel).toBe('Kanto');
    expect(model.headline).toBe('Event active');
    expect(model.cells.map((cell) => cell.id)).toEqual(
      expect.arrayContaining(['view', 'bundle', 'density', 'freshness', 'trust']),
    );
    expect(model.cells.find((cell) => cell.id === 'view')?.value).toBe('National Impact');
    expect(model.cells.find((cell) => cell.id === 'bundle')?.value).toBe('Seismic');
    expect(model.cells.find((cell) => cell.id === 'density')?.value).toBe('Dense');
    expect(model.cells.find((cell) => cell.id === 'freshness')?.tone).toBe('degraded');
    expect(model.cells.find((cell) => cell.id === 'trust')?.value).toBe('CONFLICT');
    expect(model.alerts[0]?.label).toContain('Maritime');
  });

  it('falls back to Japan-wide calm wording and promotes divergence to the trust cell', () => {
    const model = buildMissionStripModel({
      mode: 'calm',
      activeViewId: 'coastal-operations',
      activeBundleId: 'maritime',
      density: 'standard',
      region: null,
      freshness: {
        source: 'usgs',
        state: 'stale',
        message: 'fallback active',
      },
      trust: {
        healthLevel: 'watch',
        eventTruth: {
          confidence: 'high',
          hasConflictingRevision: true,
          divergenceSeverity: 'material',
        },
      },
    });

    expect(model.regionLabel).toBe('Japan');
    expect(model.headline).toBe('System calm');
    expect(model.cells.find((cell) => cell.id === 'freshness')?.value).toBe('usgs stale');
    expect(model.cells.find((cell) => cell.id === 'trust')).toMatchObject({
      value: 'DIVERGENCE',
      tone: 'watch',
    });
    expect(model.alerts[0]?.label).toBe('fallback active');
  });
});
