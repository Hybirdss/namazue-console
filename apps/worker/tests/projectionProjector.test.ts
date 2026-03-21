import test from 'node:test';
import assert from 'node:assert/strict';

import { ProjectionProjector } from '../src/durableObjects/projectionProjector.ts';
import type { OperatorProjection } from '../src/lib/projectionBuilder.ts';

function createBucket(seedProjection?: OperatorProjection) {
  const objects = new Map<string, string>();

  if (seedProjection) {
    objects.set('feed/snapshot.json', JSON.stringify(seedProjection));
  }

  return {
    objects,
    bucket: {
      async get(key: string) {
        const body = objects.get(key);
        if (!body) return null;
        return {
          async json() {
            return JSON.parse(body);
          },
          async text() {
            return body;
          },
        };
      },
      async put(key: string, body: string) {
        objects.set(key, body);
      },
    },
  };
}

function createPreviousProjection(): OperatorProjection {
  return {
    version: 'projection-1000',
    generated_at: 1000,
    sections: {
      events: {
        state: 'live',
        source: 'events-db',
        updated_at: 900,
        last_success_at: 900,
        stale_after_ms: 90_000,
        last_error: null,
        data: [{ id: 'evt-1', magnitude: 5.2 }],
      },
      governor: {
        state: 'live',
        source: 'governor-db',
        updated_at: 900,
        last_success_at: 900,
        stale_after_ms: 90_000,
        last_error: null,
        data: { activation: { state: 'watch' } },
      },
      maritime: {
        state: 'live',
        source: 'aisstream',
        updated_at: 950,
        last_success_at: 950,
        stale_after_ms: 300_000,
        last_error: null,
        data: {
          source: 'aisstream',
          generated_at: 950,
          vessels: [{ mmsi: '123456789' }],
        },
      },
      rail: {
        state: 'live',
        source: 'odpt',
        updated_at: 960,
        last_success_at: 960,
        stale_after_ms: 300_000,
        last_error: null,
        data: {
          source: 'odpt',
          updatedAt: 960,
          lines: [{ lineId: 'tokaido', status: 'normal', updatedAt: 960 }],
        },
      },
    },
    domain_overrides: {},
    events: [{ id: 'evt-1', magnitude: 5.2 }],
    count: 1,
    governor: { activation: { state: 'watch' } },
    maritime: {
      source: 'aisstream',
      generated_at: 950,
      vessels: [{ mmsi: '123456789' }],
    },
    rail: {
      source: 'odpt',
      updatedAt: 960,
      lines: [{ lineId: 'tokaido', status: 'normal', updatedAt: 960 }],
    },
    source_updated: {
      events: 900,
      maritime: 950,
      rail: 960,
    },
  };
}

test('ProjectionProjector publishes one coherent projection document per request', async () => {
  const { bucket, objects } = createBucket(createPreviousProjection());
  const projector = new ProjectionProjector(
    {} as DurableObjectState,
    { FEED_BUCKET: bucket } as never,
  );

  const response = await projector.fetch(new Request('https://projector/publish', {
    method: 'POST',
    body: JSON.stringify({
      now: 6_000,
      updates: {
        events: {
          source: 'events-db',
          stale_after_ms: 90_000,
          data: [{ id: 'evt-3', magnitude: 6.8 }],
        },
        governor: {
          source: 'governor-db',
          stale_after_ms: 90_000,
          data: { activation: { state: 'incident' } },
        },
      },
    }),
  }));

  assert.equal(response.status, 200);

  const payload = await response.json() as { version: string; generated_at: number };
  assert.ok(payload.version.startsWith('projection-'));
  assert.equal(payload.generated_at, 6_000);

  const snapshot = JSON.parse(objects.get('feed/snapshot.json')!);
  assert.deepEqual(snapshot.events, [{ id: 'evt-3', magnitude: 6.8 }]);
  assert.deepEqual(snapshot.maritime, {
    source: 'aisstream',
    generated_at: 950,
    vessels: [{ mmsi: '123456789' }],
  });
});
