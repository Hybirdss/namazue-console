import type { Municipality } from '../data/municipalities';
import { haversine } from '../engine/gmpe';
import { estimateSiteIntensity } from './siteIntensity';
import type { EarthquakeEvent, IntensityGrid } from '../types';

export type LocationSafetyTone = 'safe' | 'caution' | 'danger';
export type LocationSafetyDriver = 'selected-event' | 'nearby-activity' | 'mixed' | 'none';

const DAY_MS = 24 * 60 * 60 * 1000;
const NEARBY_RADIUS_KM = 80;

export interface SelectedEventLocationSafety {
  tone: LocationSafetyTone;
  estimatedJma: number;
  distanceKm: number;
  magnitude: number;
  eventId: string;
}

export interface NearbyRecentLocationSafety {
  tone: LocationSafetyTone;
  count24h: number;
  maxMagnitude: number | null;
  nearestDistanceKm: number | null;
  strongestEventId: string | null;
}

export interface LocationSafetyModel {
  place: Municipality;
  overall: {
    tone: LocationSafetyTone;
    driver: LocationSafetyDriver;
  };
  selectedEvent: SelectedEventLocationSafety | null;
  nearbyRecent: NearbyRecentLocationSafety;
}

export interface BuildLocationSafetyInput {
  place: Municipality;
  selectedEvent: EarthquakeEvent | null;
  intensityGrid?: IntensityGrid | null;
  events: EarthquakeEvent[];
  now?: number;
}

function toneRank(tone: LocationSafetyTone): number {
  switch (tone) {
    case 'danger':
      return 2;
    case 'caution':
      return 1;
    default:
      return 0;
  }
}

function toneFromJma(estimatedJma: number): LocationSafetyTone {
  if (estimatedJma >= 4) return 'danger';
  if (estimatedJma >= 3) return 'caution';
  return 'safe';
}

function toneFromNearby(count24h: number, maxMagnitude: number | null): LocationSafetyTone {
  if ((maxMagnitude ?? 0) >= 5) return 'danger';
  if ((maxMagnitude ?? 0) >= 4 || count24h >= 3) return 'caution';
  return 'safe';
}

function buildSelectedEventSignal(
  place: Municipality,
  selectedEvent: EarthquakeEvent | null,
  intensityGrid: IntensityGrid | null | undefined,
): SelectedEventLocationSafety | null {
  if (!selectedEvent) {
    return null;
  }

  const estimatedJma = estimateSiteIntensity(selectedEvent, place.lat, place.lng, intensityGrid);
  const distanceKm = haversine(selectedEvent.lat, selectedEvent.lng, place.lat, place.lng);

  return {
    tone: toneFromJma(estimatedJma),
    estimatedJma,
    distanceKm,
    magnitude: selectedEvent.magnitude,
    eventId: selectedEvent.id,
  };
}

function buildNearbyRecentSignal(
  place: Municipality,
  events: EarthquakeEvent[],
  now: number,
): NearbyRecentLocationSafety {
  const recentNearby = events
    .map((event) => ({
      event,
      distanceKm: haversine(place.lat, place.lng, event.lat, event.lng),
    }))
    .filter(({ event, distanceKm }) => now - event.time <= DAY_MS && distanceKm <= NEARBY_RADIUS_KM);

  let maxMagnitude: number | null = null;
  let strongestEventId: string | null = null;
  let nearestDistanceKm: number | null = null;

  for (const entry of recentNearby) {
    if (maxMagnitude === null || entry.event.magnitude > maxMagnitude) {
      maxMagnitude = entry.event.magnitude;
      strongestEventId = entry.event.id;
    }
    if (nearestDistanceKm === null || entry.distanceKm < nearestDistanceKm) {
      nearestDistanceKm = entry.distanceKm;
    }
  }

  return {
    tone: toneFromNearby(recentNearby.length, maxMagnitude),
    count24h: recentNearby.length,
    maxMagnitude,
    nearestDistanceKm,
    strongestEventId,
  };
}

function deriveOverallDriver(
  selectedEvent: SelectedEventLocationSafety | null,
  nearbyRecent: NearbyRecentLocationSafety,
  overallTone: LocationSafetyTone,
): LocationSafetyDriver {
  if (overallTone === 'safe') {
    return 'none';
  }

  const selectedRank = selectedEvent ? toneRank(selectedEvent.tone) : -1;
  const nearbyRank = toneRank(nearbyRecent.tone);

  if (selectedRank > nearbyRank) return 'selected-event';
  if (nearbyRank > selectedRank) return 'nearby-activity';

  if (selectedRank > 0 && nearbyRecent.count24h > 0) return 'mixed';
  if (selectedRank > 0) return 'selected-event';
  if (nearbyRank > 0) return 'nearby-activity';
  return 'none';
}

export function buildLocationSafety(input: BuildLocationSafetyInput): LocationSafetyModel {
  const now = input.now ?? Date.now();
  const selectedEvent = buildSelectedEventSignal(input.place, input.selectedEvent, input.intensityGrid);
  const nearbyRecent = buildNearbyRecentSignal(input.place, input.events, now);
  const overallTone = toneRank(selectedEvent?.tone ?? 'safe') >= toneRank(nearbyRecent.tone)
    ? (selectedEvent?.tone ?? 'safe')
    : nearbyRecent.tone;

  return {
    place: input.place,
    overall: {
      tone: overallTone,
      driver: deriveOverallDriver(selectedEvent, nearbyRecent, overallTone),
    },
    selectedEvent,
    nearbyRecent,
  };
}
