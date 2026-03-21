import test from 'node:test';
import assert from 'node:assert/strict';

import { runtimeRoute } from '../src/routes/runtime.ts';

test('runtime route returns current governor activation and cadence policy', async () => {
  let forwardedUrl = '';

  const response = await runtimeRoute.request(
    'http://example.com/',
    undefined,
    {
      MARITIME_HUB: {
        getByName(name: string) {
          assert.equal(name, 'japan-maritime-hub');
          return {
            fetch(request: Request | string | URL) {
              forwardedUrl = String(request);
              return Response.json({
                governor: {
                  state: 'incident',
                  activated_at: '2026-03-07T05:00:00.000Z',
                  reason: 'major offshore event activated incident mode',
                  region_scope: { kind: 'regional', region_ids: ['kanto'] },
                },
                policies: {
                  events: { source: 'events', cadenceMode: 'poll', refreshMs: 15_000 },
                  maritime: { source: 'maritime', cadenceMode: 'poll', refreshMs: 10_000 },
                },
                fanout: {
                  mode: 'incident-scoped',
                  push_available: false,
                  viewer_refresh_ms: 10_000,
                },
              });
            },
          };
        },
      },
    } as never,
  );

  assert.equal(response.status, 200);

  const payload = await response.json() as {
    governor: { state: string; reason: string };
    policies: { maritime: { refreshMs: number } };
    fanout: { mode: string; push_available: boolean; viewer_refresh_ms: number };
  };

  assert.equal(payload.governor.state, 'incident');
  assert.match(payload.governor.reason, /incident mode/i);
  assert.equal(payload.policies.maritime.refreshMs, 10_000);
  assert.equal(payload.fanout.mode, 'incident-scoped');
  assert.equal(payload.fanout.push_available, false);
  assert.equal(payload.fanout.viewer_refresh_ms, 10_000);
  assert.match(forwardedUrl, /https:\/\/maritime-hub\/runtime/);
});

test('runtime route returns 503 when the durable object binding is unavailable', async () => {
  const response = await runtimeRoute.request('http://example.com/', undefined, {} as never);
  assert.equal(response.status, 503);

  const payload = await response.json() as { error: string };
  assert.equal(payload.error, 'Maritime hub unavailable');
});

test('runtime sources route returns canonical governed source registry', async () => {
  const response = await runtimeRoute.request('http://example.com/sources');
  assert.equal(response.status, 200);

  const payload = await response.json() as {
    states: string[];
    governed_sources: Record<
      string,
      {
        source_class: string;
        cadence_mode: string;
        refresh_ms: number | null;
      }
    >;
    projection_section_sources: Record<string, readonly string[]>;
  };

  assert.deepEqual(payload.states, ['calm', 'watch', 'incident', 'recovery']);
  assert.equal(payload.governed_sources.events.source_class, 'event-truth');
  assert.equal(payload.governed_sources.events.cadence_mode, 'poll');
  assert.equal(payload.governed_sources.events.refresh_ms, 60_000);
  assert.equal(payload.governed_sources.hospitals.cadence_mode, 'event-driven');
  assert.equal(payload.governed_sources.hospitals.refresh_ms, null);
  assert.deepEqual(payload.projection_section_sources.events, ['events-db', 'legacy-snapshot']);
  assert.deepEqual(payload.projection_section_sources.maritime, ['maritime-hub', 'legacy-snapshot']);
});

test('runtime playbook route returns worker-owned operational playbook data', async () => {
  const response = await runtimeRoute.request('http://example.com/playbook');
  assert.equal(response.status, 200);

  const payload = await response.json() as {
    ports: Array<{ name: string }>;
    response_timeline: Array<{ translationKey: string; labelJa: string }>;
  };

  assert.ok(payload.ports.some((port) => port.name === 'Sendai'));
  assert.ok(payload.response_timeline.some((milestone) =>
    milestone.translationKey === 'response.cabinet' && milestone.labelJa.includes('閣議')));
});
