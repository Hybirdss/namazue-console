import test from 'node:test';
import assert from 'node:assert/strict';

import { publishProjectionUpdate } from '../src/lib/feedPublisher.ts';
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

test('publishProjectionUpdate writes a coherent snapshot and legacy feeds from one build', async () => {
  const previous = createPreviousProjection();
  const { bucket, objects } = createBucket(previous);

  const next = await publishProjectionUpdate({
    bucket: bucket as never,
    now: 5_000,
    updates: {
      events: {
        source: 'events-db',
        stale_after_ms: 90_000,
        data: [{ id: 'evt-2', magnitude: 6.4 }],
      },
      governor: {
        source: 'governor-db',
        stale_after_ms: 90_000,
        data: { activation: { state: 'incident' } },
      },
    },
  });

  assert.equal(next.generated_at, 5_000);
  assert.deepEqual(next.events, [{ id: 'evt-2', magnitude: 6.4 }]);
  assert.deepEqual(next.maritime, previous.maritime);
  assert.ok(objects.has('feed/snapshot.json'));
  assert.ok(objects.has('feed/events.json'));
  assert.ok(objects.has('feed/governor.json'));
  assert.ok(objects.has('feed/maritime.json'));
  assert.ok(objects.has('feed/rail.json'));

  const snapshot = JSON.parse(objects.get('feed/snapshot.json')!);
  const eventsFeed = JSON.parse(objects.get('feed/events.json')!);
  const governorFeed = JSON.parse(objects.get('feed/governor.json')!);
  const maritimeFeed = JSON.parse(objects.get('feed/maritime.json')!);

  assert.deepEqual(snapshot.events, [{ id: 'evt-2', magnitude: 6.4 }]);
  assert.deepEqual(eventsFeed.events, [{ id: 'evt-2', magnitude: 6.4 }]);
  assert.deepEqual(governorFeed, { activation: { state: 'incident' } });
  assert.deepEqual(maritimeFeed, previous.maritime);
});
