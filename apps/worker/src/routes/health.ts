import { Hono } from 'hono';
import { sql } from 'drizzle-orm';

import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import type { OperatorProjection, ProjectionSectionState } from '../lib/projectionContracts.ts';
import { evaluateProjectionSectionSourceCompliance } from '../governor/sourceRegistry.ts';

export const healthRoute = new Hono<{ Bindings: Env & { HEALTH_DEPS?: HealthDependencies } }>();

type DependencyStateName = 'live' | 'degraded' | 'down' | 'unknown';
type FeedStateName = 'live' | 'stale' | 'down' | 'unknown';
type SectionStateName = ProjectionSectionState | 'unknown';
type ServiceHealthStatus = 'ok' | 'degraded' | 'down';

interface DependencyState {
  state: DependencyStateName;
  detail: string;
}

interface FeedHealthState {
  state: FeedStateName;
  updated_at: number | null;
  age_ms: number | null;
  stale_after_ms: number;
}

interface ProjectionHealthState {
  version: string | null;
  generated_at: number | null;
  age_ms: number | null;
}

interface ProjectionSectionHealthState {
  state: SectionStateName;
  source: string | null;
  updated_at: number | null;
  age_ms: number | null;
  last_success_at: number | null;
  last_success_age_ms: number | null;
  stale_after_ms: number | null;
  last_error: string | null;
}

export interface HealthDependencies {
  probeDatabase: (env: Env) => Promise<DependencyState>;
  probeBucket: (env: Env) => Promise<DependencyState>;
  probeMaritimeHub: (env: Env) => Promise<DependencyState>;
  probeProjector: (env: Env) => Promise<DependencyState>;
  probeSentinel: (env: Env) => Promise<DependencyState>;
}

interface SourceComplianceState {
  status: 'ok' | 'drift';
  sections: {
    events: {
      expected_sources: readonly string[];
      observed_source: string | null;
      compliant: boolean;
    };
    governor: {
      expected_sources: readonly string[];
      observed_source: string | null;
      compliant: boolean;
    };
    maritime: {
      expected_sources: readonly string[];
      observed_source: string | null;
      compliant: boolean;
    };
    rail: {
      expected_sources: readonly string[];
      observed_source: string | null;
      compliant: boolean;
    };
  };
}

type SnapshotMetadata = Pick<OperatorProjection, 'version' | 'generated_at' | 'source_updated'> & {
  sections?: Partial<OperatorProjection['sections']>;
};

interface CreateHealthSnapshotInput {
  env: Env & { HEALTH_DEPS?: HealthDependencies };
  now?: number;
  deps?: HealthDependencies;
}

const EVENTS_STALE_AFTER_MS = 90_000;
const MARITIME_STALE_AFTER_MS = 5 * 60_000;
const RAIL_STALE_AFTER_MS = 5 * 60_000;

healthRoute.get('/', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

healthRoute.get('/deep', async (c) => {
  // Require internal auth for deep health — it exposes infrastructure details
  const token = c.req.header('x-internal-token');
  const expectedToken = (c.env as Env & { INTERNAL_API_TOKEN?: string }).INTERNAL_API_TOKEN?.trim();
  if (!expectedToken) {
    return c.json({ status: 'ok' }, 200);
  }
  if (token !== expectedToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const snapshot = await createHealthSnapshot({
    env: c.env,
    deps: c.env.HEALTH_DEPS,
  });

  return c.json(snapshot, snapshot.status === 'down' ? 503 : 200);
});

export async function createHealthSnapshot(input: CreateHealthSnapshotInput) {
  const now = input.now ?? Date.now();
  const deps = input.deps ?? defaultDependencies;

  const [database, bucket, maritimeHub, projector, sentinel, snapshot] = await Promise.all([
    deps.probeDatabase(input.env),
    deps.probeBucket(input.env),
    deps.probeMaritimeHub(input.env),
    deps.probeProjector(input.env),
    deps.probeSentinel(input.env),
    readProjectionMetadata(input.env),
  ]);

  const internalAuth: DependencyState = input.env.INTERNAL_API_TOKEN?.trim()
    ? { state: 'live', detail: 'configured' }
    : { state: 'degraded', detail: 'internal mutation routes disabled until token is configured' };

  const feeds = {
    events: deriveFeedHealth(snapshot?.source_updated?.events, now, EVENTS_STALE_AFTER_MS),
    maritime: deriveFeedHealth(snapshot?.source_updated?.maritime, now, MARITIME_STALE_AFTER_MS),
    rail: deriveFeedHealth(snapshot?.source_updated?.rail, now, RAIL_STALE_AFTER_MS),
  };

  const projection = deriveProjectionHealth(snapshot, now);
  const sections = {
    events: deriveProjectionSectionHealth(snapshot?.sections?.events, now),
    governor: deriveProjectionSectionHealth(snapshot?.sections?.governor, now),
    maritime: deriveProjectionSectionHealth(snapshot?.sections?.maritime, now),
    rail: deriveProjectionSectionHealth(snapshot?.sections?.rail, now),
  };
  const sourceCompliance = deriveSourceCompliance(snapshot?.sections);

  const status = deriveOverallStatus({
    dependencies: { internalAuth, database, bucket, maritimeHub, projector, sentinel },
    feeds,
    sections,
    sourceCompliance,
  });

  return {
    status,
    checked_at: now,
    projection,
    dependencies: {
      internal_auth: internalAuth,
      database,
      bucket,
      maritime_hub: maritimeHub,
      projection_projector: projector,
      sentinel,
    },
    feeds,
    sections,
    source_compliance: sourceCompliance,
  };
}

async function readProjectionMetadata(env: Env): Promise<SnapshotMetadata | null> {
  if (!env.FEED_BUCKET) {
    return null;
  }

  try {
    const snapshot = await env.FEED_BUCKET.get('feed/snapshot.json');
    if (!snapshot) return null;
    return await snapshot.json() as SnapshotMetadata;
  } catch {
    return null;
  }
}

function deriveFeedHealth(updatedAt: number | undefined, now: number, staleAfterMs: number): FeedHealthState {
  if (!Number.isFinite(updatedAt) || !updatedAt || updatedAt <= 0) {
    return {
      state: 'unknown',
      updated_at: null,
      age_ms: null,
      stale_after_ms: staleAfterMs,
    };
  }

  const ageMs = Math.max(0, now - updatedAt);
  return {
    state: ageMs > staleAfterMs ? 'stale' : 'live',
    updated_at: updatedAt,
    age_ms: ageMs,
    stale_after_ms: staleAfterMs,
  };
}

function deriveProjectionHealth(snapshot: SnapshotMetadata | null, now: number): ProjectionHealthState {
  if (!snapshot || !Number.isFinite(snapshot.generated_at) || !snapshot.generated_at || snapshot.generated_at <= 0) {
    return {
      version: snapshot?.version ?? null,
      generated_at: null,
      age_ms: null,
    };
  }

  return {
    version: snapshot.version ?? null,
    generated_at: snapshot.generated_at,
    age_ms: Math.max(0, now - snapshot.generated_at),
  };
}

function deriveProjectionSectionHealth(
  section: OperatorProjection['sections'][keyof OperatorProjection['sections']] | undefined,
  now: number,
): ProjectionSectionHealthState {
  if (!section) {
    return {
      state: 'unknown',
      source: null,
      updated_at: null,
      age_ms: null,
      last_success_at: null,
      last_success_age_ms: null,
      stale_after_ms: null,
      last_error: null,
    };
  }

  return {
    state: section.state,
    source: section.source,
    updated_at: section.updated_at > 0 ? section.updated_at : null,
    age_ms: section.updated_at > 0 ? Math.max(0, now - section.updated_at) : null,
    last_success_at: section.last_success_at > 0 ? section.last_success_at : null,
    last_success_age_ms: section.last_success_at > 0 ? Math.max(0, now - section.last_success_at) : null,
    stale_after_ms: section.stale_after_ms,
    last_error: section.last_error,
  };
}

function deriveOverallStatus(input: {
  dependencies: {
    internalAuth: DependencyState;
    database: DependencyState;
    bucket: DependencyState;
    maritimeHub: DependencyState;
    projector: DependencyState;
    sentinel: DependencyState;
  };
  feeds: {
    events: FeedHealthState;
    maritime: FeedHealthState;
    rail: FeedHealthState;
  };
  sections: {
    events: ProjectionSectionHealthState;
    governor: ProjectionSectionHealthState;
    maritime: ProjectionSectionHealthState;
    rail: ProjectionSectionHealthState;
  };
  sourceCompliance: SourceComplianceState;
}): ServiceHealthStatus {
  const dependencyStates = Object.values(input.dependencies).map((entry) => entry.state);
  const feedStates = Object.values(input.feeds).map((entry) => entry.state);
  const sectionStates = Object.values(input.sections).map((entry) => entry.state);

  if (dependencyStates.includes('down') || feedStates.includes('down')) {
    return 'down';
  }

  if (
    dependencyStates.includes('degraded') ||
    dependencyStates.includes('unknown') ||
    feedStates.includes('stale') ||
    feedStates.includes('unknown') ||
    sectionStates.includes('degraded') ||
    sectionStates.includes('down') ||
    sectionStates.includes('stale') ||
    sectionStates.includes('unknown') ||
    input.sourceCompliance.status === 'drift'
  ) {
    return 'degraded';
  }

  return 'ok';
}

function deriveSourceCompliance(
  sections: SnapshotMetadata['sections'] | undefined,
): SourceComplianceState {
  return evaluateProjectionSectionSourceCompliance({
    events: sections?.events?.source,
    governor: sections?.governor?.source,
    maritime: sections?.maritime?.source,
    rail: sections?.rail?.source,
  });
}

const defaultDependencies: HealthDependencies = {
  async probeDatabase(env) {
    if (!env.DATABASE_URL?.trim()) {
      return { state: 'down', detail: 'not configured' };
    }

    try {
      const db = createDb(env.DATABASE_URL);
      await db.execute(sql`select 1`);
      return { state: 'live', detail: 'query ok' };
    } catch (error) {
      console.error('[health] database probe failed:', error);
      return { state: 'down', detail: 'probe failed' };
    }
  },

  async probeBucket(env) {
    if (!env.FEED_BUCKET) {
      return { state: 'down', detail: 'not configured' };
    }

    try {
      await env.FEED_BUCKET.get('feed/snapshot.json');
      return { state: 'live', detail: 'read ok' };
    } catch (error) {
      console.error('[health] bucket probe failed:', error);
      return { state: 'down', detail: 'probe failed' };
    }
  },

  async probeSentinel(env) {
    if (!env.SEISMIC_SENTINEL) {
      return { state: 'unknown', detail: 'not configured' };
    }

    try {
      const id = env.SEISMIC_SENTINEL.idFromName('japan-seismic-sentinel');
      const response = await env.SEISMIC_SENTINEL.get(id).fetch('https://sentinel/ping');
      return response.ok
        ? { state: 'live', detail: 'ping ok' }
        : { state: 'degraded', detail: `ping returned ${response.status}` };
    } catch (error) {
      console.error('[health] sentinel probe failed:', error);
      return { state: 'degraded', detail: 'probe failed' };
    }
  },

  async probeMaritimeHub(env) {
    if (!env.MARITIME_HUB) {
      return { state: 'unknown', detail: 'not configured' };
    }

    try {
      const id = env.MARITIME_HUB.idFromName('maritime-runtime-hub');
      const response = await env.MARITIME_HUB.get(id).fetch('https://maritime/ping');
      return response.ok
        ? { state: 'live', detail: 'ping ok' }
        : { state: 'degraded', detail: `ping returned ${response.status}` };
    } catch (error) {
      console.error('[health] maritime hub probe failed:', error);
      return { state: 'degraded', detail: 'probe failed' };
    }
  },

  async probeProjector(env) {
    if (!env.PROJECTION_PROJECTOR) {
      return { state: 'unknown', detail: 'not configured' };
    }

    try {
      const id = env.PROJECTION_PROJECTOR.idFromName('operator-projection-projector');
      const response = await env.PROJECTION_PROJECTOR.get(id).fetch('https://projector/ping');
      return response.ok
        ? { state: 'live', detail: 'ping ok' }
        : { state: 'degraded', detail: `ping returned ${response.status}` };
    } catch (error) {
      console.error('[health] projector probe failed:', error);
      return { state: 'degraded', detail: 'probe failed' };
    }
  },
};
