import test from 'node:test';
import assert from 'node:assert/strict';

import { publishProjectionViaProjector } from '../src/lib/projectionProjectorClient.ts';

test('publishProjectionViaProjector sends projection updates to the projector durable object', async () => {
  const requests: Array<{ url: string; method: string; body: unknown }> = [];

  await publishProjectionViaProjector(
    {
      PROJECTION_PROJECTOR: {
        idFromName(name: string) {
          assert.equal(name, 'operator-projection-projector');
          return 'projection-id';
        },
        get(id: string) {
          assert.equal(id, 'projection-id');
          return {
            async fetch(url: string, init?: RequestInit) {
              requests.push({
                url,
                method: init?.method ?? 'GET',
                body: init?.body ? JSON.parse(String(init.body)) : null,
              });
              return Response.json({ version: 'projection-5000', generated_at: 5000 });
            },
          };
        },
      },
    } as never,
    {
      now: 5_000,
      updates: {
        events: {
          source: 'events-db',
          stale_after_ms: 90_000,
          data: [{ id: 'evt-9', magnitude: 5.9 }],
        },
      },
    },
  );

  assert.deepEqual(requests, [{
    url: 'https://projection-projector/publish',
    method: 'POST',
    body: {
      now: 5_000,
      updates: {
        events: {
          source: 'events-db',
          stale_after_ms: 90_000,
          data: [{ id: 'evt-9', magnitude: 5.9 }],
        },
      },
    },
  }]);
});
