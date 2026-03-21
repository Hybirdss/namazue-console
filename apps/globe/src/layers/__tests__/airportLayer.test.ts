import { describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import { AIRPORTS, createAirportLayers, formatAirportTooltip } from '../airportLayer';

function createEvent(
  overrides: Partial<EarthquakeEvent> = {},
): EarthquakeEvent {
  return {
    id: 'eq-airport',
    lat: 35.5533,
    lng: 139.7811,
    depth_km: 12,
    magnitude: 7.2,
    time: Date.parse('2026-03-10T01:00:00.000Z'),
    faultType: 'crustal',
    tsunami: false,
    place: { text: 'Tokyo Bay' },
    ...overrides,
  };
}

describe('airportLayer', () => {
  it('stays hidden below the national operations zoom band', () => {
    expect(createAirportLayers(null, 4.9)).toEqual([]);
  });

  it('computes a closure posture for airports at the event site', () => {
    const layers = createAirportLayers(createEvent(), 7);
    const markerLayer = layers.find((layer) => layer.id === 'airports');
    const airports = markerLayer?.props.data as Array<{ id: string; posture: string }> | undefined;
    const haneda = airports?.find((airport) => airport.id === 'apt-haneda');

    expect(haneda?.posture).toBe('closed');
  });

  it('formats tooltip with operational posture messaging', () => {
    const tooltip = formatAirportTooltip(AIRPORTS.find((airport) => airport.id === 'apt-haneda')!, createEvent());

    expect(tooltip).toContain('Haneda (HND)');
    expect(tooltip).toContain('CLOSED');
    expect(tooltip).toContain('Est. intensity');
  });
});
