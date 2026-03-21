import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { loadReferenceAssetCatalog } from '../reference/assets.ts';
import { RESPONSE_MILESTONE_TEMPLATES, MAJOR_PORTS } from '../reference/impactPlaybook.ts';
import { MUNICIPALITY_DATA, MUNICIPALITY_DATASET_METADATA } from '../reference/municipalities.ts';
import { POWER_PLANTS } from '../reference/powerCatalog.ts';
import { JR_OPERATORS, LINE_ID_MAP, RAIL_REFERENCE_LINES } from '../reference/railCatalog.ts';

export const referenceRoute = new Hono<{ Bindings: Env }>();

function applyCacheHeaders(response: Response, maxAgeSeconds: number): Response {
  response.headers.set('Cache-Control', `public, max-age=${maxAgeSeconds}, s-maxage=${maxAgeSeconds}`);
  return response;
}

referenceRoute.get('/assets', async (c) => {
  const catalog = await loadReferenceAssetCatalog({
    FEED_BUCKET: c.env.FEED_BUCKET,
    REFERENCE_DATA_BASE_URL: c.env.REFERENCE_DATA_BASE_URL,
  });

  return applyCacheHeaders(
    c.json({
      assets: catalog.assets,
      source: catalog.source,
      total: catalog.assets.length,
    }),
    300,
  );
});

referenceRoute.get('/power', (c) => {
  return applyCacheHeaders(
    c.json({
      plants: POWER_PLANTS,
      total: POWER_PLANTS.length,
    }),
    3600,
  );
});

referenceRoute.get('/rail', (c) => {
  return applyCacheHeaders(
    c.json({
      lines: RAIL_REFERENCE_LINES,
      line_id_map: LINE_ID_MAP,
      operators: JR_OPERATORS,
    }),
    3600,
  );
});

referenceRoute.get('/municipalities', (c) => {
  return applyCacheHeaders(
    c.json({
      municipalities: MUNICIPALITY_DATA,
      metadata: MUNICIPALITY_DATASET_METADATA,
      total: MUNICIPALITY_DATA.length,
    }),
    3600,
  );
});

referenceRoute.get('/playbook', (c) => {
  return applyCacheHeaders(
    c.json({
      ports: MAJOR_PORTS,
      response_timeline: RESPONSE_MILESTONE_TEMPLATES,
    }),
    3600,
  );
});
