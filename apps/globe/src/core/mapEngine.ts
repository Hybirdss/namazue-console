/**
 * Map Engine — MapLibre GL JS + Deck.gl initialization
 *
 * Base map: Protomaps PMTiles (self-hosted on R2, $0/mo)
 * Fallback: CARTO Dark Matter (free, no key)
 * Terrain: AWS Terrarium DEM tiles (free, production-grade)
 */

import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import type { Layer, PickingInfo } from '@deck.gl/core';
import { LightingEffect, AmbientLight, DirectionalLight } from '@deck.gl/core';
import { Protocol } from 'pmtiles';
import protoLayers from 'protomaps-themes-base';

// PMTiles URL: https URL to .pmtiles file on R2 (without pmtiles:// prefix)
const PMTILES_URL = import.meta.env.VITE_PMTILES_URL as string | undefined;

// Register PMTiles protocol once
const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

// Center on Japan's geographic center (not Tokyo) — balanced view of the archipelago
export const DEFAULT_CENTER: [number, number] = [137.0, 36.5];
export const DEFAULT_PITCH = 50;
export const DEFAULT_BEARING = 0;

// Responsive zoom: show full Japan at appropriate scale for viewport
export function getResponsiveZoom(): number {
  const w = window.innerWidth;
  if (w <= 480) return 3.2;
  if (w <= 768) return 3.8;
  if (w <= 1024) return 4.2;
  return 4.8;
}

// Terrain DEM: AWS/Mapzen Terrarium tiles (free, z0-z15, global coverage)
const DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const TERRAIN_EXAGGERATION = 1.5;

export type PickHandler = (info: PickingInfo) => void;
export type TooltipHandler = (info: PickingInfo) => string | { html: string; style?: Record<string, string> } | null;

export interface MapEngine {
  map: maplibregl.Map;
  overlay: MapboxOverlay;
  setLayers(layers: Layer[]): void;
  onClick(handler: PickHandler): void;
  setTooltip(handler: TooltipHandler): void;
  setPitch(pitch: number, animate?: boolean): void;
  resetView(): void;
  dispose(): void;
}

/**
 * Force all symbol layers to use clean single-language labels.
 *
 * Protomaps' generated text-field expressions fall back to the raw
 * multilingual `name` field (e.g. "日本海 / Японское море / 동해 / 조선동해")
 * when `name:ja` is missing. This replaces every text-field with a simple
 * coalesce: name:ja → name:en → empty string, eliminating all
 * multilingual label bleed and politically sensitive naming issues.
 */
function sanitizeLabels(layers: Record<string, unknown>[]): Record<string, unknown>[] {
  return layers.map((layer) => {
    if (layer.type !== 'symbol') return layer;
    const layout = (layer.layout ?? {}) as Record<string, unknown>;
    const tf = layout['text-field'];
    if (!tf) return layer;

    // Keep simple address labels (house numbers) as-is
    if (Array.isArray(tf) && tf[0] === 'get' && tf[1] === 'addr_housenumber') return layer;

    return {
      ...layer,
      layout: {
        ...layout,
        'text-field': ['coalesce', ['get', 'name:ja'], ['get', 'name:en'], ''],
      },
    };
  });
}

function buildStyle(): maplibregl.StyleSpecification | string {
  if (PMTILES_URL) {
    const url = PMTILES_URL.startsWith('pmtiles://')
      ? PMTILES_URL
      : `pmtiles://${PMTILES_URL}`;

    return {
      version: 8,
      glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
      sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/dark',
      sources: {
        protomaps: {
          type: 'vector',
          url,
          attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://protomaps.com">Protomaps</a>',
        },
      },
      layers: sanitizeLabels(protoLayers('protomaps', 'dark', 'ja')) as unknown as maplibregl.LayerSpecification[],
    } as unknown as maplibregl.StyleSpecification;
  }

  // Fallback: CARTO Dark Matter (free, no key required)
  return 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
}

export function createMapEngine(container: HTMLElement): MapEngine {
  const map = new maplibregl.Map({
    container,
    style: buildStyle(),
    center: DEFAULT_CENTER,
    zoom: getResponsiveZoom(),
    pitch: DEFAULT_PITCH,
    bearing: DEFAULT_BEARING,
    minZoom: 2,
    maxZoom: 18,
    maxPitch: 80,
    hash: true,
    attributionControl: false,
  });

  // Enable right-click drag for 3D pitch/bearing control
  // This allows users to explore the subsurface hypocenter volume
  map.dragRotate.enable();

  // 3D Terrain — mountains, ocean trenches, continental shelves visible
  map.on('load', () => {
    // DEM raster source (Terrarium encoding: elevation = (R*256 + G + B/256) - 32768)
    map.addSource('terrain-dem', {
      type: 'raster-dem',
      tiles: [DEM_URL],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 14,
    });

    // Enable 3D terrain with vertical exaggeration
    map.setTerrain({ source: 'terrain-dem', exaggeration: TERRAIN_EXAGGERATION });

    // Hillshade layer — subtle relief shading for dark theme
    map.addLayer({
      id: 'terrain-hillshade',
      type: 'hillshade',
      source: 'terrain-dem',
      paint: {
        'hillshade-exaggeration': 0.4,
        'hillshade-shadow-color': '#000000',
        'hillshade-highlight-color': 'rgba(180,210,255,0.15)',
        'hillshade-accent-color': '#050510',
        'hillshade-illumination-direction': 315,
      },
    }, map.getStyle().layers?.find((l) => l.type === 'symbol')?.id);

    // Sky layer removed — MapLibre GL JS v4 does not support 'sky' type.

  });

  // Broadcast bearing changes on every frame for real-time depth section sync
  map.on('move', () => {
    window.dispatchEvent(new CustomEvent('nz-bearing-update', {
      detail: {
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        center: map.getCenter(),
      },
    }));
  });

  let clickHandler: PickHandler | null = null;
  let tooltipHandler: TooltipHandler | null = null;

  // ── Lighting — gives depth to all extruded/3D layers ──────────
  // Calibrated for dark-theme console: soft ambient + directional from NW
  // so Japan's Pacific coast catches highlights. All ColumnLayer, Tile3DLayer,
  // and extruded PolygonLayer automatically receive this lighting.
  const ambientLight = new AmbientLight({
    color: [255, 255, 255],
    intensity: 1.2,
  });
  const directionalLight = new DirectionalLight({
    color: [255, 245, 230],  // warm daylight tint
    intensity: 2.4,
    direction: [-3, -9, -1], // NW upper → illuminates Japan's Pacific coast
  });
  const directionalFill = new DirectionalLight({
    color: [160, 200, 255],  // cool fill from opposite side
    intensity: 0.6,
    direction: [5, 6, -2],
  });
  const lightingEffect = new LightingEffect({
    ambientLight,
    directionalLight,
    directionalFill,
  });

  // Overlay mode (not interleaved). In interleaved mode, deck.gl inserts
  // layers into MapLibre's layer stack via map.addLayer/getLayer, but
  // MapLibre v5's getLayer() returns style specs without .setProps(),
  // causing "setProps is not a function" crashes in resolve-layers.js.
  // Overlay mode renders all deck.gl layers in a separate canvas on top
  // of the base map — no MapLibre layer interop required.
  const overlay = new MapboxOverlay({
    interleaved: false,
    pickingRadius: 8,
    effects: [lightingEffect],
    layers: [],
    onClick: (info) => {
      if (clickHandler) clickHandler(info as PickingInfo);
    },
    getTooltip: (info) => {
      if (tooltipHandler) return tooltipHandler(info as PickingInfo);
      return null;
    },
  } as ConstructorParameters<typeof MapboxOverlay>[0]);

  map.addControl(overlay);

  // Attribution in bottom-right, collapsed
  map.addControl(
    new maplibregl.AttributionControl({ compact: true }),
    'bottom-right',
  );

  function setLayers(layers: Layer[]): void {
    overlay.setProps({ layers });
  }

  function dispose(): void {
    resizeObserver.disconnect();
    maplibregl.removeProtocol('pmtiles');
    overlay.finalize();
    map.remove();
  }

  function onClick(handler: PickHandler): void {
    clickHandler = handler;
  }

  function setTooltip(handler: TooltipHandler): void {
    tooltipHandler = handler;
  }

  function setPitch(pitch: number, animate: boolean = true): void {
    if (animate) {
      map.easeTo({ pitch, duration: 800 });
    } else {
      map.setPitch(pitch);
    }
  }

  // Robust container resize — handles depth panel, window resize, safe-area changes
  const resizeObserver = new ResizeObserver(() => {
    map.resize();
  });
  resizeObserver.observe(container);

  function resetView(): void {
    map.flyTo({
      center: DEFAULT_CENTER,
      zoom: getResponsiveZoom(),
      pitch: DEFAULT_PITCH,
      bearing: DEFAULT_BEARING,
      duration: 1800,
    });
  }

  return { map, overlay, setLayers, onClick, setTooltip, setPitch, resetView, dispose };
}
