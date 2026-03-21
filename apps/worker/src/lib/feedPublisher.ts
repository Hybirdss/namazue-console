import { buildOperatorProjection, type OperatorProjection } from './projectionBuilder.ts';
import type { ProjectionBuildInput, ProjectionSection } from './projectionContracts.ts';
import { loadReferenceAssetCatalog } from '../reference/assets.ts';

/**
 * Feed Publisher — Writes JSON snapshots to R2 for CDN-served reads.
 *
 * Architecture:
 *   Cron worker writes → R2 bucket → CF CDN (Cache-Control) → clients
 *   Zero Worker invocations for reads. R2 public access + CDN handles it.
 *
 * Primary feed:
 *   feed/snapshot.json  — Unified snapshot (events + governor + maritime + rail)
 *                          Client fetches 1 file instead of N. Adding layers = zero extra requests.
 *
 * Legacy feeds (kept for Worker API route fallback):
 *   feed/events.json, feed/maritime.json, feed/rail.json, feed/governor.json
 */

const FEED_PREFIX = 'feed/';

// Cache-Control for R2 public access.
// 60s max-age: clients get CDN-cached response, cron refreshes every minute.
const CACHE_CONTROL = 'public, max-age=60, s-maxage=60';

interface PublishOptions {
  bucket: R2Bucket;
  key: string;
  data: unknown;
}

interface PublishProjectionUpdateInput {
  bucket: R2Bucket;
  now: number;
  updates: ProjectionBuildInput['updates'];
  referenceDataBaseUrl?: string;
}

async function publishJson({ bucket, key, data }: PublishOptions): Promise<void> {
  const body = JSON.stringify(data);
  await bucket.put(`${FEED_PREFIX}${key}`, body, {
    httpMetadata: {
      contentType: 'application/json',
      cacheControl: CACHE_CONTROL,
    },
  });
}

// ── Unified Projection Publishing ────────────────────────────
// snapshot.json and legacy feed files are emitted from one coherent build.

export async function publishProjectionUpdate(
  input: PublishProjectionUpdateInput,
): Promise<OperatorProjection> {
  const previous = await readOperatorProjection(input.bucket);
  const assetCatalog = await loadReferenceAssetCatalog({
    FEED_BUCKET: input.bucket,
    REFERENCE_DATA_BASE_URL: input.referenceDataBaseUrl,
  });
  const next = buildOperatorProjection({
    previous,
    now: input.now,
    updates: input.updates,
  }, {
    assets: assetCatalog.assets,
  });

  await publishProjection(input.bucket, next);
  return next;
}

async function readOperatorProjection(bucket: R2Bucket): Promise<OperatorProjection | null> {
  try {
    const snapshot = await bucket.get(`${FEED_PREFIX}snapshot.json`);
    if (!snapshot) {
      return null;
    }

    return normalizeOperatorProjection(await snapshot.json() as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function publishProjection(bucket: R2Bucket, projection: OperatorProjection): Promise<void> {
  await Promise.all([
    publishJson({ bucket, key: 'snapshot.json', data: projection }),
    publishJson({
      bucket,
      key: 'events.json',
      data: {
        events: projection.events,
        count: projection.count,
        governor: projection.governor,
        generated_at: projection.generated_at,
      },
    }),
    publishJson({ bucket, key: 'governor.json', data: projection.governor }),
    publishJson({ bucket, key: 'maritime.json', data: projection.maritime }),
    publishJson({ bucket, key: 'rail.json', data: projection.rail }),
  ]);
}

function normalizeOperatorProjection(snapshot: Record<string, unknown>): OperatorProjection {
  if (snapshot.sections && typeof snapshot.sections === 'object') {
    return snapshot as unknown as OperatorProjection;
  }

  const generatedAt = asTimestamp(snapshot.generated_at);
  const sourceUpdated = snapshot.source_updated as Record<string, unknown> | undefined;
  const eventsUpdatedAt = asTimestamp(sourceUpdated?.events) || generatedAt;
  const maritimeUpdatedAt = asTimestamp(sourceUpdated?.maritime) || generatedAt;
  const railUpdatedAt = asTimestamp(sourceUpdated?.rail) || generatedAt;

  const events = Array.isArray(snapshot.events) ? snapshot.events : [];
  const governor = snapshot.governor ?? null;
  const maritime = snapshot.maritime ?? { source: 'none', generated_at: maritimeUpdatedAt, vessels: [] };
  const rail = snapshot.rail ?? { source: 'fallback', updatedAt: railUpdatedAt, lines: [] };
  const domainOverrides = snapshot.domain_overrides && typeof snapshot.domain_overrides === 'object'
    ? snapshot.domain_overrides
    : {};

  return {
    version: typeof snapshot.version === 'string' ? snapshot.version : `projection-${generatedAt}`,
    generated_at: generatedAt,
    sections: {
      events: buildLiveSection('legacy-snapshot', eventsUpdatedAt, 90_000, events),
      governor: buildLiveSection('legacy-snapshot', eventsUpdatedAt, 90_000, governor),
      maritime: buildLiveSection('legacy-snapshot', maritimeUpdatedAt, 300_000, maritime),
      rail: buildLiveSection('legacy-snapshot', railUpdatedAt, 300_000, rail),
    },
    domain_overrides: domainOverrides,
    events,
    count: typeof snapshot.count === 'number' ? snapshot.count : events.length,
    governor,
    maritime,
    rail,
    source_updated: {
      events: eventsUpdatedAt,
      maritime: maritimeUpdatedAt,
      rail: railUpdatedAt,
    },
  };
}

function buildLiveSection<T>(
  source: string,
  updatedAt: number,
  staleAfterMs: number,
  data: T,
): ProjectionSection<T> {
  return {
    state: updatedAt > 0 ? 'live' : 'down',
    source,
    updated_at: updatedAt,
    last_success_at: updatedAt,
    stale_after_ms: staleAfterMs,
    last_error: null,
    data,
  };
}

function asTimestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
