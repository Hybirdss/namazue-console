import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { buildRuntimeSourcesPayload, isGovernorState } from '../governor/sourceRegistry.ts';
import { MAJOR_PORTS, RESPONSE_MILESTONE_TEMPLATES } from '../reference/impactPlaybook.ts';

export const runtimeRoute = new Hono<{ Bindings: Env }>();

const HUB_NAME = 'japan-maritime-hub';
const HUB_URL = 'https://maritime-hub/runtime';

runtimeRoute.get('/sources', (c) => {
  const rawState = (c.req.query('state') ?? 'calm').toLowerCase();
  if (!isGovernorState(rawState)) {
    return c.json(
      {
        error: `state must be one of: calm|watch|incident|recovery`,
      },
      400,
    );
  }

  return c.json(buildRuntimeSourcesPayload(rawState));
});

runtimeRoute.get('/playbook', (c) => {
  return c.json({
    ports: MAJOR_PORTS,
    response_timeline: RESPONSE_MILESTONE_TEMPLATES,
  });
});

runtimeRoute.get('/', async (c) => {
  if (!c.env.MARITIME_HUB) {
    return c.json({ error: 'Maritime hub unavailable' }, 503);
  }

  const hubRequestUrl = new URL(HUB_URL);
  const ALLOWED_PARAMS = new Set(['west', 'south', 'east', 'north', 'limit', 'profile']);
  const inbound = new URL(c.req.url).searchParams;
  const forwarded = new URLSearchParams();
  for (const [key, val] of inbound.entries()) {
    if (ALLOWED_PARAMS.has(key)) forwarded.set(key, val);
  }
  hubRequestUrl.search = forwarded.toString();
  const stub = c.env.MARITIME_HUB.getByName(HUB_NAME);
  const response = await stub.fetch(hubRequestUrl.toString());

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
});
