/**
 * historicalCatalog.ts — 30-year Japan M3+ earthquake catalog loader
 *
 * Fetches a pre-built static JSON file from R2 containing ~50K events.
 * HTTP cache handles repeat visits (max-age=86400).
 * No IndexedDB needed — data changes less than once per day.
 *
 * Build the JSON: tools/build-historical-catalog.ts (1-time)
 * Host: R2 or public/data/
 */

import type { EarthquakeEvent } from '../types';
import { cacheRead, cacheWrite } from './idbCache';

const CATALOG_URL = '/data/historical-catalog.json';
const CACHE_KEY = 'historical-catalog-v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days — rarely changes

let cachedCatalog: EarthquakeEvent[] | null = null;

/**
 * Load the 30-year historical earthquake catalog.
 * Returns cached data on repeat calls within the same session.
 * IDB cache persists across sessions (7-day TTL).
 */
export async function loadHistoricalCatalog(): Promise<EarthquakeEvent[]> {
  if (cachedCatalog) return cachedCatalog;

  // 1. IndexedDB — skip 5.8MB fetch on repeat visits
  const fromIdb = await cacheRead<EarthquakeEvent[]>(CACHE_KEY, CACHE_TTL);
  if (fromIdb && fromIdb.length > 0) {
    cachedCatalog = fromIdb;
    return fromIdb;
  }

  // 2. Network fetch
  try {
    const resp = await fetch(CATALOG_URL);
    if (!resp.ok) return [];

    const contentType = resp.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return [];

    const data: EarthquakeEvent[] = await resp.json();
    cachedCatalog = data;
    cacheWrite(CACHE_KEY, data); // fire-and-forget
    return data;
  } catch {
    return [];
  }
}

/** Check if catalog is already loaded in memory. */
export function isCatalogLoaded(): boolean {
  return cachedCatalog !== null;
}

/** Get catalog without fetching (returns null if not loaded). */
export function getCatalog(): EarthquakeEvent[] | null {
  return cachedCatalog;
}
