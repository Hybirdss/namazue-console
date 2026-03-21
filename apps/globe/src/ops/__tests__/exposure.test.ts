import { describe, expect, it } from 'vitest';

import type { IntensityGrid, TsunamiAssessment } from '../../types';
import { buildAssetExposures } from '../exposure';
import type { OpsAsset } from '../types';

function makeUniformGrid(value: number): IntensityGrid {
  return {
    data: new Float32Array([
      value, value, value,
      value, value, value,
      value, value, value,
    ]),
    cols: 3,
    rows: 3,
    center: { lat: 35.62, lng: 139.79 },
    radiusDeg: 0.2,
  };
}

const MODERATE_TSUNAMI: TsunamiAssessment = {
  risk: 'moderate',
  confidence: 'high',
  factors: ['Coastal offshore event'],
  locationType: 'near_coast',
  coastDistanceKm: 12,
  faultType: 'interface',
};

const NO_TSUNAMI: TsunamiAssessment = {
  risk: 'none',
  confidence: 'high',
  factors: [],
  locationType: 'inland',
  coastDistanceKm: 80,
  faultType: 'crustal',
};

describe('buildAssetExposures', () => {
  it('elevates a coastal port when shaking and tsunami posture overlap', () => {
    const assets: OpsAsset[] = [
      {
        id: 'tokyo-port',
        metro: 'tokyo',
        region: 'kanto',
        class: 'port',
        name: 'Port of Tokyo',
        lat: 35.617,
        lng: 139.794,
        tags: ['coastal'],
        minZoomTier: 'national',
      },
    ];

    const exposures = buildAssetExposures({
      grid: makeUniformGrid(5.3),
      assets,
      tsunamiAssessment: MODERATE_TSUNAMI,
    });

    expect(exposures[0]).toMatchObject({
      assetId: 'tokyo-port',
      severity: 'critical',
    });
    expect(exposures[0]?.reasons.join(' ')).toContain('tsunami');
  });

  it('keeps a low-shaking hospital in clear posture', () => {
    const assets: OpsAsset[] = [
      {
        id: 'tokyo-hospital',
        metro: 'tokyo',
        region: 'kanto',
        class: 'hospital',
        name: 'Tokyo Hospital',
        lat: 35.617,
        lng: 139.794,
        tags: ['medical'],
        minZoomTier: 'city',
      },
    ];

    const exposures = buildAssetExposures({
      grid: makeUniformGrid(2.0),
      assets,
      tsunamiAssessment: NO_TSUNAMI,
    });

    expect(exposures[0]).toMatchObject({
      assetId: 'tokyo-hospital',
      severity: 'clear',
    });
  });

  it('sorts higher-impact assets ahead of lower-impact ones', () => {
    const assets: OpsAsset[] = [
      {
        id: 'tokyo-port',
        metro: 'tokyo',
        region: 'kanto',
        class: 'port',
        name: 'Port of Tokyo',
        lat: 35.617,
        lng: 139.794,
        tags: ['coastal'],
        minZoomTier: 'national',
      },
      {
        id: 'tokyo-hospital',
        metro: 'tokyo',
        region: 'kanto',
        class: 'hospital',
        name: 'Tokyo Hospital',
        lat: 35.617,
        lng: 139.794,
        tags: ['medical'],
        minZoomTier: 'city',
      },
    ];

    const exposures = buildAssetExposures({
      grid: makeUniformGrid(4.8),
      assets,
      tsunamiAssessment: MODERATE_TSUNAMI,
    });

    expect(exposures[0]?.assetId).toBe('tokyo-port');
    expect(exposures[1]?.assetId).toBe('tokyo-hospital');
  });

  it('scores lifeline and built-environment asset classes through fragility curves', () => {
    const assets = [
      {
        id: 'tokyo-east-substation',
        region: 'kanto',
        class: 'power_substation',
        name: 'Tokyo East Substation',
        lat: 35.617,
        lng: 139.794,
        tags: ['power', 'grid'],
        minZoomTier: 'regional',
      },
      {
        id: 'toyosu-water',
        region: 'kanto',
        class: 'water_facility',
        name: 'Toyosu Water Purification Center',
        lat: 35.617,
        lng: 139.794,
        tags: ['water', 'lifeline'],
        minZoomTier: 'regional',
      },
      {
        id: 'marunouchi-core',
        region: 'kanto',
        class: 'building_cluster',
        name: 'Marunouchi Core',
        lat: 35.617,
        lng: 139.794,
        tags: ['urban', 'buildings'],
        minZoomTier: 'city',
      },
    ] as unknown as OpsAsset[];

    const exposures = buildAssetExposures({
      grid: makeUniformGrid(4.9),
      assets,
      tsunamiAssessment: NO_TSUNAMI,
    });

    // Power substations are most fragile at this intensity (lowest disruption mu)
    expect(exposures[0]?.assetId).toBe('tokyo-east-substation');
    expect(exposures[0]).toMatchObject({
      severity: 'priority',
    });
    // Operational concerns should appear in reasons
    expect(exposures[0]?.reasons).toContain('grid stability risk');

    // Water facility — intermediate fragility
    expect(exposures[1]?.assetId).toBe('toyosu-water');
    expect(exposures[1]).toMatchObject({
      severity: 'priority',
    });
    expect(exposures[1]?.reasons).toContain('service continuity risk');

    // Building cluster — highest disruption threshold (mu=5.0), less vulnerable
    expect(exposures[2]?.assetId).toBe('marunouchi-core');
    expect(exposures[2]).toMatchObject({
      severity: 'priority',
    });
    expect(exposures[2]?.reasons).toContain('urban structure inspection');
  });

  it('assigns critical severity at JMA 6+ for vulnerable infrastructure', () => {
    const assets = [
      {
        id: 'hamaoka-nuclear',
        region: 'kanto',
        class: 'nuclear_plant',
        name: 'Hamaoka Nuclear Plant',
        lat: 35.617,
        lng: 139.794,
        tags: ['nuclear'],
        minZoomTier: 'national',
      },
    ] as unknown as OpsAsset[];

    const exposures = buildAssetExposures({
      grid: makeUniformGrid(6.2),
      assets,
      tsunamiAssessment: NO_TSUNAMI,
    });

    // At JMA 6.2, nuclear plant should be critical
    // P(damage) for nuclear: Phi((6.2-5.8)/0.4) = Phi(1.0) ≈ 0.84 >> 0.50
    expect(exposures[0]).toMatchObject({
      assetId: 'hamaoka-nuclear',
      severity: 'critical',
    });
    expect(exposures[0]?.reasons).toContain('beyond-design-basis event assessment');
  });

  it('returns clear severity when all damage probabilities are negligible', () => {
    const assets = [
      {
        id: 'marunouchi-core',
        region: 'kanto',
        class: 'building_cluster',
        name: 'Marunouchi Core',
        lat: 35.617,
        lng: 139.794,
        tags: ['urban'],
        minZoomTier: 'city',
      },
    ] as unknown as OpsAsset[];

    const exposures = buildAssetExposures({
      grid: makeUniformGrid(3.0),
      assets,
      tsunamiAssessment: NO_TSUNAMI,
    });

    // At JMA 3.0, building cluster should be clear
    // P(disruption) for building: Phi((3.0-5.0)/0.6) = Phi(-3.33) ≈ 0.0004
    expect(exposures[0]).toMatchObject({
      severity: 'clear',
    });
  });

  it('escalates hospital severity via lifeline cascade when power is damaged in same region', () => {
    // At JMA 5.5:
    //   power_substation pDamage: Phi((5.5-5.3)/0.45) = Phi(0.44) ≈ 0.67 (significant)
    //   hospital base pDisruption: Phi((5.5-4.5)/0.5) = Phi(2.0) ≈ 0.977
    //   water_facility pDamage: Phi((5.5-5.5)/0.45) = Phi(0) = 0.50
    //
    // Without cascade: hospital pDisruption ≈ 0.977
    // With cascade (power 0.6*0.67 + water 0.4*0.50 = 0.602):
    //   effective = 1 - (1 - 0.977)(1 - 0.602) ≈ 0.991
    //
    // The cascade should appear in the reasons.
    const assets: OpsAsset[] = [
      {
        id: 'kanto-substation',
        region: 'kanto',
        class: 'power_substation',
        name: 'Kanto Substation',
        lat: 35.617,
        lng: 139.794,
        tags: ['power'],
        minZoomTier: 'regional',
      },
      {
        id: 'kanto-water',
        region: 'kanto',
        class: 'water_facility',
        name: 'Kanto Water Plant',
        lat: 35.617,
        lng: 139.794,
        tags: ['water'],
        minZoomTier: 'regional',
      },
      {
        id: 'kanto-hospital',
        region: 'kanto',
        class: 'hospital',
        name: 'Kanto Hospital',
        lat: 35.617,
        lng: 139.794,
        tags: ['medical'],
        minZoomTier: 'city',
      },
    ] as unknown as OpsAsset[];

    const exposures = buildAssetExposures({
      grid: makeUniformGrid(5.5),
      assets,
      tsunamiAssessment: NO_TSUNAMI,
    });

    const hospital = exposures.find((e) => e.assetId === 'kanto-hospital');
    expect(hospital).toBeDefined();
    // Should have cascade reason
    expect(hospital!.reasons.join(' ')).toContain('cascade');
    // Should have elevated disruption due to cascade
    expect(hospital!.damageProbs!.pDisruption).toBeGreaterThan(0.98);
  });

  it('does not cascade to assets in different regions', () => {
    const assets: OpsAsset[] = [
      {
        id: 'kanto-substation',
        region: 'kanto',
        class: 'power_substation',
        name: 'Kanto Substation',
        lat: 35.617,
        lng: 139.794,
        tags: ['power'],
        minZoomTier: 'regional',
      },
      {
        id: 'kansai-hospital',
        region: 'kansai',
        class: 'hospital',
        name: 'Kansai Hospital',
        lat: 35.617,
        lng: 139.794,
        tags: ['medical'],
        minZoomTier: 'city',
      },
    ] as unknown as OpsAsset[];

    const exposures = buildAssetExposures({
      grid: makeUniformGrid(5.5),
      assets,
      tsunamiAssessment: NO_TSUNAMI,
    });

    const hospital = exposures.find((e) => e.assetId === 'kansai-hospital');
    expect(hospital).toBeDefined();
    // Should NOT have cascade reason — different region
    expect(hospital!.reasons.join(' ')).not.toContain('cascade');
  });
});
