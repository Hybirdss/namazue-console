import { describe, expect, it } from 'vitest';

import { setLocale } from '../../i18n';
import type { Municipality } from '../../data/municipalities';
import { renderLocationSafetyCardMarkup } from '../locationSafetyCard';

const PLACE: Municipality = {
  name: '仙台市',
  nameEn: 'Sendai',
  lat: 38.2682,
  lng: 140.8694,
  population: 1_096_704,
  prefectureId: 'miyagi',
};

describe('renderLocationSafetyCardMarkup', () => {
  it('renders danger posture, selected-event intensity, and nearby activity', () => {
    setLocale('en');

    const markup = renderLocationSafetyCardMarkup({
      place: PLACE,
      overall: {
        tone: 'danger',
        driver: 'selected-event',
      },
      selectedEvent: {
        tone: 'danger',
        estimatedJma: 4.2,
        distanceKm: 92,
        magnitude: 6.8,
        eventId: 'eq-1',
      },
      nearbyRecent: {
        tone: 'caution',
        count24h: 3,
        maxMagnitude: 4.6,
        nearestDistanceKm: 22,
        strongestEventId: 'eq-2',
      },
    });

    expect(markup).toContain('nz-location-safety--danger');
    expect(markup).toContain('Sendai');
    expect(markup).toContain('M6.8');
    expect(markup).toContain('JMA 4.2');
    expect(markup).toContain('3 events');
    expect(markup).toContain('24h nearby activity');
  });

  it('renders an explicit empty selected-event state when no event is active', () => {
    setLocale('en');

    const markup = renderLocationSafetyCardMarkup({
      place: PLACE,
      overall: {
        tone: 'safe',
        driver: 'none',
      },
      selectedEvent: null,
      nearbyRecent: {
        tone: 'safe',
        count24h: 0,
        maxMagnitude: null,
        nearestDistanceKm: null,
        strongestEventId: null,
      },
    });

    expect(markup).toContain('No selected event');
    expect(markup).toContain('No nearby events in the last 24 hours');
  });
});
