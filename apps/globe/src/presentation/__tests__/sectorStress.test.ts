import { describe, expect, it, beforeAll } from 'vitest';

import { buildSectorStressModel } from '../sectorStress';
import { OPS_ASSETS } from '../../ops/assetCatalog';
import type { OpsAsset } from '../../ops/types';

// Inject test assets that match the exposure IDs below
beforeAll(() => {
  const testAssets: OpsAsset[] = [
    { id: 'tokyo-port', region: 'kanto', class: 'port', name: 'Port of Tokyo', lat: 35.63, lng: 139.77, tags: ['port'], minZoomTier: 'national' },
    { id: 'tokyo-shinagawa', region: 'kanto', class: 'rail_hub', name: 'Shinagawa Station', lat: 35.63, lng: 139.74, tags: ['rail'], minZoomTier: 'national' },
    { id: 'tokyo-east-substation', region: 'kanto', class: 'power_substation', name: 'Tokyo East Substation', lat: 35.65, lng: 139.79, tags: ['power'], minZoomTier: 'regional' },
  ];
  for (const a of testAssets) {
    if (!OPS_ASSETS.find((x) => x.id === a.id)) OPS_ASSETS.push(a);
  }
});

describe('buildSectorStressModel', () => {
  it('groups affected infrastructure by sector family and exposes maritime posture', () => {
    const model = buildSectorStressModel({
      exposures: [
        {
          assetId: 'tokyo-port',
          severity: 'critical',
          score: 92,
          summary: 'Port operations at risk',
          reasons: ['coastal impact'],
        },
        {
          assetId: 'tokyo-shinagawa',
          severity: 'priority',
          score: 76,
          summary: 'Rail interchange under stress',
          reasons: ['transport disruption'],
        },
        {
          assetId: 'tokyo-east-substation',
          severity: 'watch',
          score: 54,
          summary: 'Power checks advised',
          reasons: ['grid fluctuation'],
        },
      ],
      maritimeExposure: {
        totalInZone: 3,
        passengerCount: 1,
        tankerCount: 1,
        cargoCount: 1,
        fishingCount: 0,
        summary: '3 vessels in impact zone · 1 passenger · 1 tanker',
      },
      maritimeOverview: {
        totalTracked: 12,
        highPriorityTracked: 4,
        underwayCount: 7,
        anchoredCount: 5,
        summary: '12 tracked · 4 high-priority · 7 underway · 5 anchored',
      },
    });

    expect(model.infrastructure.affectedCount).toBe(3);
    expect(model.infrastructure.groups[0]?.label).toBe('Ports');
    expect(model.infrastructure.groups[0]?.critical).toBe(1);
    expect(model.infrastructure.groups[0]?.topAsset?.assetName).toContain('Port');
    expect(model.maritime.totalTracked).toBe(12);
    expect(model.maritime.inImpactZone).toBe(3);
    expect(model.maritime.highPriorityInZone).toBe(2);
    expect(model.maritime.summary).toContain('impact zone');
  });

  it('falls back to maritime overview summary when no vessel is in the impact zone', () => {
    const model = buildSectorStressModel({
      exposures: [],
      maritimeExposure: {
        totalInZone: 0,
        passengerCount: 0,
        tankerCount: 0,
        cargoCount: 0,
        fishingCount: 0,
        summary: '',
      },
      maritimeOverview: {
        totalTracked: 2,
        highPriorityTracked: 0,
        underwayCount: 1,
        anchoredCount: 1,
        summary: '2 tracked · 1 underway · 1 anchored',
      },
    });

    expect(model.infrastructure.affectedCount).toBe(0);
    expect(model.infrastructure.groups).toEqual([]);
    expect(model.maritime.inImpactZone).toBe(0);
    expect(model.maritime.summary).toBe('2 tracked · 1 underway · 1 anchored');
  });
});
