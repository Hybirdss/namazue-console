// ─── JMA Polling ────────────────────────────────────────
// Runs every minute. Upserts all JMA events (handles revisions).
// Triggers new analysis for new M4+ events, or re-analysis
// when magnitude changes ≥0.3.

import { inArray, sql } from 'drizzle-orm';
import { earthquakes } from '@namazue/db';
import type { Env } from '../../index.ts';
import { createDb } from '../../lib/db.ts';
import { fetchJmaQuakes } from '../../lib/jma.ts';
import { classifyFaultType } from '../../lib/usgs.ts';
import {
  CHUNK_SIZE,
  type SourcePollResult,
} from './shared.ts';

export async function pollJma(
  env: Env,
  db: ReturnType<typeof createDb>,
  prefetchedEvents?: Awaited<ReturnType<typeof fetchJmaQuakes>>,
): Promise<SourcePollResult> {
  const jmaEvents = prefetchedEvents ?? await fetchJmaQuakes();
  if (jmaEvents.length === 0) return { ingested: 0, analyzed: 0, revised: 0, persisted: true, newEventIds: [] };

  // Load existing events for revision detection
  const jmaIds = jmaEvents.map(e => e.id);
  const existing = await db.select({
    id: earthquakes.id,
    magnitude: earthquakes.magnitude,
  })
    .from(earthquakes)
    .where(inArray(earthquakes.id, jmaIds));
  const existingMap = new Map(existing.map(r => [r.id, r]));

  // Batch upsert in chunks.
  // JMA feed can contain duplicate IDs (preliminary + final report).
  // PostgreSQL rejects ON CONFLICT DO UPDATE when the same PK appears twice in one INSERT,
  // so we deduplicate by ID first, keeping the last (most recent) entry.
  const dedupedJma = [...new Map(jmaEvents.map(ev => [ev.id, ev])).values()];

  let ingested = 0;
  let persisted = true;
  const newIds = dedupedJma.filter(ev => !existingMap.has(ev.id)).map(ev => ev.id);
  try {
    const now = new Date();
    const values = dedupedJma.map(ev => ({
      id: ev.id,
      lat: ev.lat,
      lng: ev.lng,
      depth_km: ev.depth_km,
      magnitude: ev.magnitude,
      time: new Date(ev.time),
      place: ev.place,
      place_ja: ev.place_ja,
      source: ev.source,
      mag_type: ev.mag_type,
      maxi: ev.maxi,
      fault_type: classifyFaultType(ev.depth_km, ev.lat, ev.lng) as string | null,
      tsunami: false,
      mt_strike: null as number | null,
      mt_dip: null as number | null,
      mt_rake: null as number | null,
      mt_strike2: null as number | null,
      mt_dip2: null as number | null,
      mt_rake2: null as number | null,
      data_status: 'automatic' as string,
      updated_at: now,
    }));

    for (let i = 0; i < values.length; i += CHUNK_SIZE) {
      const chunk = values.slice(i, i + CHUNK_SIZE);
      await db.insert(earthquakes)
        .values(chunk)
        .onConflictDoUpdate({
          target: earthquakes.id,
          set: {
            lat: sql`excluded.lat`,
            lng: sql`excluded.lng`,
            depth_km: sql`excluded.depth_km`,
            magnitude: sql`excluded.magnitude`,
            place: sql`excluded.place`,
            place_ja: sql`excluded.place_ja`,
            maxi: sql`excluded.maxi`,
            updated_at: sql`excluded.updated_at`,
          },
        });
    }

    ingested = newIds.length;
  } catch (err) {
    persisted = false;
    console.error('[jma] batch upsert failed:', err);
    return { ingested: 0, analyzed: 0, revised: 0, persisted, newEventIds: [] };
  }

  return { ingested, analyzed: 0, revised: 0, persisted, newEventIds: newIds };
}
