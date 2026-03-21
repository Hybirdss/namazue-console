// ─── Governor ───────────────────────────────────────────
// Resolves the current cron governor state from recent DB events.
// Governor state is cached in R2 to avoid per-minute DB queries.

import { desc, gte } from 'drizzle-orm';
import { earthquakes } from '@namazue/db';
import { createDb } from '../../lib/db.ts';
import { buildGovernorPolicyEnvelopeFromEvents } from '../../governor/runtimeGovernor.ts';
import { GOVERNOR_LOOKBACK_MS } from './shared.ts';

export async function resolveCronGovernor(when: Date, db: ReturnType<typeof createDb>) {
  const recentRows = await db.select({
    magnitude: earthquakes.magnitude,
    tsunami: earthquakes.tsunami,
    lat: earthquakes.lat,
    lng: earthquakes.lng,
    time: earthquakes.time,
  })
    .from(earthquakes)
    .where(gte(earthquakes.time, new Date(when.getTime() - GOVERNOR_LOOKBACK_MS)))
    .orderBy(desc(earthquakes.time))
    .limit(25);

  return buildGovernorPolicyEnvelopeFromEvents(recentRows.map((row) => ({
    ...row,
    tsunami: Boolean(row.tsunami),
  })), {
    now: when.toISOString(),
  });
}
