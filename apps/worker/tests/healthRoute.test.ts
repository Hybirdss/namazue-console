import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createHealthSnapshot,
  healthRoute,
  type HealthDependencies,
} from '../src/routes/health.ts';

test('health route returns liveness on the shallow endpoint', async () => {
  const response = await healthRoute.request('http://example.com/');
  assert.equal(response.status, 200);

  const payload = await response.json() as { status: string; timestamp: number };
  assert.equal(payload.status, 'ok');
  assert.equal(typeof payload.timestamp, 'number');
});

test('deep health degrades when projection is stale and internal auth is missing', async () => {
  const now = Date.parse('2026-03-09T04:00:00.000Z');
  const snapshot = await createHealthSnapshot({
    env: {
      FEED_BUCKET: {
        get: async () => ({
          json: async () => ({
            version: 'projection-900',
            generated_at: now - 15_000,
            sections: {
              events: {
                state: 'live',
                source: 'events-db',
                updated_at: now - 30_000,
                last_success_at: now - 30_000,
                stale_after_ms: 90_000,
                last_error: null,
                data: [],
              },
              governor: {
                state: 'live',
                source: 'governor-db',
                updated_at: now - 30_000,
                last_success_at: now - 30_000,
                stale_after_ms: 90_000,
                last_error: null,
                data: { activation: { state: 'watch' } },
              },
              maritime: {
                state: 'degraded',
                source: 'maritime-hub',
                updated_at: now - 45_000,
                last_success_at: now - 45_000,
                stale_after_ms: 300_000,
                last_error: 'AISstream timeout',
                data: { vessels: [{ mmsi: '123456789' }] },
              },
              rail: {
                state: 'down',
                source: 'odpt',
                updated_at: 0,
                last_success_at: 0,
                stale_after_ms: 300_000,
                last_error: 'ODPT unavailable',
                data: { lines: [] },
              },
            },
            source_updated: {
              events: now - 5 * 60_000,
              maritime: now - 10 * 60_000,
              rail: now - 12 * 60_000,
            },
          }),
        }),
      },
    } as never,
    now,
    deps: {
      probeDatabase: async () => ({ state: 'live', detail: 'ok' }),
      probeBucket: async () => ({ state: 'live', detail: 'ok' }),
      probeMaritimeHub: async () => ({ state: 'live', detail: 'ok' }),
      probeProjector: async () => ({ state: 'live', detail: 'ok' }),
      probeSentinel: async () => ({ state: 'live', detail: 'ok' }),
    },
  });

  assert.equal(snapshot.status, 'degraded');
  assert.equal(snapshot.dependencies.internal_auth.state, 'degraded');
  assert.equal(snapshot.feeds.events.state, 'stale');
  assert.equal(snapshot.feeds.maritime.state, 'stale');
  assert.equal(snapshot.feeds.rail.state, 'stale');
  assert.equal(snapshot.projection.version, 'projection-900');
  assert.equal(snapshot.projection.age_ms, 15_000);
  assert.equal(snapshot.sections.maritime.state, 'degraded');
  assert.equal(snapshot.sections.maritime.last_error, 'AISstream timeout');
  assert.equal(snapshot.sections.rail.state, 'down');
  assert.equal(snapshot.sections.rail.last_error, 'ODPT unavailable');
  assert.equal(snapshot.source_compliance.status, 'ok');
  assert.equal(snapshot.source_compliance.sections.events.compliant, true);
});

test('deep health reports down when database probe fails', async () => {
  const snapshot = await createHealthSnapshot({
    env: {
      INTERNAL_API_TOKEN: 'configured-token',
      FEED_BUCKET: {
        get: async () => null,
      },
    } as never,
    now: Date.parse('2026-03-09T04:00:00.000Z'),
    deps: {
      probeDatabase: async () => ({ state: 'down', detail: 'connection failed' }),
      probeBucket: async () => ({ state: 'live', detail: 'ok' }),
      probeMaritimeHub: async () => ({ state: 'live', detail: 'ok' }),
      probeProjector: async () => ({ state: 'live', detail: 'ok' }),
      probeSentinel: async () => ({ state: 'live', detail: 'ok' }),
    },
  });

  assert.equal(snapshot.status, 'down');
  assert.equal(snapshot.dependencies.database.state, 'down');
  assert.match(snapshot.dependencies.database.detail, /connection failed/i);
});

test('deep health route serves the snapshot payload', async () => {
  const now = Date.now();
  const dependencies: HealthDependencies = {
    probeDatabase: async () => ({ state: 'live', detail: 'ok' }),
    probeBucket: async () => ({ state: 'live', detail: 'ok' }),
    probeMaritimeHub: async () => ({ state: 'live', detail: 'ok' }),
    probeProjector: async () => ({ state: 'degraded', detail: 'ping returned 503' }),
    probeSentinel: async () => ({ state: 'unknown', detail: 'binding unavailable' }),
  };

  const response = await healthRoute.request(
    'http://example.com/deep',
    { headers: { 'x-internal-token': 'configured-token' } },
    {
      INTERNAL_API_TOKEN: 'configured-token',
      FEED_BUCKET: {
        get: async () => ({
          json: async () => ({
            version: 'projection-1234',
            generated_at: now - 12_000,
            sections: {
              events: {
                state: 'live',
                source: 'events-db',
                updated_at: now - 30_000,
                last_success_at: now - 30_000,
                stale_after_ms: 90_000,
                last_error: null,
                data: [],
              },
              governor: {
                state: 'live',
                source: 'governor-db',
                updated_at: now - 30_000,
                last_success_at: now - 30_000,
                stale_after_ms: 90_000,
                last_error: null,
                data: { activation: { state: 'watch' } },
              },
              maritime: {
                state: 'live',
                source: 'maritime-hub',
                updated_at: now - 2 * 60_000,
                last_success_at: now - 2 * 60_000,
                stale_after_ms: 300_000,
                last_error: null,
                data: { vessels: [{ mmsi: '123456789' }] },
              },
              rail: {
                state: 'stale',
                source: 'odpt',
                updated_at: now - 6 * 60_000,
                last_success_at: now - 6 * 60_000,
                stale_after_ms: 300_000,
                last_error: null,
                data: { lines: [{ lineId: 'tokkaido-shinkansen' }] },
              },
            },
            source_updated: {
              events: now - 30_000,
              maritime: now - 2 * 60_000,
              rail: now - 6 * 60_000,
            },
          }),
        }),
      },
      HEALTH_DEPS: dependencies,
    } as never,
  );

  assert.equal(response.status, 200);
  const payload = await response.json() as {
    status: string;
    dependencies: {
      maritime_hub: { state: string };
      projection_projector: { state: string };
      sentinel: { state: string };
    };
    projection: {
      version: string | null;
      age_ms: number | null;
    };
    sections: {
      maritime: { state: string; source: string; updated_at: number | null };
      rail: { state: string; source: string; updated_at: number | null };
    };
    feeds: {
      events: { state: string };
      maritime: { state: string };
      rail: { state: string };
    };
    source_compliance: {
      status: string;
      sections: {
        events: { compliant: boolean };
        maritime: { compliant: boolean };
      };
    };
  };

  assert.equal(payload.status, 'degraded');
  assert.equal(payload.dependencies.maritime_hub.state, 'live');
  assert.equal(payload.dependencies.projection_projector.state, 'degraded');
  assert.equal(payload.dependencies.sentinel.state, 'unknown');
  assert.equal(payload.projection.version, 'projection-1234');
  assert.ok(payload.projection.age_ms !== null);
  assert.ok(payload.projection.age_ms >= 12_000);
  assert.ok(payload.projection.age_ms < 13_000);
  assert.equal(payload.sections.maritime.state, 'live');
  assert.equal(payload.sections.maritime.source, 'maritime-hub');
  assert.equal(payload.sections.rail.state, 'stale');
  assert.equal(payload.sections.rail.source, 'odpt');
  assert.equal(payload.feeds.events.state, 'live');
  assert.equal(payload.feeds.maritime.state, 'live');
  assert.equal(payload.feeds.rail.state, 'stale');
  assert.equal(payload.source_compliance.status, 'ok');
  assert.equal(payload.source_compliance.sections.events.compliant, true);
  assert.equal(payload.source_compliance.sections.maritime.compliant, true);
});

test('deep health flags projection source drift when section source is unknown', async () => {
  const now = Date.parse('2026-03-09T05:00:00.000Z');
  const snapshot = await createHealthSnapshot({
    env: {
      INTERNAL_API_TOKEN: 'configured-token',
      FEED_BUCKET: {
        get: async () => ({
          json: async () => ({
            version: 'projection-drift',
            generated_at: now - 5_000,
            sections: {
              events: {
                state: 'live',
                source: 'mystery-upstream',
                updated_at: now - 30_000,
                last_success_at: now - 30_000,
                stale_after_ms: 90_000,
                last_error: null,
                data: [],
              },
              governor: {
                state: 'live',
                source: 'governor-db',
                updated_at: now - 30_000,
                last_success_at: now - 30_000,
                stale_after_ms: 90_000,
                last_error: null,
                data: { activation: { state: 'watch' } },
              },
              maritime: {
                state: 'live',
                source: 'maritime-hub',
                updated_at: now - 30_000,
                last_success_at: now - 30_000,
                stale_after_ms: 300_000,
                last_error: null,
                data: { source: 'live', vessels: [] },
              },
              rail: {
                state: 'live',
                source: 'odpt',
                updated_at: now - 30_000,
                last_success_at: now - 30_000,
                stale_after_ms: 300_000,
                last_error: null,
                data: { source: 'odpt', lines: [] },
              },
            },
            source_updated: {
              events: now - 30_000,
              maritime: now - 30_000,
              rail: now - 30_000,
            },
          }),
        }),
      },
    } as never,
    now,
    deps: {
      probeDatabase: async () => ({ state: 'live', detail: 'ok' }),
      probeBucket: async () => ({ state: 'live', detail: 'ok' }),
      probeMaritimeHub: async () => ({ state: 'live', detail: 'ok' }),
      probeProjector: async () => ({ state: 'live', detail: 'ok' }),
      probeSentinel: async () => ({ state: 'live', detail: 'ok' }),
    },
  });

  assert.equal(snapshot.status, 'degraded');
  assert.equal(snapshot.source_compliance.status, 'drift');
  assert.equal(snapshot.source_compliance.sections.events.compliant, false);
  assert.equal(snapshot.source_compliance.sections.events.observed_source, 'mystery-upstream');
  assert.deepEqual(snapshot.source_compliance.sections.events.expected_sources, ['events-db', 'legacy-snapshot']);
});
