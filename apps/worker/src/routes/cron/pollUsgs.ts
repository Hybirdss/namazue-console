// ─── USGS Polling ─────────────────────────────────────────
// Runs every 5 minutes. Fetches USGS weekly feed for Japan,
// deduplicates against existing events (JMA or prior USGS),
// upserts with status/magnitude updates, generates analysis for new M4+.

import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { earthquakes } from '@namazue/db';
import type { Env } from '../../index.ts';
import { createDb } from '../../lib/db.ts';
import { fetchUsgsQuakes, fetchUsgsMomentTensor } from '../../lib/usgs.ts';
import { inArray } from 'drizzle-orm';
import {
  CHUNK_SIZE,
  DEDUP_DEG,
  DEDUP_MAG,
  DEDUP_TIME_MS,
  type SourcePollResult,
} from './shared.ts';

export async function pollUsgs(
  env: Env,
  db: ReturnType<typeof createDb>,
  prefetchedEvents?: Awaited<ReturnType<typeof fetchUsgsQuakes>>,
): Promise<SourcePollResult> {
  const usgsEvents = prefetchedEvents ?? await fetchUsgsQuakes();
  if (usgsEvents.length === 0) return { ingested: 0, analyzed: 0, revised: 0, persisted: true, newEventIds: [] };

  // Check which USGS IDs already exist (for new vs update detection)
  const usgsIds = usgsEvents.map(e => e.id);
  const existing = await db.select({
    id: earthquakes.id,
    magnitude: earthquakes.magnitude,
  })
    .from(earthquakes)
    .where(inArray(earthquakes.id, usgsIds));
  const existingMap = new Map(existing.map(r => [r.id, r]));

  // Dedup new candidates against JMA events (proximity check)
  const candidates = usgsEvents.filter(e => !existingMap.has(e.id));

  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let recentDb: Array<{ id: string; lat: number; lng: number; magnitude: number; time: Date }> = [];
  if (candidates.length > 0) {
    // Compute bbox of all candidates to avoid loading the entire 7-day dataset.
    // DEDUP_DEG buffer ensures we catch cross-boundary duplicates.
    const minLat = Math.min(...candidates.map(e => e.lat)) - DEDUP_DEG;
    const maxLat = Math.max(...candidates.map(e => e.lat)) + DEDUP_DEG;
    const minLng = Math.min(...candidates.map(e => e.lng)) - DEDUP_DEG;
    const maxLng = Math.max(...candidates.map(e => e.lng)) + DEDUP_DEG;

    recentDb = await db.select({
      id: earthquakes.id,
      lat: earthquakes.lat,
      lng: earthquakes.lng,
      magnitude: earthquakes.magnitude,
      time: earthquakes.time,
    })
      .from(earthquakes)
      .where(and(
        gte(earthquakes.time, recentCutoff),
        gte(earthquakes.lat, minLat),
        lte(earthquakes.lat, maxLat),
        gte(earthquakes.lng, minLng),
        lte(earthquakes.lng, maxLng),
      ));
  }

  function isDuplicate(ev: typeof candidates[0]): boolean {
    const evTime = new Date(ev.time).getTime();
    for (const row of recentDb) {
      const dbTime = new Date(row.time).getTime();
      if (
        Math.abs(evTime - dbTime) < DEDUP_TIME_MS &&
        Math.abs(ev.lat - Number(row.lat)) < DEDUP_DEG &&
        Math.abs(ev.lng - Number(row.lng)) < DEDUP_DEG &&
        Math.abs(ev.magnitude - Number(row.magnitude)) < DEDUP_MAG
      ) {
        return true;
      }
    }
    return false;
  }

  // Filter out JMA duplicates from candidates
  const newEvents = candidates.filter(ev => !isDuplicate(ev));

  let ingested = 0;
  let persisted = true;
  const now = new Date();

  // Batch insert new events (chunked for Neon HTTP parameter limits)
  if (newEvents.length > 0) {
    try {
      const vals = newEvents.map(ev => ({
        id: ev.id,
        lat: ev.lat,
        lng: ev.lng,
        depth_km: ev.depth_km,
        magnitude: ev.magnitude,
        time: new Date(ev.time),
        place: ev.place,
        source: ev.source,
        mag_type: ev.mag_type,
        fault_type: ev.fault_type as string | null,
        tsunami: ev.tsunami,
        data_status: ev.data_status,
        updated_at: now,
      }));
      for (let i = 0; i < vals.length; i += CHUNK_SIZE) {
        await db.insert(earthquakes)
          .values(vals.slice(i, i + CHUNK_SIZE))
          .onConflictDoNothing();
      }
      ingested = newEvents.length;
    } catch (err) {
      persisted = false;
      console.error('[usgs] batch insert failed:', err);
    }
  }

  const newEventIds = newEvents.map(ev => ev.id);

  // Batch update existing USGS events (chunked)
  const toUpdate = usgsEvents.filter(ev => existingMap.has(ev.id));
  if (toUpdate.length > 0) {
    try {
      const vals = toUpdate.map(ev => ({
        id: ev.id,
        lat: ev.lat,
        lng: ev.lng,
        depth_km: ev.depth_km,
        magnitude: ev.magnitude,
        time: new Date(ev.time),
        place: ev.place,
        source: ev.source,
        mag_type: ev.mag_type,
        fault_type: ev.fault_type as string | null,
        tsunami: ev.tsunami,
        data_status: ev.data_status,
        updated_at: now,
      }));
      for (let i = 0; i < vals.length; i += CHUNK_SIZE) {
        await db.insert(earthquakes)
          .values(vals.slice(i, i + CHUNK_SIZE))
          .onConflictDoUpdate({
            target: earthquakes.id,
            set: {
              magnitude: sql`excluded.magnitude`,
              depth_km: sql`excluded.depth_km`,
              data_status: sql`excluded.data_status`,
              tsunami: sql`excluded.tsunami`,
              updated_at: sql`excluded.updated_at`,
            },
          });
      }
    } catch (err) {
      persisted = false;
      console.error('[usgs] batch update failed:', err);
    }
  }

  if (!persisted) {
    return { ingested: 0, analyzed: 0, revised: 0, persisted, newEventIds: [] };
  }

  // ── Moment tensor enrichment for M5+ events ──
  // USGS provides focal mechanism/moment tensor for significant events,
  // typically available 30-120 min after the initial report.
  // We fetch and store the authoritative fault type + strike/dip/rake.
  const mtCandidates = usgsEvents.filter(ev => ev.magnitude >= 5.0).slice(0, 3);
  for (const ev of mtCandidates) {
    try {
      const mt = await fetchUsgsMomentTensor(ev.id, ev.depth_km, ev.lat, ev.lng);
      if (mt) {
        await db.update(earthquakes)
          .set({
            mt_strike: mt.strike1,
            mt_dip: mt.dip1,
            mt_rake: mt.rake1,
            mt_strike2: mt.strike2,
            mt_dip2: mt.dip2,
            mt_rake2: mt.rake2,
            fault_type: mt.fault_type,
          })
          .where(eq(earthquakes.id, ev.id));
      }
    } catch (err) {
      console.error(`[usgs] moment tensor fetch failed ${ev.id}:`, err);
    }
  }

  return { ingested, analyzed: 0, revised: 0, persisted, newEventIds };
}
