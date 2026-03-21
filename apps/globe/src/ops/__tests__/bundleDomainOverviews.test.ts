import { describe, expect, it } from 'vitest';

import { buildDefaultBundleDomainOverviews } from '../bundleDomainOverviews';
import type { OpsAsset, OpsAssetExposure, OpsPriority } from '../types';
import type { RailLineStatus } from '../../types';

describe('buildDefaultBundleDomainOverviews', () => {
  it('derives lifeline and built-environment overviews from future asset class families', () => {
    const assets = [
      {
        id: 'tokyo-east-substation',
        region: 'kanto',
        class: 'power_substation',
        name: 'Tokyo East Substation',
        lat: 35.65,
        lng: 139.83,
        tags: ['power', 'grid'],
        minZoomTier: 'regional',
      },
      {
        id: 'toyosu-water',
        region: 'kanto',
        class: 'water_facility',
        name: 'Toyosu Water Purification Center',
        lat: 35.64,
        lng: 139.81,
        tags: ['water', 'lifeline'],
        minZoomTier: 'regional',
      },
      {
        id: 'marunouchi-core',
        region: 'kanto',
        class: 'building_cluster',
        name: 'Marunouchi Core',
        lat: 35.68,
        lng: 139.76,
        tags: ['urban', 'buildings'],
        minZoomTier: 'city',
      },
    ] as unknown as OpsAsset[];

    const exposures: OpsAssetExposure[] = [
      {
        assetId: 'tokyo-east-substation',
        severity: 'critical',
        score: 93,
        summary: 'Tokyo East Substation is in critical posture.',
        reasons: ['strong shaking overlap', 'grid stability risk'],
      },
      {
        assetId: 'toyosu-water',
        severity: 'priority',
        score: 66,
        summary: 'Toyosu Water Purification Center is in priority posture.',
        reasons: ['moderate shaking overlap', 'service continuity risk'],
      },
      {
        assetId: 'marunouchi-core',
        severity: 'watch',
        score: 44,
        summary: 'Marunouchi Core is in watch posture.',
        reasons: ['moderate shaking overlap', 'urban structure inspection'],
      },
    ];

    const priorities: OpsPriority[] = [
      {
        id: 'priority-substation',
        assetId: 'tokyo-east-substation',
        severity: 'critical',
        title: 'Verify Tokyo East Substation power posture',
        rationale: 'Kanto power substation posture is critical because strong shaking overlap, grid stability risk.',
      },
      {
        id: 'priority-water',
        assetId: 'toyosu-water',
        severity: 'priority',
        title: 'Verify Toyosu Water Purification Center water posture',
        rationale: 'Kanto water facility posture is priority because moderate shaking overlap, service continuity risk.',
      },
      {
        id: 'priority-buildings',
        assetId: 'marunouchi-core',
        severity: 'watch',
        title: 'Review Marunouchi Core built-environment posture',
        rationale: 'Kanto building cluster posture is watch because moderate shaking overlap, urban structure inspection.',
      },
    ];

    const overviews = buildDefaultBundleDomainOverviews({
      priorities,
      exposures,
      assets,
      trustLevel: 'review',
    });

    expect(overviews.lifelines).toMatchObject({
      metric: '2 lifeline check queued',
      detail: 'Verify Tokyo East Substation power posture',
      severity: 'critical',
      availability: 'modeled',
      trust: 'review',
    });
    expect(overviews.lifelines?.counters).toEqual([
      { id: 'checks', label: 'Checks', value: 2, tone: 'critical' },
      { id: 'lifeline-sites', label: 'Lifeline Sites', value: 2, tone: 'critical' },
      { id: 'power-nodes', label: 'Power Nodes', value: 1, tone: 'critical' },
      { id: 'water-sites', label: 'Water Sites', value: 1, tone: 'priority' },
    ]);
    expect(overviews.lifelines?.signals).toEqual([
      { id: 'source', label: 'Source', value: 'Modeled from seismic exposure', tone: 'watch' },
      { id: 'next-check', label: 'Next Check', value: 'Verify Tokyo East Substation power posture', tone: 'critical' },
      { id: 'lifeline-region', label: 'Region', value: 'Kanto', tone: 'critical' },
      { id: 'primary-domain', label: 'Primary Domain', value: 'Power', tone: 'critical' },
      { id: 'water-posture', label: 'Water Posture', value: '1 water sites in elevated posture', tone: 'priority' },
      { id: 'power-posture', label: 'Power Posture', value: '1 power nodes in elevated posture', tone: 'critical' },
    ]);
    expect(overviews.lifelines?.domains?.map((domain) => domain.id)).toEqual(expect.arrayContaining(['power', 'water']));
    expect(overviews['built-environment']).toMatchObject({
      metric: '1 urban integrity review queued',
      detail: 'Review Marunouchi Core built-environment posture',
      severity: 'watch',
      availability: 'live',
      trust: 'review',
    });
    expect(overviews['built-environment']?.counters).toEqual([
      { id: 'checks', label: 'Checks', value: 1, tone: 'watch' },
      { id: 'building-clusters', label: 'Building Clusters', value: 1, tone: 'watch' },
    ]);
    expect(overviews['built-environment']?.signals).toEqual([
      { id: 'next-check', label: 'Next Check', value: 'Review Marunouchi Core built-environment posture', tone: 'watch' },
      { id: 'built-environment-region', label: 'Region', value: 'Kanto', tone: 'watch' },
      { id: 'primary-domain', label: 'Primary Domain', value: 'Built Environment', tone: 'watch' },
    ]);
  });

  it('promotes live rail telemetry into lifelines when no exposed lifeline assets are active yet', () => {
    const railStatuses: RailLineStatus[] = [
      {
        lineId: 'tokaido',
        status: 'delayed',
        cause: 'Weather inspection',
        updatedAt: 1_700_000_000_000,
      },
      {
        lineId: 'sanyo',
        status: 'normal',
        updatedAt: 1_700_000_000_000,
      },
    ];

    const overviews = buildDefaultBundleDomainOverviews({
      priorities: [],
      exposures: [],
      assets: [],
      trustLevel: 'review',
      railStatuses,
    });

    expect(overviews.lifelines).toMatchObject({
      metric: '1 rail corridors delayed',
      detail: 'Tokaido Shinkansen is reporting delays due to Weather inspection.',
      severity: 'watch',
      availability: 'live',
      trust: 'review',
    });
    expect(overviews.lifelines?.counters).toEqual([
      { id: 'rail-monitored', label: 'Monitored', value: 2, tone: 'clear' },
      { id: 'rail-delayed', label: 'Delayed', value: 1, tone: 'watch' },
    ]);
    expect(overviews.lifelines?.signals).toEqual([
      { id: 'rail-feed', label: 'Rail Feed', value: 'Live ODPT', tone: 'watch' },
      { id: 'rail-network-state', label: 'Network State', value: 'Delayed', tone: 'watch' },
      { id: 'rail-primary-line', label: 'Primary Corridor', value: 'Tokaido Shinkansen', tone: 'watch' },
      { id: 'rail-cause', label: 'Reported Cause', value: 'Weather inspection', tone: 'watch' },
    ]);
    expect(overviews.lifelines?.domains).toEqual([
      {
        id: 'rail',
        label: 'Rail',
        metric: '1 rail corridors delayed',
        detail: 'Tokaido Shinkansen is reporting delays due to Weather inspection.',
        severity: 'watch',
        availability: 'live',
        trust: 'review',
        counters: [
          { id: 'rail-monitored', label: 'Monitored', value: 2, tone: 'clear' },
          { id: 'rail-delayed', label: 'Delayed', value: 1, tone: 'watch' },
        ],
        signals: [
          { id: 'rail-feed', label: 'Rail Feed', value: 'Live ODPT', tone: 'watch' },
          { id: 'rail-network-state', label: 'Network State', value: 'Delayed', tone: 'watch' },
          { id: 'rail-primary-line', label: 'Primary Corridor', value: 'Tokaido Shinkansen', tone: 'watch' },
          { id: 'rail-cause', label: 'Reported Cause', value: 'Weather inspection', tone: 'watch' },
        ],
      },
    ]);
  });

  it('downgrades rail trust when the rail component reports stale last-known-good telemetry', () => {
    const railStatuses: RailLineStatus[] = [
      {
        lineId: 'tokaido',
        status: 'normal',
        updatedAt: 1_700_000_000_000,
      },
      {
        lineId: 'sanyo',
        status: 'normal',
        updatedAt: 1_700_000_000_000,
      },
    ];

    const overviews = buildDefaultBundleDomainOverviews({
      priorities: [],
      exposures: [],
      assets: [],
      trustLevel: 'confirmed',
      railStatuses,
      railComponent: {
        id: 'rail',
        label: 'Rail',
        state: 'stale',
        source: 'odpt',
        updatedAt: 1_699_999_940_000,
        staleAfterMs: 60_000,
        message: 'Rail telemetry is stale; using last confirmed corridor state.',
      },
    });

    expect(overviews.lifelines).toMatchObject({
      metric: '2 rail corridors nominal',
      detail: expect.stringContaining('stale'),
      severity: 'watch',
      availability: 'live',
      trust: 'review',
    });
    expect(overviews.lifelines?.signals).toEqual(expect.arrayContaining([
      { id: 'rail-feed', label: 'Rail Feed', value: 'Stale ODPT', tone: 'watch' },
    ]));
    expect(overviews.lifelines?.domains).toEqual([
      expect.objectContaining({
        id: 'rail',
        metric: '2 rail corridors nominal',
        detail: expect.stringContaining('last confirmed corridor state'),
        trust: 'review',
        signals: expect.arrayContaining([
          { id: 'rail-feed', label: 'Rail Feed', value: 'Stale ODPT', tone: 'watch' },
        ]),
      }),
    ]);
  });

  it('surfaces modeled water posture from facility intensity before explicit water exposures land', () => {
    const assets = [
      {
        id: 'toyosu-water',
        region: 'kanto',
        class: 'water_facility',
        name: 'Toyosu Water Purification Center',
        lat: 35.64,
        lng: 139.81,
        tags: ['water', 'lifeline'],
        minZoomTier: 'regional',
      },
    ] as unknown as OpsAsset[];

    const overviews = buildDefaultBundleDomainOverviews({
      priorities: [],
      exposures: [],
      assets,
      trustLevel: 'confirmed',
      selectedEvent: {
        id: 'tokyo-bay-water',
        lat: 35.62,
        lng: 139.79,
        depth_km: 18,
        magnitude: 6.8,
        time: 1_700_000_000_000,
        faultType: 'interface',
        tsunami: false,
        place: { text: 'Tokyo Bay' },
      },
    });

    expect(overviews.lifelines).toMatchObject({
      metric: '1 water sites in continuity review',
      detail: 'Toyosu Water Purification Center is estimated at JMA 5.2 and requires distribution verification.',
      severity: 'priority',
      availability: 'modeled',
      trust: 'review',
    });
    expect(overviews.lifelines?.counters).toEqual([
      { id: 'water-sites', label: 'Water Sites', value: 1, tone: 'priority' },
      { id: 'water-review', label: 'Continuity Review', value: 1, tone: 'priority' },
    ]);
    expect(overviews.lifelines?.signals).toEqual(expect.arrayContaining([
      { id: 'source', label: 'Source', value: 'Modeled from seismic exposure', tone: 'watch' },
      { id: 'primary-facility', label: 'Primary Facility', value: 'Toyosu Water Purification Center', tone: 'priority' },
      { id: 'water-region', label: 'Water Region', value: 'Kanto', tone: 'priority' },
      { id: 'estimated-intensity', label: 'Estimated Intensity', value: 'JMA 5.2', tone: 'priority' },
      { id: 'network-posture', label: 'Network Posture', value: 'Continuity Review', tone: 'priority' },
    ]));
    expect(overviews.lifelines?.domains?.map((domain) => domain.id)).toEqual(expect.arrayContaining(['water', 'power']));
  });

  it('promotes modeled power posture into lifelines and keeps rail telemetry as a secondary domain', () => {
    const overviews = buildDefaultBundleDomainOverviews({
      priorities: [],
      exposures: [],
      assets: [],
      trustLevel: 'confirmed',
      selectedEvent: {
        id: 'power-onagawa',
        lat: 38.4,
        lng: 141.5,
        depth_km: 15,
        magnitude: 7.8,
        time: 1_700_000_000_000,
        faultType: 'interface',
        tsunami: true,
        place: { text: 'Off Onagawa' },
      },
      railStatuses: [
        { lineId: 'tokaido', status: 'normal', updatedAt: 1_700_000_000_000 },
        { lineId: 'sanyo', status: 'normal', updatedAt: 1_700_000_000_000 },
      ],
    });
    const lifelineDomains = overviews.lifelines?.domains ?? [];

    expect(overviews.lifelines).toMatchObject({
      metric: '1 nuclear SCRAM likely',
      detail: 'Onagawa is estimated near SCRAM thresholds at ~301 gal.',
      severity: 'critical',
      availability: 'live',
      trust: 'review',
    });
    expect(overviews.lifelines?.counters).toEqual([
      { id: 'scram-likely', label: 'SCRAM Likely', value: 1, tone: 'critical' },
      { id: 'plants-in-zone', label: 'Plants In Zone', value: 11, tone: 'critical' },
    ]);
    expect(overviews.lifelines?.signals).toEqual(expect.arrayContaining([
      { id: 'source', label: 'Source', value: 'Modeled from seismic exposure', tone: 'watch' },
      { id: 'primary-plant', label: 'Primary Plant', value: 'Onagawa', tone: 'critical' },
      { id: 'power-region', label: 'Power Region', value: 'Tohoku', tone: 'critical' },
      { id: 'estimated-pga', label: 'Estimated PGA', value: '~301 gal', tone: 'critical' },
    ]));
    expect(lifelineDomains.map((domain) => domain.id)).toEqual(expect.arrayContaining(['power', 'rail']));
    expect(lifelineDomains[0]).toMatchObject({
      id: 'power',
      metric: '1 nuclear SCRAM likely',
      availability: 'live',
      trust: 'review',
    });
    expect(lifelineDomains[1]).toMatchObject({
      id: 'rail',
      metric: '2 rail corridors nominal',
      trust: 'confirmed',
    });
  });
});
