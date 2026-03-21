// ─── R2 Feed Publishing ──────────────────────────────────
// Split into core (events+governor) and periodic (maritime+rail).
//   Sentinel: publishCoreFeeds only — fast path, no DO/ODPT overhead
//   Cron data-change: publishCoreFeeds + publishPeriodicFeeds
//   Cron heartbeat: publishPeriodicFeeds only — no Neon events query

import { and, desc, gte, lte } from 'drizzle-orm';
import { earthquakes } from '@namazue/db';
import type { Env } from '../../index.ts';
import { createDb } from '../../lib/db.ts';
import type { ProjectionBuildInput, ProjectionSectionUpdate } from '../../lib/projectionContracts.ts';
import { publishProjectionViaProjector } from '../../lib/projectionProjectorClient.ts';
import { fetchFromOdpt } from '../rail.ts';
import {
  EVENTS_PROJECTION_STALE_AFTER_MS,
  FEED_EVENTS_LIMIT,
  FEED_EVENTS_LOOKBACK_MS,
  GOVERNOR_PROJECTION_STALE_AFTER_MS,
  MARITIME_PROJECTION_STALE_AFTER_MS,
  RAIL_PROJECTION_STALE_AFTER_MS,
} from './shared.ts';

function buildLiveProjectionUpdate<T>(
  source: string,
  staleAfterMs: number,
  data: T,
): ProjectionSectionUpdate<T> {
  return {
    source,
    stale_after_ms: staleAfterMs,
    data,
  };
}

function buildFailedProjectionUpdate<T>(
  source: string,
  staleAfterMs: number,
  error: string,
  fallbackData: T,
): ProjectionSectionUpdate<T> {
  return {
    source,
    stale_after_ms: staleAfterMs,
    error,
    fallbackData,
  };
}

/** Publish events + governor to R2. Used by sentinel and cron on data change. */
export async function publishCoreFeeds(env: Env, db: ReturnType<typeof createDb>, governor: unknown): Promise<void> {
  const since = new Date(Date.now() - FEED_EVENTS_LOOKBACK_MS);
  const rows = await db.select({
    id: earthquakes.id,
    lat: earthquakes.lat,
    lng: earthquakes.lng,
    depth_km: earthquakes.depth_km,
    magnitude: earthquakes.magnitude,
    time: earthquakes.time,
    place: earthquakes.place,
    fault_type: earthquakes.fault_type,
    source: earthquakes.source,
    tsunami: earthquakes.tsunami,
    mag_type: earthquakes.mag_type,
    maxi: earthquakes.maxi,
    mt_strike: earthquakes.mt_strike,
  })
    .from(earthquakes)
    .where(and(
      gte(earthquakes.magnitude, 2.5),
      gte(earthquakes.time, since),
      gte(earthquakes.lat, 24),
      lte(earthquakes.lat, 46),
      gte(earthquakes.lng, 122),
      lte(earthquakes.lng, 150),
    ))
    .orderBy(desc(earthquakes.time))
    .limit(FEED_EVENTS_LIMIT);

  await publishProjectionViaProjector(env, {
    now: Date.now(),
    updates: {
      events: buildLiveProjectionUpdate('events-db', EVENTS_PROJECTION_STALE_AFTER_MS, rows),
      governor: buildLiveProjectionUpdate('governor-db', GOVERNOR_PROJECTION_STALE_AFTER_MS, governor),
    },
  });
}

/** Fetch maritime + rail data from upstream sources. */
async function fetchPeriodicData(env: Env): Promise<ProjectionBuildInput['updates']> {
  let maritimeUpdate: ProjectionSectionUpdate<unknown>;
  if (env.MARITIME_HUB) {
    try {
      const stub = env.MARITIME_HUB.getByName('japan-maritime-hub');
      const res = await stub.fetch('https://maritime-hub/snapshot');
      if (!res.ok) {
        maritimeUpdate = buildFailedProjectionUpdate(
          'maritime-hub',
          MARITIME_PROJECTION_STALE_AFTER_MS,
          `maritime hub returned ${res.status}`,
          { source: 'none', vessels: [], generated_at: 0 },
        );
      } else {
        maritimeUpdate = buildLiveProjectionUpdate(
          'maritime-hub',
          MARITIME_PROJECTION_STALE_AFTER_MS,
          await res.json(),
        );
      }
    } catch (err) {
      console.error('[cron] maritime snapshot for R2 failed:', err);
      maritimeUpdate = buildFailedProjectionUpdate(
        'maritime-hub',
        MARITIME_PROJECTION_STALE_AFTER_MS,
        err instanceof Error ? err.message : 'maritime snapshot failed',
        { source: 'none', vessels: [], generated_at: 0 },
      );
    }
  } else {
    maritimeUpdate = buildFailedProjectionUpdate(
      'maritime-hub',
      MARITIME_PROJECTION_STALE_AFTER_MS,
      'MARITIME_HUB binding unavailable',
      { source: 'none', vessels: [], generated_at: 0 },
    );
  }

  let railFallback: unknown = { lines: [], source: 'fallback', updatedAt: 0 };
  let railUpdate: ProjectionSectionUpdate<unknown>;
  try {
    const lines = await fetchFromOdpt();
    railUpdate = buildLiveProjectionUpdate(
      'odpt',
      RAIL_PROJECTION_STALE_AFTER_MS,
      { lines, source: 'odpt', updatedAt: Date.now() },
    );
  } catch (error) {
    try {
      const kvCached = await env.RATE_LIMIT.get('rail:status:shinkansen');
      if (kvCached) {
        railFallback = JSON.parse(kvCached);
      }
    } catch { /* non-critical */ }

    railUpdate = buildFailedProjectionUpdate(
      'odpt',
      RAIL_PROJECTION_STALE_AFTER_MS,
      error instanceof Error ? error.message : 'ODPT fetch failed',
      railFallback,
    );
  }

  return {
    maritime: maritimeUpdate,
    rail: railUpdate,
  };
}

/** Publish maritime + rail to R2. Runs on heartbeat cadence (every 5 min). */
export async function publishPeriodicFeeds(env: Env): Promise<void> {
  await publishProjectionViaProjector(env, {
    now: Date.now(),
    updates: await fetchPeriodicData(env),
  });
}

/** Full publish — all data in one shot. Avoids snapshot race between core + periodic. */
export async function publishR2Feeds(env: Env, db: ReturnType<typeof createDb>, governor: unknown): Promise<void> {
  const since = new Date(Date.now() - FEED_EVENTS_LOOKBACK_MS);
  const now = Date.now();
  const [rows, periodicUpdates] = await Promise.all([
    db.select({
      id: earthquakes.id,
      lat: earthquakes.lat,
      lng: earthquakes.lng,
      depth_km: earthquakes.depth_km,
      magnitude: earthquakes.magnitude,
      time: earthquakes.time,
      place: earthquakes.place,
      fault_type: earthquakes.fault_type,
      source: earthquakes.source,
      tsunami: earthquakes.tsunami,
      mag_type: earthquakes.mag_type,
      maxi: earthquakes.maxi,
    })
      .from(earthquakes)
      .where(and(
        gte(earthquakes.magnitude, 2.5),
        gte(earthquakes.time, since),
        gte(earthquakes.lat, 24),
        lte(earthquakes.lat, 46),
        gte(earthquakes.lng, 122),
        lte(earthquakes.lng, 150),
      ))
      .orderBy(desc(earthquakes.time))
      .limit(FEED_EVENTS_LIMIT),
    fetchPeriodicData(env),
  ]);

  await publishProjectionViaProjector(env, {
    now,
    updates: {
      events: buildLiveProjectionUpdate('events-db', EVENTS_PROJECTION_STALE_AFTER_MS, rows),
      governor: buildLiveProjectionUpdate('governor-db', GOVERNOR_PROJECTION_STALE_AFTER_MS, governor),
      maritime: periodicUpdates.maritime,
      rail: periodicUpdates.rail,
    },
  });
}
