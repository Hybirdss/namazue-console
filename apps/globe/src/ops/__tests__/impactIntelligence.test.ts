import { describe, expect, it } from 'vitest';

import type { EarthquakeEvent, IntensityGrid } from '../../types';
import type { Municipality } from '../../data/municipalities';
import {
  computeImpactIntelligence,
  computeLandPeakIntensity,
  computePopulationExposure,
} from '../impactIntelligence';

function createEvent(): EarthquakeEvent {
  return {
    id: 'eq-test',
    lat: 38.322,
    lng: 142.369,
    depth_km: 24,
    magnitude: 9.0,
    time: Date.parse('2011-03-11T05:46:00.000Z'),
    faultType: 'interface',
    tsunami: true,
    place: { text: 'Off the Pacific coast of Tohoku' },
    observedIntensity: '7',
  };
}

function createLowIntensityGrid(): IntensityGrid {
  const cols = 5;
  const rows = 5;
  return {
    cols,
    rows,
    center: { lat: 38.322, lng: 142.369 },
    radiusDeg: 2,
    radiusLngDeg: 2,
    data: new Float32Array(cols * rows).fill(2.1),
  };
}

function createFootprintEdgeCaseGrid(): IntensityGrid {
  const cols = 9;
  const rows = 9;
  const data = new Float32Array(cols * rows).fill(4.2);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (row <= 3 || col >= 5) {
        data[row * cols + col] = 5.4;
      }
      if (row <= 2 && col >= 6) {
        data[row * cols + col] = 6.2;
      }
    }
  }

  data[4 * cols + 4] = 4.2;

  return {
    cols,
    rows,
    center: { lat: 38.322, lng: 142.369 },
    radiusDeg: 0.2,
    radiusLngDeg: 0.2,
    data,
  };
}

function createTestMunicipality(): Municipality {
  return {
    name: '테스트시',
    nameEn: 'Test City',
    lat: 38.322,
    lng: 142.369,
    population: 1_000_000,
    prefectureId: 'miyagi',
  };
}

describe('computeImpactIntelligence', () => {
  it('derives land peak and population exposure from the authoritative hazard field instead of re-running point-source GMPE', () => {
    const intel = computeImpactIntelligence({
      event: createEvent(),
      grid: createLowIntensityGrid(),
      vessels: [],
    });

    expect(intel.landPeakIntensity).toBeNull();
    expect(intel.populationExposure?.jma3plus).toBe(0);
    expect(intel.populationExposure?.topAffected).toEqual([]);
  });

  it('counts only the impacted share of a municipality when strong shaking sits off-centroid inside the municipal footprint', () => {
    const municipality = createTestMunicipality();
    const exposure = computePopulationExposure(
      createFootprintEdgeCaseGrid(),
      'scenario_official',
      [municipality],
    );

    expect(exposure).not.toBeNull();
    expect(exposure?.jma5plus).toBeGreaterThan(0);
    expect(exposure?.jma5plus).toBeLessThan(municipality.population);
    expect(exposure?.topMunicipalitiesByThreshold?.['5+'].map((city) => city.name)).toContain('테스트시');
  });

  it('uses the municipal footprint rather than only the centroid when deriving land peak intensity', () => {
    const landPeak = computeLandPeakIntensity(
      createFootprintEdgeCaseGrid(),
      [createTestMunicipality()],
    );

    expect(landPeak).not.toBeNull();
    expect(landPeak?.cityName).toBe('테스트시');
    expect(['6-', '6+', '7']).toContain(landPeak?.jmaClass);
    expect(landPeak?.value).toBeGreaterThan(5.5);
  });
});
