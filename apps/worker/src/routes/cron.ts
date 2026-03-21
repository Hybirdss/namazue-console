import type { Env } from '../index.ts';
import { advanceCheckpointAfterSuccess, readTextCheckpoint } from '../lib/checkpoint.ts';
import { createDb } from '../lib/db.ts';
import { fetchJmaQuakes } from '../lib/jma.ts';
import { fetchUsgsQuakes } from '../lib/usgs.ts';
import { computeFingerprint } from './cron/shared.ts';
import { pollJma } from './cron/pollJma.ts';
import { pollUsgs } from './cron/pollUsgs.ts';
import { publishCoreFeeds, publishPeriodicFeeds, publishR2Feeds } from './cron/publishing.ts';
import { resolveCronGovernor } from './cron/governor.ts';
import { submitToIndexNow } from './seo.ts';

// Re-export for callers that import directly from this module (e.g. sentinel route).
export { computeFingerprint } from './cron/shared.ts';
export type { SourcePollResult } from './cron/shared.ts';
export { pollJma } from './cron/pollJma.ts';
export { publishCoreFeeds, publishPeriodicFeeds, publishR2Feeds } from './cron/publishing.ts';
export { resolveCronGovernor } from './cron/governor.ts';

/**
 * Cron handler — "Always watching, never wasting"
 *
 * Runs every minute to maintain <2min earthquake detection latency.
 * Uses R2 fingerprinting to achieve zero DB queries during calm periods:
 *
 * 1. Fetch JMA feed (cheap HTTP, ~100ms)
 * 2. Compute fingerprint of event IDs + magnitudes
 * 3. Compare with R2-cached fingerprint
 *    → MATCH: skip DB entirely (0 Neon queries)
 *    → MISMATCH: full pipeline (upsert + governor refresh)
 * 4. Governor state cached in R2 — avoids per-minute DB queries
 *
 * Every minute:    JMA poll → fingerprint gate → conditional DB work
 * Every 5 min:     USGS poll (or every minute during watch/incident)
 * 03:00 JST daily: Reserved for batch jobs
 * Monday 09:00 JST: Weekly brief
 * 1st 09:00 JST:   Monthly report
 */
export async function handleCron(event: ScheduledEvent, env: Env): Promise<void> {
  const when = new Date(event.scheduledTime);
  const hour = when.getUTCHours();
  const minute = when.getUTCMinutes();
  const dayOfWeek = when.getUTCDay();
  const dayOfMonth = when.getUTCDate();

  // Daily 03:00 JST (18:00 UTC)
  if (hour === 18 && minute === 0) return;

  // 1st of month 09:00 JST (00:00 UTC 1st)
  if (hour === 0 && minute === 0 && dayOfMonth === 1) return;

  // Monday 09:00 JST (00:00 UTC Monday)
  if (hour === 0 && minute === 0 && dayOfWeek === 1) return;

  // Ensure SeismicSentinel alarm chain is alive (no-op if already running)
  if (env.SEISMIC_SENTINEL) {
    try {
      const sentinel = env.SEISMIC_SENTINEL.idFromName('japan-seismic-sentinel');
      await env.SEISMIC_SENTINEL.get(sentinel).fetch('https://sentinel/ping');
    } catch { /* non-critical — cron is the safety net */ }
  }

  const bucket = env.FEED_BUCKET;

  // ── Step 1: Fetch JMA feed ──
  let jmaEvents: Awaited<ReturnType<typeof fetchJmaQuakes>> = [];
  let jmaFetchSucceeded = false;
  try {
    jmaEvents = await fetchJmaQuakes();
    jmaFetchSucceeded = true;
  } catch (err) {
    console.error('[cron] jma fetch failed:', err);
  }

  // ── Step 2: Fingerprint gate (R2-based) ──
  let currentFp: string | null = null;
  let cachedJmaFp: string | null = null;
  let jmaChanged = false;
  if (jmaFetchSucceeded) {
    currentFp = jmaEvents.length > 0 ? computeFingerprint(jmaEvents) : null;
    cachedJmaFp = await readTextCheckpoint(bucket, 'feed/_fp_jma.txt');
    jmaChanged = currentFp !== null && currentFp !== cachedJmaFp;
  }

  // ── Step 3: Governor state (from R2) ──
  let governorState: string = 'calm';
  let governorEnvelope: unknown = null;
  if (bucket) {
    try {
      const govObj = await bucket.get('feed/governor.json');
      if (govObj) {
        const parsed = await govObj.json() as { state?: string };
        governorState = parsed?.state ?? 'calm';
        governorEnvelope = parsed;
      }
    } catch { /* default calm */ }
  }

  // Collect new event IDs for IndexNow submission
  const indexNowIds: string[] = [];

  if (jmaChanged) {
    const db = createDb(env.DATABASE_URL);

    // Ingest JMA events (pass prefetched to avoid double-fetch)
    let jmaPersisted = jmaEvents.length === 0;
    if (jmaEvents.length > 0) {
      try {
        const result = await pollJma(env, db, jmaEvents);
        jmaPersisted = result.persisted;
        if (result.newEventIds) indexNowIds.push(...result.newEventIds);
      } catch (err) {
        jmaPersisted = false;
        console.error('[cron] jma poll failed:', err);
      }
    }

    // Refresh governor
    try {
      const governor = await resolveCronGovernor(when, db);
      governorState = governor.activation.state;
      governorEnvelope = governor;
    } catch (err) {
      console.error('[cron] governor resolution failed:', err);
    }

    // USGS poll
    if (minute % 5 === 0 || governorState === 'watch' || governorState === 'incident') {
      try {
        const usgsResult = await pollUsgs(env, db);
        if (usgsResult.newEventIds) indexNowIds.push(...usgsResult.newEventIds);
      } catch (err) {
        console.error('[cron] usgs poll failed:', err);
      }
    }

    if (!jmaPersisted) {
      console.error('[cron] jma checkpoint not advanced because ingest did not fully persist');
    } else if (currentFp !== null) {
      try {
        const checkpointResult = await advanceCheckpointAfterSuccess({
          currentCheckpoint: cachedJmaFp,
          nextCheckpoint: currentFp,
          performWork: async () => {
            await publishR2Feeds(env, db, governorEnvelope);
            return true;
          },
          persistCheckpoint: async (nextCheckpoint) => {
            if (!bucket) return;
            await bucket.put('feed/_fp_jma.txt', nextCheckpoint);
          },
        });
        if (checkpointResult === 'held') {
          console.error('[cron] jma checkpoint held for retry');
        }
      } catch (err) {
        console.error('[cron] R2 feed publish/checkpoint failed:', err);
      }
    }
  } else {
    // JMA unchanged — minimal work path

    // USGS on schedule (every 5min or escalated)
    if (minute % 5 === 0 || governorState === 'watch' || governorState === 'incident') {
      try {
        const usgsEvents = await fetchUsgsQuakes();
        if (usgsEvents.length > 0) {
          const usgsFp = computeFingerprint(usgsEvents);
          const cachedUsgsFp = await readTextCheckpoint(bucket, 'feed/_fp_usgs.txt');
          const usgsChanged = usgsFp !== cachedUsgsFp;

          if (usgsChanged) {
            const db = createDb(env.DATABASE_URL);
            let usgsPersisted = false;
            try {
              const usgsResult = await pollUsgs(env, db, usgsEvents);
              usgsPersisted = usgsResult.persisted;
              if (usgsResult.newEventIds) indexNowIds.push(...usgsResult.newEventIds);
            } catch (err) {
              console.error('[cron] usgs poll failed:', err);
            }

            if (!usgsPersisted) {
              console.error('[cron] usgs checkpoint not advanced because ingest did not fully persist');
            } else {
              // Refresh governor + publish core feeds (maritime/rail handled by heartbeat)
              try {
                const governor = await resolveCronGovernor(when, db);
                governorEnvelope = governor;
                governorState = governor.activation.state;
              } catch { /* keep existing */ }
              try {
                const checkpointResult = await advanceCheckpointAfterSuccess({
                  currentCheckpoint: cachedUsgsFp,
                  nextCheckpoint: usgsFp,
                  performWork: async () => {
                    await publishCoreFeeds(env, db, governorEnvelope);
                    return true;
                  },
                  persistCheckpoint: async (nextCheckpoint) => {
                    if (!bucket) return;
                    await bucket.put('feed/_fp_usgs.txt', nextCheckpoint);
                  },
                });
                if (checkpointResult === 'held') {
                  console.error('[cron] usgs checkpoint held for retry');
                }
              } catch (err) {
                console.error('[cron] R2 core publish/checkpoint failed:', err);
              }
            }
          }
        }
      } catch (err) {
        console.error('[cron] usgs poll failed:', err);
      }
    }

    // Heartbeat: publish maritime + rail every 5min (no Neon events query)
    if (minute % 5 === 0) {
      try {
        await publishPeriodicFeeds(env);
      } catch (err) {
        console.error('[cron] R2 heartbeat publish failed:', err);
      }
    }
  }

  // ── IndexNow: push new event URLs to Bing/Yandex for instant indexing ──
  if (indexNowIds.length > 0) {
    const urls = [
      'https://namazue.dev/',  // Homepage (updated feed)
      ...indexNowIds.map(id => `https://namazue.dev/event/${id}`),
    ];
    try {
      await submitToIndexNow(urls);
    } catch (err) {
      console.error('[cron] indexnow submission failed:', err);
    }
  }
}
