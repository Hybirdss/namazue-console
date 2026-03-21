import test from 'node:test';
import assert from 'node:assert/strict';

import { referenceRoute } from '../src/routes/reference.ts';

test('reference assets route serves merged asset catalog from bucket-backed data', async () => {
  const response = await referenceRoute.request(
    'http://example.com/assets',
    undefined,
    {
      FEED_BUCKET: {
        async get(key: string) {
          assert.equal(key, 'reference/infrastructure.json');
          return {
            async json() {
              return [
                {
                  id: 'grid-tokyo-east',
                  region: 'kanto',
                  class: 'power_substation',
                  name: 'Tokyo East Grid Node',
                  lat: 35.64,
                  lng: 139.82,
                  tags: ['grid'],
                  minZoomTier: 'regional',
                },
              ];
            },
          };
        },
      },
    } as never,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /max-age=300/);

  const payload = await response.json() as {
    source: string;
    total: number;
    assets: Array<{ id: string }>;
  };

  assert.equal(payload.source, 'bucket');
  assert.ok(payload.assets.some((asset) => asset.id === 'npp-tomari'));
  assert.ok(payload.assets.some((asset) => asset.id === 'grid-tokyo-east'));
  assert.equal(payload.total, payload.assets.length);
});

test('reference power route serves worker-owned power catalog payload', async () => {
  const response = await referenceRoute.request('http://example.com/power');
  assert.equal(response.status, 200);

  const payload = await response.json() as {
    plants: Array<{ id: string; type: string }>;
    total: number;
  };

  assert.equal(payload.total, payload.plants.length);
  assert.ok(payload.plants.some((plant) => plant.id === 'npp-onagawa' && plant.type === 'nuclear'));
});

test('reference municipalities route serves official dataset metadata', async () => {
  const response = await referenceRoute.request('http://example.com/municipalities');
  assert.equal(response.status, 200);

  const payload = await response.json() as {
    total: number;
    metadata: { totalPopulation: number };
    municipalities: Array<{ code: string }>;
  };

  assert.equal(payload.total, payload.municipalities.length);
  assert.equal(payload.metadata.totalPopulation, 124_330_690);
  assert.ok(payload.municipalities.some((municipality) => municipality.code === '01101'));
});

test('reference rail route exposes canonical line ids and ODPT mappings', async () => {
  const response = await referenceRoute.request('http://example.com/rail');
  assert.equal(response.status, 200);

  const payload = await response.json() as {
    lines: Array<{ lineId: string; odptRailways: string[] }>;
    line_id_map: Record<string, string>;
    operators: string[];
  };

  assert.equal(payload.line_id_map['JR-Central.Tokaido'], 'tokaido');
  assert.ok(payload.operators.includes('odpt.Operator:JR-West'));
  assert.ok(payload.lines.some((line) => line.lineId === 'tohoku' && line.odptRailways.includes('JR-East.TohokuShinkansen')));
});

test('reference playbook route exposes ports and response timeline templates', async () => {
  const response = await referenceRoute.request('http://example.com/playbook');
  assert.equal(response.status, 200);

  const payload = await response.json() as {
    ports: Array<{ name: string }>;
    response_timeline: Array<{ id: string; minutesAfter: number }>;
  };

  assert.ok(payload.ports.some((port) => port.name === 'Tokyo Bay'));
  assert.ok(payload.response_timeline.some((milestone) => milestone.id === 'tsunami' && milestone.minutesAfter === 10));
});
