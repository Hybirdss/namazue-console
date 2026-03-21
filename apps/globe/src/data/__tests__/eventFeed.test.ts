import { describe, expect, it } from 'vitest';

import { serverEventToEq } from '../eventFeed';

describe('eventFeed', () => {
  it('normalizes server events into canonical earthquake events', () => {
    const event = serverEventToEq({
      id: 'evt-1',
      lat: 35.68,
      lng: 139.76,
      depth_km: 12,
      magnitude: 5.8,
      time: '2026-03-08T00:00:00.000Z',
      place: null,
      fault_type: 'interface',
      source: 'jma',
      tsunami: true,
    });

    expect(event).toEqual({
      id: 'evt-1',
      lat: 35.68,
      lng: 139.76,
      depth_km: 12,
      magnitude: 5.8,
      time: Date.parse('2026-03-08T00:00:00.000Z'),
      source: 'jma',
      faultType: 'interface',
      tsunami: true,
      place: { text: 'Unknown location' },
      mtStrike: null,
      observedIntensity: null,
    });
  });
});
