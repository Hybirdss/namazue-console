import { describe, expect, it } from 'vitest';

import { PLATEAU_CITIES, createBuildingLayers } from '../buildingLayer';

const OFFICIAL_PLATEAU_PREFIX = 'https://plateau.geospatial.jp/main/data/3d-tiles/bldg/';

describe('buildingLayer', () => {
  it('uses verified official PLATEAU tileset URLs only', () => {
    for (const city of Object.values(PLATEAU_CITIES)) {
      expect(city.tilesetUrl === null || city.tilesetUrl.startsWith(OFFICIAL_PLATEAU_PREFIX)).toBe(true);
      expect(city.tilesetUrl?.includes('assets.cms.plateau.reearth.io')).not.toBe(true);
    }
  });

  it('activates at z11 for supported city views', () => {
    const layersBelow = createBuildingLayers(
      null,
      null,
      10.9,
      PLATEAU_CITIES.chiyoda.center.lat,
      PLATEAU_CITIES.chiyoda.center.lng,
    );
    expect(layersBelow).toEqual([]);

    const layersAtCityZoom = createBuildingLayers(
      null,
      null,
      11,
      PLATEAU_CITIES.chiyoda.center.lat,
      PLATEAU_CITIES.chiyoda.center.lng,
    );
    expect(layersAtCityZoom).toHaveLength(1);
    expect((layersAtCityZoom[0] as { props: { data: string | null } }).props.data).toBe(
      PLATEAU_CITIES.chiyoda.tilesetUrl,
    );
  });

  it('keeps unsupported cities inert instead of pointing at dead placeholders', () => {
    expect(PLATEAU_CITIES.chiba.tilesetUrl).toBeNull();
    expect(
      createBuildingLayers(
        null,
        null,
        11,
        PLATEAU_CITIES.chiba.center.lat,
        PLATEAU_CITIES.chiba.center.lng,
      ),
    ).toEqual([]);
  });
});
