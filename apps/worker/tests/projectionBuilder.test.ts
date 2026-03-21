import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOperatorProjection,
  type OperatorProjection,
} from '../src/lib/projectionBuilder.ts';
import type { OpsAsset } from '../../globe/src/ops/types.ts';

const REFERENCE_ASSETS: OpsAsset[] = [
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
  {
    id: 'water-tokyo-bay',
    region: 'kanto',
    class: 'water_facility',
    name: 'Tokyo Bay Water Plant',
    lat: 35.64,
    lng: 139.82,
    tags: ['water'],
    minZoomTier: 'regional',
  },
  {
    id: 'hospital-tokyo-bay',
    region: 'kanto',
    class: 'hospital',
    name: 'Tokyo Bay Medical Center',
    lat: 35.64,
    lng: 139.82,
    tags: ['medical'],
    minZoomTier: 'regional',
  },
];

function createProjectionFixture(): OperatorProjection {
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
        data: [
          { id: 'evt-1', magnitude: 5.4 },
        ],
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
    events: [{ id: 'evt-1', magnitude: 5.4 }],
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

test('buildOperatorProjection preserves last-known-good maritime data on upstream failure', () => {
  const previous = createProjectionFixture();

  const next = buildOperatorProjection({
    previous,
    now: 2_000,
    updates: {
      maritime: {
        source: 'aisstream',
        stale_after_ms: 300_000,
        error: 'AISstream timeout',
        fallbackData: { source: 'none', generated_at: 2_000, vessels: [] },
      },
    },
  }, {
    assets: REFERENCE_ASSETS,
  });

  assert.equal(next.sections.maritime.state, 'degraded');
  assert.equal(next.sections.maritime.last_error, 'AISstream timeout');
  assert.equal(next.sections.maritime.updated_at, 950);
  assert.equal(next.sections.maritime.last_success_at, 950);
  assert.deepEqual(next.maritime, previous.maritime);
  assert.deepEqual(next.sections.maritime.data, previous.sections.maritime.data);
});

test('buildOperatorProjection marks a section down when the first publish attempt fails', () => {
  const next = buildOperatorProjection({
    previous: null,
    now: 3_000,
    updates: {
      rail: {
        source: 'odpt',
        stale_after_ms: 300_000,
        error: 'ODPT unavailable',
        fallbackData: { source: 'fallback', updatedAt: 0, lines: [] },
      },
    },
  }, {
    assets: REFERENCE_ASSETS,
  });

  assert.equal(next.sections.rail.state, 'down');
  assert.equal(next.sections.rail.last_error, 'ODPT unavailable');
  assert.equal(next.sections.rail.updated_at, 0);
  assert.equal(next.sections.rail.last_success_at, 0);
  assert.deepEqual(next.rail, { source: 'fallback', updatedAt: 0, lines: [] });
});

test('buildOperatorProjection emits one coherent snapshot for a full publish', () => {
  const now = 4_000;

  const next = buildOperatorProjection({
    previous: null,
    now,
    updates: {
      events: {
        source: 'events-db',
        stale_after_ms: 90_000,
        data: [{
          id: 'evt-2',
          lat: 35.64,
          lng: 139.82,
          depth_km: 24,
          magnitude: 7.0,
          time: new Date(now - 60_000).toISOString(),
          place: 'Tokyo Bay operator corridor',
          fault_type: 'interface',
          tsunami: true,
        }],
      },
      governor: {
        source: 'governor-db',
        stale_after_ms: 90_000,
        data: { activation: { state: 'incident' } },
      },
      maritime: {
        source: 'aisstream',
        stale_after_ms: 300_000,
        data: { source: 'aisstream', generated_at: now, vessels: [{ mmsi: '987654321' }] },
      },
      rail: {
        source: 'odpt',
        stale_after_ms: 300_000,
        data: { source: 'odpt', updatedAt: now, lines: [{ lineId: 'tokaido', status: 'delayed', cause: 'Signal inspection', updatedAt: now }] },
      },
    },
  }, {
    assets: REFERENCE_ASSETS,
  });

  assert.ok(next.version.startsWith('projection-'));
  assert.equal(next.generated_at, now);
  assert.equal(next.source_updated.events, now);
  assert.equal(next.source_updated.maritime, now);
  assert.equal(next.source_updated.rail, now);
  assert.equal(next.sections.events.updated_at, now);
  assert.equal(next.sections.governor.updated_at, now);
  assert.equal(next.sections.maritime.updated_at, now);
  assert.equal(next.sections.rail.updated_at, now);
  assert.deepEqual(next.events, [{
    id: 'evt-2',
    lat: 35.64,
    lng: 139.82,
    depth_km: 24,
    magnitude: 7.0,
    time: new Date(now - 60_000).toISOString(),
    place: 'Tokyo Bay operator corridor',
    fault_type: 'interface',
    tsunami: true,
  }]);
  assert.equal(next.count, 1);
  assert.deepEqual(next.governor, { activation: { state: 'incident' } });
  assert.deepEqual(next.maritime, { source: 'aisstream', generated_at: now, vessels: [{ mmsi: '987654321' }] });
  assert.deepEqual(next.rail, { source: 'odpt', updatedAt: now, lines: [{ lineId: 'tokaido', status: 'delayed', cause: 'Signal inspection', updatedAt: now }] });
  assert.deepEqual(next.domain_overrides.lifelines?.map((domain) => domain.id), ['rail', 'power', 'water']);
  assert.equal(next.domain_overrides.lifelines?.[0]?.availability, 'live');
  assert.equal(next.domain_overrides.lifelines?.[1]?.eventId, 'evt-2');
  assert.equal(next.domain_overrides.lifelines?.[2]?.eventId, 'evt-2');
  assert.deepEqual(next.domain_overrides.medical?.map((domain) => domain.id), ['hospital']);
  assert.equal(next.domain_overrides.medical?.[0]?.eventId, 'evt-2');
});
