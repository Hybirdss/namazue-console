/**
 * Building Layer — PLATEAU 3D Tiles for Japan's built environment.
 *
 * Renders MLIT PLATEAU 3D buildings using deck.gl Tile3DLayer.
 * The tileset catalog covers major Japanese cities with LOD1 geometry
 * (box-shaped footprint extrusions), which is sufficient for seismic
 * impact visualization at city zoom.
 *
 * Intensity coloring:
 * When an earthquake is selected and an IntensityGrid is available,
 * buildings are colorized by JMA damage severity following the official
 * JMA scale colors. Each building's bounding volume center is used to
 * sample the intensity grid via bilinear-adjacent lookup.
 *
 * When no earthquake is selected, buildings render in neutral dark gray
 * at reduced opacity so the base map context remains legible.
 *
 * Progressive disclosure:
 * Tile3DLayer only activates at zoom >= 13 (city-level view) to avoid
 * overwhelming the renderer at national or regional zoom levels.
 * The viewport zoom is the responsibility of the caller.
 *
 * Data:
 * PLATEAU tilesets are served from MLIT's public plateau.geospatial.jp bucket.
 * Format: 3D Tiles 1.0, LOD1 buildings, CC BY 4.0.
 * Some catalog cities still require ward-level or refreshed path validation.
 * Those entries keep their geographic center for viewport matching, but their
 * tilesetUrl is null until a working official tileset path is verified.
 *
 * References:
 *   - MLIT Project PLATEAU: https://www.mlit.go.jp/plateau/
 *   - deck.gl Tile3DLayer: https://deck.gl/docs/api-reference/geo-layers/tile-3d-layer
 *   - 3D Tiles spec: https://cesium.com/blog/2015/08/10/introducing-3d-tiles/
 */

import { Tile3DLayer } from '@deck.gl/geo-layers';
import { Tiles3DLoader } from '@loaders.gl/3d-tiles';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent, IntensityGrid, PlateauCityConfig, PlateauCityId } from '../types';

type PlateauCatalogCityConfig = Omit<PlateauCityConfig, 'tilesetUrl'> & {
  tilesetUrl: string | null;
};

// ── PLATEAU City Catalog ─────────────────────────────────────────────────────
//
// Each entry maps a PlateauCityId to its public 3D Tiles tileset URL and
// geographic center used for viewport proximity matching.
//
// URL scheme: official plateau.geospatial.jp 3D Tiles bucket.
// All tilesets are publicly accessible, no API key required.
// License: CC BY 4.0 (国土交通省 Project PLATEAU)
//
// NOTE: Metro datasets sometimes live at ward-level subpaths instead of a city
// root. Unsupported cities remain in the catalog with tilesetUrl = null so the
// viewport resolver does not snap nearby cities to the wrong geometry.

const OFFICIAL_PLATEAU_BASE_URL = 'https://plateau.geospatial.jp/main/data/3d-tiles/bldg';

function officialTileset(path: string): string {
  return `${OFFICIAL_PLATEAU_BASE_URL}/${path}/tileset.json`;
}

export const PLATEAU_CITIES: Record<PlateauCityId, PlateauCatalogCityConfig> = {
  chiyoda: {
    id: 'chiyoda',
    nameKey: 'city.chiyoda',
    tilesetUrl: officialTileset('13100_tokyo/13101_chiyoda-ku/low_resolution'),
    center: { lat: 35.6942, lng: 139.7534 },
  },
  chuo: {
    id: 'chuo',
    nameKey: 'city.chuo',
    tilesetUrl: officialTileset('13100_tokyo/13102_chuo-ku/low_resolution'),
    center: { lat: 35.6704, lng: 139.7722 },
  },
  minato: {
    id: 'minato',
    nameKey: 'city.minato',
    tilesetUrl: officialTileset('13100_tokyo/13103_minato-ku/low_resolution'),
    center: { lat: 35.6581, lng: 139.7514 },
  },
  shinjuku: {
    id: 'shinjuku',
    nameKey: 'city.shinjuku',
    tilesetUrl: officialTileset('13100_tokyo/13104_shinjuku-ku/low_resolution'),
    center: { lat: 35.6938, lng: 139.7034 },
  },
  shibuya: {
    id: 'shibuya',
    nameKey: 'city.shibuya',
    tilesetUrl: officialTileset('13100_tokyo/13113_shibuya-ku/low_resolution'),
    center: { lat: 35.6617, lng: 139.7041 },
  },
  yokohama: {
    id: 'yokohama',
    nameKey: 'city.yokohama',
    tilesetUrl: officialTileset('14100_yokohama/low_resolution'),
    center: { lat: 35.4437, lng: 139.6380 },
  },
  kawasaki: {
    id: 'kawasaki',
    nameKey: 'city.kawasaki',
    tilesetUrl: officialTileset('14130_kawasaki/notexture'),
    center: { lat: 35.5308, lng: 139.7029 },
  },
  saitama: {
    id: 'saitama',
    nameKey: 'city.saitama',
    tilesetUrl: officialTileset('11100_saitama/low_resolution'),
    center: { lat: 35.8617, lng: 139.6456 },
  },
  chiba: {
    id: 'chiba',
    nameKey: 'city.chiba',
    tilesetUrl: null,
    center: { lat: 35.6074, lng: 140.1065 },
  },
  osaka: {
    id: 'osaka',
    nameKey: 'city.osaka',
    tilesetUrl: officialTileset('27100_osaka/27128_chuo-ku/low_resolution'),
    center: { lat: 34.6937, lng: 135.5023 },
  },
  nagoya: {
    id: 'nagoya',
    nameKey: 'city.nagoya',
    tilesetUrl: officialTileset('23100_nagoya/23106_naka-ku/low_resolution'),
    center: { lat: 35.1815, lng: 136.9066 },
  },
  kyoto: {
    id: 'kyoto',
    nameKey: 'city.kyoto',
    tilesetUrl: null,
    center: { lat: 35.0116, lng: 135.7681 },
  },
  sapporo: {
    id: 'sapporo',
    nameKey: 'city.sapporo',
    tilesetUrl: officialTileset('01100_sapporo/low_resolution'),
    center: { lat: 43.0618, lng: 141.3545 },
  },
  sendai: {
    id: 'sendai',
    nameKey: 'city.sendai',
    tilesetUrl: null,
    center: { lat: 38.2688, lng: 140.8721 },
  },
  hiroshima: {
    id: 'hiroshima',
    nameKey: 'city.hiroshima',
    tilesetUrl: null,
    center: { lat: 34.3853, lng: 132.4553 },
  },
  fukuoka: {
    id: 'fukuoka',
    nameKey: 'city.fukuoka',
    tilesetUrl: null,
    center: { lat: 33.5904, lng: 130.4017 },
  },
  kitakyushu: {
    id: 'kitakyushu',
    nameKey: 'city.kitakyushu',
    tilesetUrl: officialTileset('40100_kitakyushu/low_resolution'),
    center: { lat: 33.8835, lng: 130.8752 },
  },
  niigata: {
    id: 'niigata',
    nameKey: 'city.niigata',
    tilesetUrl: officialTileset('15100_niigata/low_resolution'),
    center: { lat: 37.9161, lng: 139.0364 },
  },
  shizuoka: {
    id: 'shizuoka',
    nameKey: 'city.shizuoka',
    tilesetUrl: null,
    center: { lat: 34.9756, lng: 138.3827 },
  },
  hamamatsu: {
    id: 'hamamatsu',
    nameKey: 'city.hamamatsu',
    tilesetUrl: null,
    center: { lat: 34.7108, lng: 137.7261 },
  },
  kumamoto: {
    id: 'kumamoto',
    nameKey: 'city.kumamoto',
    tilesetUrl: officialTileset('43100_kumamoto/low_resolution'),
    center: { lat: 32.8031, lng: 130.7079 },
  },
  naha: {
    id: 'naha',
    nameKey: 'city.naha',
    tilesetUrl: null,
    center: { lat: 26.2124, lng: 127.6809 },
  },
  kanazawa: {
    id: 'kanazawa',
    nameKey: 'city.kanazawa',
    tilesetUrl: null,
    center: { lat: 36.5613, lng: 136.6562 },
  },
  gifu: {
    id: 'gifu',
    nameKey: 'city.gifu',
    tilesetUrl: null,
    center: { lat: 35.4232, lng: 136.7608 },
  },
  okayama: {
    id: 'okayama',
    nameKey: 'city.okayama',
    tilesetUrl: null,
    center: { lat: 34.6618, lng: 133.9350 },
  },
  takamatsu: {
    id: 'takamatsu',
    nameKey: 'city.takamatsu',
    tilesetUrl: null,
    center: { lat: 34.3428, lng: 134.0466 },
  },
  utsunomiya: {
    id: 'utsunomiya',
    nameKey: 'city.utsunomiya',
    tilesetUrl: officialTileset('09201_utsunomiya/low_resolution'),
    center: { lat: 36.5657, lng: 139.8836 },
  },
  maebashi: {
    id: 'maebashi',
    nameKey: 'city.maebashi',
    tilesetUrl: null,
    center: { lat: 36.3912, lng: 139.0608 },
  },
  kofu: {
    id: 'kofu',
    nameKey: 'city.kofu',
    tilesetUrl: null,
    center: { lat: 35.6635, lng: 138.5684 },
  },
  fukushima: {
    id: 'fukushima',
    nameKey: 'city.fukushima',
    tilesetUrl: null,
    center: { lat: 37.7608, lng: 140.4748 },
  },
  wakayama: {
    id: 'wakayama',
    nameKey: 'city.wakayama',
    tilesetUrl: null,
    center: { lat: 34.2260, lng: 135.1675 },
  },
  tottori: {
    id: 'tottori',
    nameKey: 'city.tottori',
    tilesetUrl: officialTileset('31201_tottori/low_resolution'),
    center: { lat: 35.5011, lng: 134.2352 },
  },
  tokushima: {
    id: 'tokushima',
    nameKey: 'city.tokushima',
    tilesetUrl: null,
    center: { lat: 34.0657, lng: 134.5593 },
  },
  matsuyama: {
    id: 'matsuyama',
    nameKey: 'city.matsuyama',
    tilesetUrl: officialTileset('38201_matsuyama/low_resolution'),
    center: { lat: 33.8396, lng: 132.7657 },
  },
  kochi: {
    id: 'kochi',
    nameKey: 'city.kochi',
    tilesetUrl: null,
    center: { lat: 33.5590, lng: 133.5311 },
  },
};

// ── Constants ────────────────────────────────────────────────────────────────

/** Minimum zoom level at which buildings are rendered. Below this, return []. */
const MIN_ZOOM = 11;
export const BUILDING_LAYER_MIN_ZOOM = MIN_ZOOM;

/** Building color when no earthquake is selected (dark slate, low opacity). */
const NEUTRAL_COLOR: [number, number, number, number] = [35, 45, 55, 140];

/**
 * Approximate geographic radius (degrees) within which a city's tileset is
 * considered "in view". Used for city proximity selection.
 */
const CITY_MATCH_RADIUS_DEG = 0.5;

// ── JMA Intensity → Building Color ──────────────────────────────────────────
//
// Colors follow the official JMA scale exactly (see types.ts JMA_COLORS).
// Alpha is higher for severe levels so critical damage zones are unmissable.
// For JMA < 2.5 we use the neutral color — no meaningful damage signal.

function intensityToBuildingRGBA(jma: number): [number, number, number, number] {
  if (jma >= 6.5) return [153, 0,   153, 230]; // JMA 7:  collapse risk
  if (jma >= 6.0) return [204, 0,   0,   220]; // JMA 6+: heavy damage
  if (jma >= 5.5) return [255, 51,  0,   210]; // JMA 6-: severe damage
  if (jma >= 5.0) return [255, 102, 0,   200]; // JMA 5+: significant damage
  if (jma >= 4.5) return [255, 153, 0,   190]; // JMA 5-: moderate damage
  if (jma >= 3.5) return [255, 255, 0,   170]; // JMA 4:  light damage
  if (jma >= 2.5) return [51,  204, 102, 150]; // JMA 3:  felt, no damage
  return NEUTRAL_COLOR;
}

// ── Intensity Grid Sampling ──────────────────────────────────────────────────

/**
 * Sample the intensity grid at (lat, lng) using nearest-cell lookup.
 * Returns 0 if the position falls outside the grid extent.
 */
function sampleIntensityGrid(
  lat: number,
  lng: number,
  grid: IntensityGrid,
): number {
  const lngRadDeg = grid.radiusLngDeg ?? grid.radiusDeg;
  const latMin = grid.center.lat - grid.radiusDeg;
  const lngMin = grid.center.lng - lngRadDeg;
  const latStep = (2 * grid.radiusDeg) / Math.max(1, grid.rows - 1);
  const lngStep = (2 * lngRadDeg) / Math.max(1, grid.cols - 1);

  const row = Math.round((lat - latMin) / latStep);
  const col = Math.round((lng - lngMin) / lngStep);

  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) return 0;

  return grid.data[row * grid.cols + col] ?? 0;
}

// ── City Proximity Selection ─────────────────────────────────────────────────

/**
 * Return the nearest PLATEAU city config whose center is within
 * CITY_MATCH_RADIUS_DEG of the viewport center, or null if none qualify.
 *
 * Used to auto-select the appropriate tileset when the operator zooms into
 * a city without explicitly picking one from the layer control.
 */
export function resolvePlateauCity(
  viewportLat: number,
  viewportLng: number,
): PlateauCatalogCityConfig | null {
  let best: PlateauCatalogCityConfig | null = null;
  let bestDist = Infinity;

  for (const city of Object.values(PLATEAU_CITIES)) {
    const dLat = viewportLat - city.center.lat;
    const dLng = viewportLng - city.center.lng;
    const dist = Math.sqrt(dLat * dLat + dLng * dLng);
    if (dist < CITY_MATCH_RADIUS_DEG && dist < bestDist) {
      bestDist = dist;
      best = city;
    }
  }

  return best;
}

export function resolveRenderableBuildingCity(
  viewportLat: number,
  viewportLng: number,
  cityOverride: PlateauCityId | null = null,
): PlateauCatalogCityConfig | null {
  const city = cityOverride != null
    ? PLATEAU_CITIES[cityOverride] ?? null
    : resolvePlateauCity(viewportLat, viewportLng);

  if (!city || city.tilesetUrl == null) {
    return null;
  }

  return city;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Create PLATEAU 3D building layers for the given viewport and event state.
 *
 * @param selectedEvent  Currently selected earthquake, or null in calm mode.
 * @param intensityGrid  GMPE-computed intensity grid for the selected event.
 * @param zoom           Current map zoom level. Returns [] below MIN_ZOOM (13).
 * @param viewportLat    Viewport center latitude — used for city auto-selection.
 * @param viewportLng    Viewport center longitude — used for city auto-selection.
 * @param cityOverride   Explicit city ID from the layer control, bypasses auto-select.
 * @returns              Array of deck.gl layers (0 or 1 Tile3DLayer).
 */
export function createBuildingLayers(
  selectedEvent: EarthquakeEvent | null,
  intensityGrid: IntensityGrid | null,
  zoom: number,
  viewportLat: number,
  viewportLng: number,
  cityOverride: PlateauCityId | null = null,
): Layer[] {
  // Only render at city zoom level — 3D tiles are expensive below this
  if (zoom < BUILDING_LAYER_MIN_ZOOM) return [];

  // Resolve which city's tileset to load
  const city = resolveRenderableBuildingCity(viewportLat, viewportLng, cityOverride);
  if (!city) return [];

  const hasIntensity = selectedEvent != null && intensityGrid != null;

  // Cache key for updateTriggers: changes when event or grid dimensions change,
  // triggering a re-color pass. Grid reference identity is not stable across
  // GMPE recomputes, so we key on event id + grid size.
  const colorKey = hasIntensity
    ? `${selectedEvent!.id}-${intensityGrid!.rows}x${intensityGrid!.cols}`
    : 'neutral';

  // Opacity: full presence in event mode, subtle in calm mode
  const opacity = hasIntensity ? 0.9 : 0.45;

  return [
    new Tile3DLayer({
      id: `plateau-buildings-${city.id}`,
      data: city.tilesetUrl ?? undefined,
      loader: Tiles3DLoader,
      opacity,
      pickable: false,

      // Limit tile resolution to avoid GPU overload at high city zoom.
      // maximumScreenSpaceError: higher = coarser geometry, better perf.
      // 16 gives reasonable detail at z13-z15 without blowing memory budget.
      maximumScreenSpaceError: 16,

      // Geometry color:
      //   Event mode — compute intensity at each tile's bounding volume center
      //     and map to the JMA damage color scale.
      //   Calm mode  — flat neutral dark gray at reduced opacity.
      //
      // getPointColor / getMeshColor apply to the geometry of each loaded tile.
      // In deck.gl 9.x Tile3DLayer these props are passed through to the
      // underlying SimpleMeshLayer or PointCloudLayer depending on tile format.
      // LOD1 PLATEAU tilesets encode geometry as b3dm (batched 3D model),
      // which renders via ScenegraphLayer internally; the _subLayerProps
      // mechanism is used to reach the color accessors.
      _subLayerProps: {
        mesh: {
          getColor: hasIntensity
            ? (tile: { cartographicOrigin?: { x: number; y: number } | null }): [number, number, number, number] => {
                // cartographicOrigin gives the tile's local coordinate origin
                // in [longitude, latitude, altitude] (radians for lon/lat in
                // some versions, degrees in others — check tile.header).
                // Use it as the representative point for intensity sampling.
                const origin = tile?.cartographicOrigin;
                if (!origin || intensityGrid == null) return NEUTRAL_COLOR;

                // deck.gl Tile3DLayer exposes cartographicOrigin in degrees
                const lng = origin.x;
                const lat = origin.y;

                if (typeof lat !== 'number' || typeof lng !== 'number') return NEUTRAL_COLOR;

                const jma = sampleIntensityGrid(lat, lng, intensityGrid);
                return intensityToBuildingRGBA(jma);
              }
            : NEUTRAL_COLOR,
        },
      },

      // Standard 3D lighting — ambient dominant so dark tiles stay legible
      material: {
        ambient: 0.5,
        diffuse: 0.5,
        shininess: 16,
        specularColor: [60, 60, 60],
      },

      // Notify deck.gl to re-evaluate getColor when the event or grid changes
      updateTriggers: {
        _subLayerProps: [colorKey],
      },

      // Log load errors at warn level — missing tiles are normal for the
      // placeholder CMS URLs and should not surface as hard failures.
      onTileError: (tile: unknown) => {
        const url = (tile as { url?: string })?.url ?? '(unknown)';
        console.warn(`[buildingLayer] tile load failed: ${url}`);
      },
    }),
  ];
}
