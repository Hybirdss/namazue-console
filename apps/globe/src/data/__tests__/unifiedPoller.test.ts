import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUnifiedPoller, resolveDynamicSectionData } from '../unifiedPoller';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('unifiedPoller projection truth', () => {
  it('surfaces degraded snapshot sections without dropping last-known-good data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 'projection-5000',
        generated_at: 5_000,
        sections: {
          events: {
            state: 'live',
            source: 'events-db',
            updated_at: 5_000,
            last_success_at: 5_000,
            stale_after_ms: 90_000,
            last_error: null,
            data: [{
              id: 'evt-1',
              lat: 35.68,
              lng: 139.76,
              depth_km: 12,
              magnitude: 5.8,
              time: '2026-03-09T00:00:00.000Z',
              place: 'Tokyo Bay',
              fault_type: 'interface',
              tsunami: false,
            }],
          },
          governor: {
            state: 'live',
            source: 'governor-db',
            updated_at: 5_000,
            last_success_at: 5_000,
            stale_after_ms: 90_000,
            last_error: null,
            data: { activation: { state: 'watch' } },
          },
          maritime: {
            state: 'degraded',
            source: 'maritime-hub',
            updated_at: 4_900,
            last_success_at: 4_900,
            stale_after_ms: 300_000,
            last_error: 'AISstream timeout',
            data: {
              source: 'aisstream',
              generated_at: 4_900,
              vessels: [{ mmsi: '123456789', lat: 35.1, lng: 140.1, trail: [] }],
            },
          },
          rail: {
            state: 'live',
            source: 'odpt',
            updated_at: 4_800,
            last_success_at: 4_800,
            stale_after_ms: 300_000,
            last_error: null,
            data: {
              source: 'odpt',
              updatedAt: 4_800,
              lines: [{ lineId: 'tokkaido-shinkansen' }],
            },
          },
        },
        events: [{
          id: 'evt-1',
          lat: 35.68,
          lng: 139.76,
          depth_km: 12,
          magnitude: 5.8,
          time: '2026-03-09T00:00:00.000Z',
          place: 'Tokyo Bay',
          fault_type: 'interface',
          tsunami: false,
        }],
        count: 1,
        governor: { activation: { state: 'watch' } },
        maritime: {
          source: 'aisstream',
          generated_at: 4_900,
          vessels: [{ mmsi: '123456789', lat: 35.1, lng: 140.1, trail: [] }],
        },
        rail: {
          source: 'odpt',
          updatedAt: 4_800,
          lines: [{ lineId: 'tokkaido-shinkansen' }],
        },
        domain_overrides: {
          lifelines: [
            {
              id: 'rail',
              label: 'Rail',
              eventId: 'evt-1',
              metric: '1 rail corridor nominal',
              detail: 'Live rail telemetry shows nominal posture across monitored Shinkansen corridors.',
              severity: 'clear',
              availability: 'live',
              trust: 'confirmed',
              counters: [],
              signals: [],
            },
          ],
        },
        source_updated: {
          events: 5_000,
          maritime: 4_900,
          rail: 4_800,
        },
      }),
    }));

    const poller = createUnifiedPoller({
      onUpdate: () => {},
      onError: () => {},
      initialRefreshMs: 60_000,
      snapshotBaseUrl: 'https://snapshot.example.com',
    });

    const result = await poller.poll();

    expect(result.source).toBe('snapshot');
    expect(result.events).toHaveLength(1);
    expect(result.vessels).toHaveLength(1);
    expect(result.railStatuses).toHaveLength(1);
    expect(result.domainOverrides.lifelines?.[0]?.id).toBe('rail');
    expect(result.domainOverrides.lifelines?.[0]?.eventId).toBe('evt-1');
    expect(result.realtimeStatus.state).toBe('degraded');
    expect(result.realtimeStatus.source).toBe('server');
    expect(result.realtimeStatus.message).toContain('Maritime');
    expect(result.realtimeStatus.message).toContain('AISstream timeout');
    expect(result.projectionFreshness).toEqual({
      events: 5_000,
      maritime: 4_900,
      rail: 4_800,
    });
  });

  it('preserves last-known-good dynamic sections when a degraded snapshot omits them', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          generated_at: 5_000,
          sections: {
            events: {
              state: 'live',
              source: 'events-db',
              updated_at: 5_000,
              last_success_at: 5_000,
              stale_after_ms: 90_000,
              last_error: null,
              data: [],
            },
            governor: {
              state: 'live',
              source: 'governor-db',
              updated_at: 5_000,
              last_success_at: 5_000,
              stale_after_ms: 90_000,
              last_error: null,
              data: null,
            },
            maritime: {
              state: 'live',
              source: 'maritime-hub',
              updated_at: 4_900,
              last_success_at: 4_900,
              stale_after_ms: 300_000,
              last_error: null,
              data: { vessels: [{ mmsi: '123456789', lat: 35.1, lng: 140.1, trail: [] }] },
            },
            rail: {
              state: 'live',
              source: 'odpt',
              updated_at: 4_800,
              last_success_at: 4_800,
              stale_after_ms: 300_000,
              last_error: null,
              data: { lines: [{ lineId: 'tokkaido-shinkansen' }] },
            },
          },
          events: [],
          count: 0,
          governor: null,
          maritime: { vessels: [{ mmsi: '123456789', lat: 35.1, lng: 140.1, trail: [] }] },
          rail: { lines: [{ lineId: 'tokkaido-shinkansen' }] },
          domain_overrides: {
            lifelines: [
              {
                id: 'rail',
                label: 'Rail',
                eventId: 'evt-1',
                metric: '1 rail corridor nominal',
                detail: 'Live rail telemetry shows nominal posture.',
                severity: 'clear',
                availability: 'live',
                trust: 'confirmed',
                counters: [],
                signals: [],
              },
            ],
          },
          source_updated: {
            events: 5_000,
            maritime: 4_900,
            rail: 4_800,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          generated_at: 6_000,
          sections: {
            events: {
              state: 'live',
              source: 'events-db',
              updated_at: 6_000,
              last_success_at: 6_000,
              stale_after_ms: 90_000,
              last_error: null,
              data: [],
            },
            governor: {
              state: 'live',
              source: 'governor-db',
              updated_at: 6_000,
              last_success_at: 6_000,
              stale_after_ms: 90_000,
              last_error: null,
              data: null,
            },
            maritime: {
              state: 'degraded',
              source: 'maritime-hub',
              updated_at: 5_900,
              last_success_at: 5_900,
              stale_after_ms: 300_000,
              last_error: 'AISstream timeout',
              data: {},
            },
            rail: {
              state: 'down',
              source: 'odpt',
              updated_at: 5_800,
              last_success_at: 5_800,
              stale_after_ms: 300_000,
              last_error: 'ODPT unavailable',
              data: {},
            },
          },
          events: [],
          count: 0,
          governor: null,
          maritime: {},
          rail: {},
          domain_overrides: {},
          source_updated: {
            events: 6_000,
            maritime: 5_900,
            rail: 5_800,
          },
        }),
      }));

    const poller = createUnifiedPoller({
      onUpdate: () => {},
      onError: () => {},
      initialRefreshMs: 60_000,
      snapshotBaseUrl: 'https://snapshot.example.com',
    });

    const first = await poller.poll();
    const second = await poller.poll();

    expect(first.vessels).toHaveLength(1);
    expect(first.railStatuses).toHaveLength(1);
    expect(first.domainOverrides.lifelines?.[0]?.eventId).toBe('evt-1');
    expect(second.source).toBe('snapshot');
    expect(second.realtimeStatus.state).toBe('degraded');
    expect(second.vessels).toEqual(first.vessels);
    expect(second.railStatuses).toEqual(first.railStatuses);
    expect(second.domainOverrides).toEqual(first.domainOverrides);
  });

  it('marks fallback transport as degraded even when event fallback succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('snapshot unavailable')));

    const poller = createUnifiedPoller({
      onUpdate: () => {},
      onError: () => {},
      initialRefreshMs: 60_000,
      fallbackFetchEvents: async () => ({
        events: [],
        governor: null,
        source: 'server',
        updatedAt: 7_000,
      }),
    });

    const result = await poller.poll();

    expect(result.source).toBe('fallback');
    expect(result.realtimeStatus.state).toBe('degraded');
    expect(result.realtimeStatus.source).toBe('server');
    expect(result.realtimeStatus.message).toContain('fallback transport');
    expect(result.projectionFreshness).toEqual({
      events: 7_000,
      maritime: 0,
      rail: 0,
    });
  });

  it('preserves last-known-good dynamic sections while fallback transport is active at runtime', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          generated_at: 5_000,
          sections: {
            events: {
              state: 'live',
              source: 'events-db',
              updated_at: 5_000,
              last_success_at: 5_000,
              stale_after_ms: 90_000,
              last_error: null,
              data: [],
            },
            governor: {
              state: 'live',
              source: 'governor-db',
              updated_at: 5_000,
              last_success_at: 5_000,
              stale_after_ms: 90_000,
              last_error: null,
              data: null,
            },
            maritime: {
              state: 'live',
              source: 'maritime-hub',
              updated_at: 4_900,
              last_success_at: 4_900,
              stale_after_ms: 300_000,
              last_error: null,
              data: { vessels: [{ mmsi: '123456789', lat: 35.1, lng: 140.1, trail: [] }] },
            },
            rail: {
              state: 'live',
              source: 'odpt',
              updated_at: 4_800,
              last_success_at: 4_800,
              stale_after_ms: 300_000,
              last_error: null,
              data: { lines: [{ lineId: 'tokkaido-shinkansen' }] },
            },
          },
          events: [],
          count: 0,
          governor: null,
          maritime: { vessels: [{ mmsi: '123456789', lat: 35.1, lng: 140.1, trail: [] }] },
          rail: { lines: [{ lineId: 'tokkaido-shinkansen' }] },
          domain_overrides: {
            lifelines: [
              {
                id: 'rail',
                label: 'Rail',
                eventId: 'evt-1',
                metric: '1 rail corridor nominal',
                detail: 'Live rail telemetry shows nominal posture.',
                severity: 'clear',
                availability: 'live',
                trust: 'confirmed',
                counters: [],
                signals: [],
              },
            ],
          },
          source_updated: {
            events: 5_000,
            maritime: 4_900,
            rail: 4_800,
          },
        }),
      })
      .mockRejectedValueOnce(new Error('snapshot unavailable')));

    const poller = createUnifiedPoller({
      onUpdate: () => {},
      onError: () => {},
      initialRefreshMs: 60_000,
      snapshotBaseUrl: 'https://snapshot.example.com',
      fallbackFetchEvents: async () => ({
        events: [],
        governor: null,
        source: 'server',
        updatedAt: 7_000,
      }),
    });

    const first = await poller.poll();
    const second = await poller.poll();

    expect(second.source).toBe('fallback');
    expect(second.vessels).toEqual(first.vessels);
    expect(second.railStatuses).toEqual(first.railStatuses);
    expect(second.domainOverrides).toEqual(first.domainOverrides);
  });

  it('drops malformed domain overrides from snapshot responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 'projection-6000',
        generated_at: 6_000,
        sections: {
          events: {
            state: 'live',
            source: 'events-db',
            updated_at: 6_000,
            last_success_at: 6_000,
            stale_after_ms: 90_000,
            last_error: null,
            data: [],
          },
          governor: {
            state: 'live',
            source: 'governor-db',
            updated_at: 6_000,
            last_success_at: 6_000,
            stale_after_ms: 90_000,
            last_error: null,
            data: null,
          },
          maritime: {
            state: 'live',
            source: 'maritime-hub',
            updated_at: 6_000,
            last_success_at: 6_000,
            stale_after_ms: 300_000,
            last_error: null,
            data: { vessels: [] },
          },
          rail: {
            state: 'live',
            source: 'odpt',
            updated_at: 6_000,
            last_success_at: 6_000,
            stale_after_ms: 300_000,
            last_error: null,
            data: { lines: [] },
          },
        },
        events: [],
        count: 0,
        governor: null,
        maritime: { vessels: [] },
        rail: { lines: [] },
        domain_overrides: {
          lifelines: [
            {
              id: 'rail',
              label: 'Rail',
              metric: 'invalid payload',
              detail: 'signals and counters are not arrays',
              severity: 'critical',
              availability: 'live',
              trust: 'confirmed',
              counters: 'bad',
              signals: 'bad',
            },
          ],
        },
        source_updated: {
          events: 6_000,
          maritime: 6_000,
          rail: 6_000,
        },
      }),
    }));

    const poller = createUnifiedPoller({
      onUpdate: () => {},
      onError: () => {},
      initialRefreshMs: 60_000,
      snapshotBaseUrl: 'https://snapshot.example.com',
    });

    const result = await poller.poll();
    expect(result.domainOverrides).toEqual({
      lifelines: [
        {
          id: 'rail',
          label: 'Rail',
          metric: 'invalid payload',
          detail: 'signals and counters are not arrays',
          severity: 'critical',
          availability: 'live',
          trust: 'confirmed',
          counters: [],
          signals: [],
        },
      ],
    });
  });

  it('preserves last-known-good dynamic sections while fallback transport is active', () => {
    const preserved = resolveDynamicSectionData({
      previousVessels: [{
        mmsi: '111111111',
        name: 'TEST VESSEL',
        lat: 34.9,
        lng: 139.2,
        cog: 90,
        sog: 12,
        type: 'cargo',
        lastUpdate: 8_000,
        trail: [],
      }],
      previousRailStatuses: [{
        lineId: 'tohoku-shinkansen',
        status: 'delayed',
        updatedAt: 8_000,
      }],
      previousDomainOverrides: {
        lifelines: [
          {
            id: 'rail',
            label: 'Rail',
            metric: '1 rail corridor delayed',
            detail: 'Tokaido Shinkansen is reporting delays due to Signal inspection.',
            severity: 'watch',
            availability: 'live',
            trust: 'confirmed',
            counters: [],
            signals: [],
          },
        ],
      },
      result: {
        source: 'fallback',
        vessels: [],
        railStatuses: [],
        domainOverrides: {},
        realtimeStatus: {
          source: 'fallback',
          state: 'degraded',
          updatedAt: 8_000,
          staleAfterMs: 60_000,
        },
      },
    });

    expect(preserved.vessels).toEqual([{
      mmsi: '111111111',
      name: 'TEST VESSEL',
      lat: 34.9,
      lng: 139.2,
      cog: 90,
      sog: 12,
      type: 'cargo',
      lastUpdate: 8_000,
      trail: [],
    }]);
    expect(preserved.railStatuses).toEqual([{
      lineId: 'tohoku-shinkansen',
      status: 'delayed',
      updatedAt: 8_000,
    }]);
    expect(preserved.domainOverrides.lifelines?.[0]?.id).toBe('rail');
  });
});
