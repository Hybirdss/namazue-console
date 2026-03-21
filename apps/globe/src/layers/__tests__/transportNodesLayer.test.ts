import { describe, expect, it } from 'vitest';

import type { EarthquakeEvent } from '../../types';
import { TRANSPORT_NODES, createTransportNodeLayers } from '../transportNodesLayer';

function createEvent(
  overrides: Partial<EarthquakeEvent> = {},
): EarthquakeEvent {
  return {
    id: 'eq-transport',
    lat: 35.6812,
    lng: 139.7671,
    depth_km: 18,
    magnitude: 6.9,
    time: Date.parse('2026-03-10T01:00:00.000Z'),
    faultType: 'crustal',
    tsunami: false,
    place: { text: 'Tokyo Core' },
    ...overrides,
  };
}

describe('transportNodesLayer', () => {
  it('stays hidden below the rail-operations zoom band', () => {
    expect(createTransportNodeLayers(null, 4.9)).toEqual([]);
  });

  it('shows only high-importance nodes at regional zoom', () => {
    const layers = createTransportNodeLayers(null, 6.2);
    const nodeLayer = layers.find((layer) => layer.id === 'transport-nodes');
    const data = nodeLayer?.props.data as Array<{ importance: number }> | undefined;

    expect(data?.length).toBeGreaterThan(0);
    expect(data?.every((node) => node.importance >= 3)).toBe(true);
  });

  it('marks Tokyo core nodes inside the impact zone during an event', () => {
    const layers = createTransportNodeLayers(createEvent(), 8.4);
    const nodeLayer = layers.find((layer) => layer.id === 'transport-nodes');
    const data = nodeLayer?.props.data as Array<{ id: string; inZone: boolean }> | undefined;
    const tokyo = data?.find((node) => node.id === 'shinkansen-tokyo');

    expect(tokyo?.inZone).toBe(true);
  });

  it('uses the curated stash-derived node catalog', () => {
    expect(TRANSPORT_NODES.some((node) => node.id === 'tokyo-metro-otemachi')).toBe(true);
    expect(TRANSPORT_NODES.some((node) => node.id === 'osaka-metro-honmachi')).toBe(true);
  });
});
