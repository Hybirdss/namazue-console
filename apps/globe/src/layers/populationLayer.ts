/**
 * Population Exposure Layer — Proportional circles for affected municipalities.
 *
 * Shows when an event is selected. Each circle:
 *   - Position: municipality centroid
 *   - Area proportional to exposed population
 *   - Color from JMA intensity class
 *   - Only shown for JMA 3+ (intensity >= 2.5)
 *
 * Data: 1,898 official municipality / ward units from data/municipalities.ts
 * Intensity: occupied-footprint proxy sampling against the current hazard field
 */

import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent, IntensityGrid } from '../types';
import { JMA_COLORS, type JmaClass } from '../types';
import { MUNICIPALITIES } from '../data/municipalities';
import { assessMunicipalityIntensity } from '../ops/municipalityIntensity';
import { formatPopulationShort } from '../utils/metricFormat';

type RGBA = [number, number, number, number];

interface AffectedCity {
  name: string;
  lat: number;
  lng: number;
  population: number;
  intensity: number;
  jmaClass: JmaClass;
}

function hexToRgba(hex: string, alpha: number): RGBA {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
}

let cachedEventId: string | null = null;
let cachedGrid: IntensityGrid | null = null;
let cachedCities: AffectedCity[] = [];

function getAffectedCities(
  event: EarthquakeEvent,
  grid: IntensityGrid | null,
): AffectedCity[] {
  if (cachedEventId === event.id && cachedGrid === grid) return cachedCities;
  if (!grid) return [];

  const cities: AffectedCity[] = [];
  for (const city of MUNICIPALITIES) {
    const assessment = assessMunicipalityIntensity(grid, city);
    const exposedPopulation = Math.round(city.population * assessment.thresholdShares['3+']);
    if (exposedPopulation < 1) continue;
    cities.push({
      name: city.name,
      lat: city.lat,
      lng: city.lng,
      population: exposedPopulation,
      intensity: assessment.representativeIntensity,
      jmaClass: assessment.representativeJmaClass,
    });
  }
  cachedEventId = event.id;
  cachedGrid = grid;
  cachedCities = cities;
  return cities;
}

// Population → radius in meters.
// sqrt for area-proportional sizing. Clamp range for visibility.
function popToRadius(pop: number): number {
  return Math.max(800, Math.min(Math.sqrt(pop) * 12, 40_000));
}

export function createPopulationLayers(
  event: EarthquakeEvent | null,
  intensityGrid: IntensityGrid | null,
  zoom: number,
): Layer[] {
  if (!event) return [];

  const cities = getAffectedCities(event, intensityGrid);
  if (cities.length === 0) return [];

  const layers: Layer[] = [
    new ScatterplotLayer<AffectedCity>({
      id: 'population-exposure',
      data: cities,
      getPosition: (d) => [d.lng, d.lat],
      getRadius: (d) => popToRadius(d.population),
      getFillColor: (d) => hexToRgba(JMA_COLORS[d.jmaClass] || '#94a3b8', 90),
      getLineColor: (d) => hexToRgba(JMA_COLORS[d.jmaClass] || '#94a3b8', 180),
      lineWidthMinPixels: 1,
      stroked: true,
      filled: true,
      radiusUnits: 'meters',
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 60],
      updateTriggers: {
        getRadius: [event.id],
        getFillColor: [event.id],
        getLineColor: [event.id],
      },
    }),
  ];

  // Text labels at higher zoom
  if (zoom >= 7) {
    layers.push(
      new TextLayer<AffectedCity>({
        id: 'population-labels',
        data: cities.filter((c) => c.intensity >= 3.5 || c.population >= 500_000),
        getPosition: (d) => [d.lng, d.lat],
      getText: (d) => {
          return `${d.name}\n${formatPopulationShort(d.population)}`;
        },
        getColor: [230, 230, 240, 200],
        getSize: 11,
        fontFamily: '"Noto Sans JP", "Inter", system-ui, sans-serif',
        fontWeight: 500,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'top',
        getPixelOffset: [0, 8],
        billboard: true,
        sizeUnits: 'pixels',
        updateTriggers: {
          getText: [event.id],
        },
      }),
    );
  }

  return layers;
}
