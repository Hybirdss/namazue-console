/**
 * Airport Layer — Japan's hub airports in the lifelines bundle.
 *
 * Uses icon atlas airport icon (teal plane silhouette) with status
 * rings for posture indication:
 *   - open: no ring (clean teal icon)
 *   - inspection: amber ring
 *   - closed: red ring
 *
 * GMPE-driven posture:
 * - JMA < 4.5: open
 * - JMA 4.5-5.5: inspection
 * - JMA >= 5.5: closed
 */

import { IconLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';
import { computeGmpe, haversine } from '../engine/gmpe';
import { isInImpactZone } from './impactZone';
import { ICON_ATLAS_URL, ICON_MAPPING } from './iconAtlas';
import { pickVisibleLabels, type LabelBounds } from './labelPolicy';

type RGBA = [number, number, number, number];

export type AirportPosture = 'open' | 'inspection' | 'closed';

export interface Airport {
  id: string;
  name: string;
  nameEn: string;
  iata: string;
  lat: number;
  lng: number;
  annualPaxM: number;
  region: string;
}

interface AirportDatum extends Airport {
  inZone: boolean;
  posture: AirportPosture;
  intensityAtSite: number;
}

function computeAirportPosture(intensity: number): AirportPosture {
  if (intensity < 4.5) return 'open';
  if (intensity < 5.5) return 'inspection';
  return 'closed';
}

function assessSite(
  airport: Airport,
  event: EarthquakeEvent | null,
): { intensity: number; posture: AirportPosture } {
  if (!event) return { intensity: 0, posture: 'open' };

  const surfaceDist = haversine(event.lat, event.lng, airport.lat, airport.lng);
  const hypo = Math.sqrt(surfaceDist * surfaceDist + event.depth_km * event.depth_km);
  const result = computeGmpe({
    Mw: event.magnitude,
    depth_km: event.depth_km,
    distance_km: Math.max(hypo, 3),
    faultType: event.faultType,
  });

  const intensity = Math.max(0, result.jmaIntensity);
  return { intensity, posture: computeAirportPosture(intensity) };
}

export const AIRPORTS: Airport[] = [
  { id: 'apt-haneda', name: '東京国際空港', nameEn: 'Haneda (HND)', iata: 'HND', lat: 35.5533, lng: 139.7811, annualPaxM: 86, region: 'kanto' },
  { id: 'apt-narita', name: '成田国際空港', nameEn: 'Narita (NRT)', iata: 'NRT', lat: 35.7649, lng: 140.3864, annualPaxM: 40, region: 'kanto' },
  { id: 'apt-kansai', name: '関西国際空港', nameEn: 'Kansai (KIX)', iata: 'KIX', lat: 34.4273, lng: 135.2440, annualPaxM: 32, region: 'kansai' },
  { id: 'apt-itami', name: '大阪国際空港', nameEn: 'Itami (ITM)', iata: 'ITM', lat: 34.7855, lng: 135.4382, annualPaxM: 16, region: 'kansai' },
  { id: 'apt-chubu', name: '中部国際空港', nameEn: 'Chubu Centrair (NGO)', iata: 'NGO', lat: 34.8584, lng: 136.8053, annualPaxM: 13, region: 'chubu' },
  { id: 'apt-sendai', name: '仙台空港', nameEn: 'Sendai (SDJ)', iata: 'SDJ', lat: 38.1397, lng: 140.9168, annualPaxM: 3.8, region: 'tohoku' },
  { id: 'apt-fukuoka', name: '福岡空港', nameEn: 'Fukuoka (FUK)', iata: 'FUK', lat: 33.5859, lng: 130.4510, annualPaxM: 25, region: 'kyushu' },
  { id: 'apt-naha', name: '那覇空港', nameEn: 'Naha (OKA)', iata: 'OKA', lat: 26.1958, lng: 127.6458, annualPaxM: 22, region: 'okinawa' },
  { id: 'apt-kagoshima', name: '鹿児島空港', nameEn: 'Kagoshima (KOJ)', iata: 'KOJ', lat: 31.8034, lng: 130.7190, annualPaxM: 5.8, region: 'kyushu' },
  { id: 'apt-kumamoto', name: '熊本空港', nameEn: 'Kumamoto (KMJ)', iata: 'KMJ', lat: 32.8373, lng: 130.8550, annualPaxM: 3.5, region: 'kyushu' },
];

const POSTURE_LABELS: Record<AirportPosture, { text: string; color: string }> = {
  open: { text: 'Open — Normal operations', color: '#22d3ee' },
  inspection: { text: 'RUNWAY INSPECTION — Departures held', color: '#fbbf24' },
  closed: { text: 'CLOSED — Structural assessment required', color: '#ef4444' },
};

export function formatAirportTooltip(airport: Airport, event: EarthquakeEvent | null): string {
  const { intensity, posture } = assessSite(airport, event);
  const inZone = isInImpactZone(airport.lat, airport.lng, event);
  const paxLabel = airport.annualPaxM >= 1
    ? `${airport.annualPaxM.toFixed(1)}M pax/yr`
    : `${Math.round(airport.annualPaxM * 1000)}K pax/yr`;

  let assessmentHtml = '';
  if (event && intensity > 0.5) {
    const label = POSTURE_LABELS[posture];
    assessmentHtml = `
      <div style="color:${label.color};font-weight:600;margin-top:4px">${label.text}</div>
      <div style="opacity:0.6;font-size:10px">Est. intensity ${intensity.toFixed(1)} at site</div>
    `;
  } else if (inZone) {
    assessmentHtml = '<div style="color:#ef4444;font-weight:600;margin-top:4px">IN IMPACT ZONE</div>';
  }

  return `
    <div style="font-weight:600;font-size:12px;margin-bottom:3px">${airport.name}</div>
    <div style="opacity:0.7;font-size:11px">${airport.nameEn}</div>
    <div style="margin-top:4px;display:flex;gap:12px">
      <span>${airport.iata}</span>
      <span style="opacity:0.6">${paxLabel}</span>
    </div>
    ${assessmentHtml}
  `;
}

export function createAirportLayers(
  selectedEvent: EarthquakeEvent | null,
  zoom: number,
  sWaveRadiusKm: number | null = null,
  bounds?: LabelBounds | null,
): Layer[] {
  if (zoom < 5) return [];

  const filtered = zoom < 6
    ? AIRPORTS.filter((airport) => airport.annualPaxM >= 10)
    : AIRPORTS;

  const data: AirportDatum[] = filtered.map((airport) => {
    const assessment = assessSite(airport, selectedEvent);
    let inZone = isInImpactZone(airport.lat, airport.lng, selectedEvent);
    let posture = assessment.posture;

    if (sWaveRadiusKm !== null && selectedEvent) {
      const distKm = haversine(selectedEvent.lat, selectedEvent.lng, airport.lat, airport.lng);
      if (distKm > sWaveRadiusKm) {
        posture = 'open';
        inZone = false;
      }
    }

    return {
      ...airport,
      inZone,
      posture,
      intensityAtSite: assessment.intensity,
    };
  });

  const layers: Layer[] = [];

  // 1. Status rings — posture indicator behind icon
  const statusData = data.filter(d => d.posture !== 'open' || d.inZone);
  if (statusData.length > 0) {
    layers.push(new ScatterplotLayer<AirportDatum>({
      id: 'airport-status-rings',
      data: statusData,
      pickable: false,
      stroked: true,
      filled: true,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 18,
      getFillColor: (d): RGBA => {
        if (d.posture === 'closed') return [239, 68, 68, 40];
        if (d.posture === 'inspection') return [251, 191, 36, 30];
        if (d.inZone) return [239, 68, 68, 30];
        return [0, 0, 0, 0];
      },
      getLineColor: (d): RGBA => {
        if (d.posture === 'closed') return [239, 68, 68, 180];
        if (d.posture === 'inspection') return [251, 191, 36, 160];
        if (d.inZone) return [239, 68, 68, 140];
        return [0, 0, 0, 0];
      },
      getLineWidth: 1.5,
      updateTriggers: {
        getFillColor: [selectedEvent?.id, sWaveRadiusKm],
        getLineColor: [selectedEvent?.id, sWaveRadiusKm],
      },
    }));
  }

  // 2. Icon markers — teal plane from atlas (mask: false)
  layers.push(new IconLayer<AirportDatum>({
    id: 'airports',
    data,
    pickable: true,
    autoHighlight: true,
    highlightColor: [125, 211, 252, 200],
    iconAtlas: ICON_ATLAS_URL,
    iconMapping: ICON_MAPPING,
    getIcon: () => 'airport',
    getPosition: (d) => [d.lng, d.lat],
    getSize: (d) => {
      if (d.annualPaxM >= 25) return 24;
      if (d.annualPaxM >= 10) return 22;
      return 18;
    },
    sizeUnits: 'pixels',
    sizeMinPixels: 10,
    getColor: [255, 255, 255, 255] as RGBA,
    updateTriggers: {
      getSize: [selectedEvent?.id],
    },
  }));

  // 3. Labels at z7+
  if (zoom >= 7) {
    const labelData = pickVisibleLabels(data, {
      bounds,
      cap: zoom >= 9 ? 8 : 5,
      focus: selectedEvent ? { lat: selectedEvent.lat, lng: selectedEvent.lng } : null,
      getPriority: (datum) => {
        if (datum.posture === 'closed') return 200;
        if (datum.posture === 'inspection') return 140;
        if (datum.inZone) return 120;
        return datum.annualPaxM;
      },
    });

    layers.push(new TextLayer<AirportDatum>({
      id: 'airport-labels',
      data: labelData,
      pickable: false,
      getPosition: (d) => [d.lng, d.lat],
      getText: (d) => d.posture === 'closed'
        ? `${d.iata} CLOSED`
        : d.posture === 'inspection'
          ? `${d.iata} INSPECTION`
          : d.iata,
      getSize: 10,
      getColor: (d): RGBA => {
        if (d.posture === 'closed') return [239, 68, 68, 255];
        if (d.posture === 'inspection') return [251, 191, 36, 240];
        return [226, 232, 240, 160];
      },
      getTextAnchor: 'start',
      getAlignmentBaseline: 'center',
      getPixelOffset: [12, 0],
      fontFamily: 'Noto Sans JP, system-ui, sans-serif',
      fontWeight: 500,
      outlineWidth: 2,
      outlineColor: [10, 14, 20, 200],
      updateTriggers: {
        getText: [selectedEvent?.id, sWaveRadiusKm],
        getColor: [selectedEvent?.id, sWaveRadiusKm],
      },
    }));
  }

  return layers;
}
