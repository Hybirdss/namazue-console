import { beforeEach, describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import { earthquakeStore } from '../earthquakeStore';

const baseEvent: EarthquakeEvent = {
  id: 'eq-1',
  lat: 35.7,
  lng: 139.7,
  depth_km: 24,
  magnitude: 6.8,
  time: 1_700_000_000_000,
  faultType: 'interface',
  tsunami: true,
  place: { text: 'Sagami corridor' },
};

describe('earthquakeStore', () => {
  beforeEach(() => {
    earthquakeStore.clear();
  });

  it('retains canonical event envelope metadata alongside normalized events', () => {
    earthquakeStore.upsert([baseEvent], {
      source: 'usgs',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_500,
    });

    const envelope = earthquakeStore.getEnvelope('eq-1');

    expect(envelope?.source).toBe('usgs');
    expect(envelope?.revision).toBe('usgs:1700000001000:eq-1');
    expect(earthquakeStore.get('eq-1')?.id).toBe('eq-1');
  });

  it('upgrades an event when a newer higher-trust revision arrives', () => {
    earthquakeStore.upsert([baseEvent], {
      source: 'usgs',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_500,
    });
    earthquakeStore.upsert([{ ...baseEvent, magnitude: 7.0 }], {
      source: 'server',
      issuedAt: 1_700_000_002_000,
      receivedAt: 1_700_000_002_500,
    });

    const envelope = earthquakeStore.getEnvelope('eq-1');

    expect(envelope?.source).toBe('server');
    expect(envelope?.supersedes).toBe('usgs:1700000001000:eq-1');
    expect(earthquakeStore.get('eq-1')?.magnitude).toBe(7.0);
    expect(earthquakeStore.getRevisionHistory('eq-1')).toHaveLength(2);
    expect(earthquakeStore.getRevisionHistory('eq-1').map((entry) => entry.source)).toEqual([
      'usgs',
      'server',
    ]);
  });

  it('keeps the latest receipt when the same revision arrives again out of order', () => {
    earthquakeStore.upsert([baseEvent], {
      source: 'usgs',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_900,
    });
    earthquakeStore.upsert([{ ...baseEvent, magnitude: 6.1 }], {
      source: 'usgs',
      issuedAt: 1_700_000_001_000,
      receivedAt: 1_700_000_001_100,
    });

    const history = earthquakeStore.getRevisionHistory('eq-1');

    expect(history).toHaveLength(1);
    expect(history[0]?.receivedAt).toBe(1_700_000_001_900);
    expect(history[0]?.event.magnitude).toBe(6.8);
  });

  it('drops revision history for pruned events and bounds per-event history growth', () => {
    const now = Date.now();
    const oldTime = now - (8 * 24 * 60 * 60 * 1000);
    const recentTime = now - 60_000;

    earthquakeStore.upsert([
      {
        ...baseEvent,
        id: 'old-eq',
        time: oldTime,
      },
    ], {
      source: 'usgs',
      issuedAt: oldTime,
      receivedAt: oldTime + 500,
    });

    for (let index = 0; index < 20; index += 1) {
      const issuedAt = 1_700_000_001_000 + index * 1_000;
      earthquakeStore.upsert([{ ...baseEvent, time: recentTime, magnitude: 6.8 + index * 0.01 }], {
        source: index % 2 === 0 ? 'server' : 'usgs',
        issuedAt,
        receivedAt: issuedAt + 200,
      });
    }

    const pruned = earthquakeStore.prune();

    expect(pruned).toBe(1);
    expect(earthquakeStore.get('old-eq')).toBeUndefined();
    expect(earthquakeStore.getRevisionHistory('old-eq')).toEqual([]);
    expect(earthquakeStore.getRevisionHistory('eq-1')).toHaveLength(12);
  });
});
