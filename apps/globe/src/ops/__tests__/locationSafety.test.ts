import { describe, expect, it } from 'vitest';

import type { Municipality } from '../../data/municipalities';
import type { EarthquakeEvent, IntensityGrid } from '../../types';
import { buildLocationSafety } from '../locationSafety';

const NOW = Date.parse('2026-03-10T12:00:00.000Z');

const PLACE: Municipality = {
  name: '仙台市',
  nameEn: 'Sendai',
  lat: 38.2682,
  lng: 140.8694,
  population: 1_096_704,
  prefectureId: 'miyagi',
};

const SELECTED_EVENT: EarthquakeEvent = {
  id: 'eq-1',
  lat: 38.1,
  lng: 142.0,
  depth_km: 30,
  magnitude: 6.8,
  time: NOW - 10 * 60_000,
  faultType: 'interface',
  tsunami: false,
  place: { text: 'Off Miyagi' },
};

const GRID: IntensityGrid = {
  cols: 2,
  rows: 2,
  center: { lat: PLACE.lat, lng: PLACE.lng },
  radiusDeg: 0.2,
  radiusLngDeg: 0.2,
  data: new Float32Array([4.2, 4.2, 4.2, 4.2]),
};

describe('buildLocationSafety', () => {
  it('elevates overall tone to danger when selected-event shaking crosses JMA 4', () => {
    const model = buildLocationSafety({
      place: PLACE,
      selectedEvent: SELECTED_EVENT,
      intensityGrid: GRID,
      events: [],
      now: NOW,
    });

    expect(model.overall.tone).toBe('danger');
    expect(model.overall.driver).toBe('selected-event');
    expect(model.selectedEvent?.estimatedJma).toBeGreaterThanOrEqual(4);
    expect(model.nearbyRecent.tone).toBe('safe');
  });

  it('elevates nearby activity to caution when multiple recent events cluster near the place', () => {
    const model = buildLocationSafety({
      place: PLACE,
      selectedEvent: null,
      intensityGrid: null,
      now: NOW,
      events: [
        { ...SELECTED_EVENT, id: 'a', magnitude: 4.1, lat: 38.25, lng: 140.8, time: NOW - 60_000 },
        { ...SELECTED_EVENT, id: 'b', magnitude: 3.9, lat: 38.22, lng: 140.85, time: NOW - 120_000 },
        { ...SELECTED_EVENT, id: 'c', magnitude: 3.7, lat: 38.29, lng: 140.91, time: NOW - 180_000 },
      ],
    });

    expect(model.overall.tone).toBe('caution');
    expect(model.overall.driver).toBe('nearby-activity');
    expect(model.selectedEvent).toBeNull();
    expect(model.nearbyRecent.tone).toBe('caution');
    expect(model.nearbyRecent.count24h).toBe(3);
    expect(model.nearbyRecent.maxMagnitude).toBe(4.1);
    expect(model.nearbyRecent.nearestDistanceKm).toBeLessThan(10);
  });
});
