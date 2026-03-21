import test from 'node:test';
import assert from 'node:assert/strict';
import { findSimilarEvents } from '../src/context/similarity.ts';

test('findSimilarEvents maps SQL rows and enforces limit', async () => {
  const db = {
    async execute() {
      return {
        rows: [
          {
            id: 'evt-a',
            lat: 35.8,
            lng: 140.1,
            depth_km: 18,
            magnitude: 6.9,
            time: new Date('2025-01-01T00:00:00.000Z'),
            place: 'Chiba',
            distance_km: 41.234,
          },
          {
            id: 'evt-b',
            lat: 36.1,
            lng: 140.4,
            depth_km: 25,
            magnitude: 6.7,
            time: '2024-01-02T00:00:00.000Z',
            place: 'Ibaraki',
            distance_km: 73.006,
          },
        ],
      };
    },
  } as any;

  const rows = await findSimilarEvents(db, {
    lat: 35.7,
    lng: 139.7,
    depth_km: 20,
    magnitude: 7.0,
    time: new Date('2026-01-01T00:00:00.000Z'),
  }, 1);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'evt-a');
  assert.equal(rows[0].distance_km, 41.2);
  assert.ok(rows[0].time instanceof Date);
});

test('findSimilarEvents returns empty array when query fails', async () => {
  const db = {
    async execute() {
      throw new Error('db unavailable');
    },
  } as any;

  const rows = await findSimilarEvents(db, {
    lat: 35.7,
    lng: 139.7,
    depth_km: 20,
    magnitude: 7.0,
    time: new Date('2026-01-01T00:00:00.000Z'),
  });

  assert.deepEqual(rows, []);
});
