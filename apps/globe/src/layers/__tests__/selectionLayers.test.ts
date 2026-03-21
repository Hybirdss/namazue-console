import { describe, expect, it } from 'vitest';

import { buildAssetCategoryVisibility } from '../../ops/assetCategoryVisibility';
import type { EarthquakeEvent } from '../../types';
import { createAssetLayers } from '../assetLayer';
import { createImpactVisualizationLayers } from '../impactVisualization';

function createEvent(
  id: string,
  lat: number,
  lng: number,
  magnitude: number = 6.4,
): EarthquakeEvent {
  return {
    id,
    lat,
    lng,
    depth_km: 24,
    magnitude,
    time: Date.parse('2026-03-09T00:00:00.000Z'),
    faultType: 'interface',
    tsunami: false,
    place: { text: id },
  };
}

describe('selection layers', () => {
  it('invalidates impact overlay geometry when the selected event changes', () => {
    const event = createEvent('eq-1', 35.6, 139.8);
    const layers = createImpactVisualizationLayers(event, [], Date.parse('2026-03-09T00:00:10.000Z'));

    const glow = layers.find((layer) => layer.id === 'impact-glow');
    const fill = layers.find((layer) => layer.id === 'impact-zone-fill');
    const ring = layers.find((layer) => layer.id === 'impact-zone-ring');

    expect(glow?.props.updateTriggers?.getPosition).toEqual([event.id, event.lng, event.lat]);
    expect(glow?.props.updateTriggers?.getRadius).toEqual([event.id, event.magnitude]);
    expect(fill?.props.updateTriggers?.getPosition).toEqual([event.id, event.lng, event.lat]);
    expect(fill?.props.updateTriggers?.getRadius).toEqual([event.id, event.magnitude, event.depth_km, event.faultType]);
    expect(ring?.props.updateTriggers?.getPosition).toEqual([event.id, event.lng, event.lat]);
    expect(ring?.props.updateTriggers?.getRadius).toEqual([event.id, event.magnitude, event.depth_km, event.faultType]);
  });

  it('makes asset markers pickable for asset card interaction', () => {
    const layers = createAssetLayers('national', []);
    const assetMarkers = layers.find((layer) => layer.id === 'asset-markers');

    expect(assetMarkers?.props.pickable).toBe(true);
  });

  it('skips hidden asset categories when category visibility is disabled', () => {
    const layers = createAssetLayers(
      'national',
      [],
      null,
      undefined,
      buildAssetCategoryVisibility({ nuclear_plant: false }),
    );

    expect(layers).toEqual([]);
  });
});
