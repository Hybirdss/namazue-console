import test from 'node:test';
import assert from 'node:assert/strict';

import { eventsRoute } from '../src/routes/events.ts';
import { analyzeRoute } from '../src/routes/analyze.ts';

const VALID_EVENT = {
  id: 'test-event-1',
  lat: 35.68,
  lng: 139.76,
  depth_km: 10,
  magnitude: 5.1,
  time: '2026-03-09T00:00:00.000Z',
  source: 'jma',
};

test('events ingest returns 503 when INTERNAL_API_TOKEN is not configured', async () => {
  const response = await eventsRoute.request(
    'http://example.com/ingest',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: VALID_EVENT }),
    },
    {} as never,
  );

  assert.equal(response.status, 503);
  const payload = await response.json() as { error: string };
  assert.equal(payload.error, 'Internal route is disabled');
});

test('events ingest returns 401 when INTERNAL_API_TOKEN is configured but missing from the request', async () => {
  const response = await eventsRoute.request(
    'http://example.com/ingest',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: VALID_EVENT }),
    },
    {
      INTERNAL_API_TOKEN: 'secret-token',
    } as never,
  );

  assert.equal(response.status, 401);
  const payload = await response.json() as { error: string };
  assert.equal(payload.error, 'Unauthorized');
});

test('events bulk ingest returns 503 when INTERNAL_API_TOKEN is not configured', async () => {
  const response = await eventsRoute.request(
    'http://example.com/ingest/bulk',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [VALID_EVENT] }),
    },
    {} as never,
  );

  assert.equal(response.status, 503);
  const payload = await response.json() as { error: string };
  assert.equal(payload.error, 'Internal route is disabled');
});

test('analyze generate returns 503 when INTERNAL_API_TOKEN is not configured', async () => {
  const response = await analyzeRoute.request(
    'http://example.com/generate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: 'test-event-1' }),
    },
    {} as never,
  );

  assert.equal(response.status, 503);
  const payload = await response.json() as { error: string };
  assert.equal(payload.error, 'Internal route is disabled');
});

test('analyze generate returns 401 when INTERNAL_API_TOKEN is configured but missing from the request', async () => {
  const response = await analyzeRoute.request(
    'http://example.com/generate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: 'test-event-1' }),
    },
    {
      INTERNAL_API_TOKEN: 'secret-token',
    } as never,
  );

  assert.equal(response.status, 401);
  const payload = await response.json() as { error: string };
  assert.equal(payload.error, 'Unauthorized');
});
