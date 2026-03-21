import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';

import type { EarthquakeEvent } from '../types';
import { haversineKm, isInImpactZone } from './impactZone';
import { pickVisibleLabels, type LabelBounds } from './labelPolicy';

type RGBA = [number, number, number, number];

export interface TransportNode {
  id: string;
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  network: 'shinkansen' | 'tokyo-metro' | 'osaka-metro';
  lineColor: string;
  importance: 1 | 2 | 3 | 4;
}

interface TransportNodeDatum extends TransportNode {
  inZone: boolean;
}

function hexToRgba(hex: string, alpha: number): RGBA {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;
  const int = Number.parseInt(value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return [r, g, b, alpha];
}

export const TRANSPORT_NODES: TransportNode[] = [
  { id: 'shinkansen-tokyo', name: '東京', nameEn: 'Tokyo', lat: 35.681141, lng: 139.767455, network: 'shinkansen', lineColor: '#7dd3fc', importance: 4 },
  { id: 'shinkansen-ueno', name: '上野', nameEn: 'Ueno', lat: 35.713413, lng: 139.776542, network: 'shinkansen', lineColor: '#7dd3fc', importance: 4 },
  { id: 'shinkansen-omiya', name: '大宮', nameEn: 'Omiya', lat: 35.906387, lng: 139.62433, network: 'shinkansen', lineColor: '#7dd3fc', importance: 4 },
  { id: 'shinkansen-sendai', name: '仙台', nameEn: 'Sendai', lat: 38.260352, lng: 140.882392, network: 'shinkansen', lineColor: '#6ee7b7', importance: 4 },
  { id: 'shinkansen-nagoya', name: '名古屋', nameEn: 'Nagoya', lat: 35.1709, lng: 136.8815, network: 'shinkansen', lineColor: '#60a5fa', importance: 4 },
  { id: 'shinkansen-kyoto', name: '京都', nameEn: 'Kyoto', lat: 34.984608, lng: 135.75843, network: 'shinkansen', lineColor: '#60a5fa', importance: 4 },
  { id: 'shinkansen-shin-osaka', name: '新大阪', nameEn: 'Shin-Osaka', lat: 34.733539, lng: 135.500189, network: 'shinkansen', lineColor: '#60a5fa', importance: 4 },
  { id: 'shinkansen-hakata', name: '博多', nameEn: 'Hakata', lat: 33.5897, lng: 130.4207, network: 'shinkansen', lineColor: '#ef4444', importance: 4 },
  { id: 'shinkansen-kagoshima-chuo', name: '鹿児島中央', nameEn: 'Kagoshima-Chuo', lat: 31.5842, lng: 130.5414, network: 'shinkansen', lineColor: '#ef4444', importance: 3 },

  { id: 'tokyo-metro-otemachi', name: '大手町', nameEn: 'Otemachi', lat: 35.684609, lng: 139.766461, network: 'tokyo-metro', lineColor: '#00A7DB', importance: 3 },
  { id: 'tokyo-metro-ginza', name: '銀座', nameEn: 'Ginza', lat: 35.672841, lng: 139.763103, network: 'tokyo-metro', lineColor: '#E60012', importance: 3 },
  { id: 'tokyo-metro-ikebukuro', name: '池袋', nameEn: 'Ikebukuro', lat: 35.730228, lng: 139.711485, network: 'tokyo-metro', lineColor: '#E60012', importance: 3 },
  { id: 'tokyo-metro-shibuya', name: '渋谷', nameEn: 'Shibuya', lat: 35.658999, lng: 139.702445, network: 'tokyo-metro', lineColor: '#F39700', importance: 3 },

  { id: 'osaka-metro-honmachi', name: '本町', nameEn: 'Hommachi', lat: 34.683542, lng: 135.50067, network: 'osaka-metro', lineColor: '#E5171F', importance: 3 },
  { id: 'osaka-metro-umeda', name: '梅田', nameEn: 'Umeda', lat: 34.703413, lng: 135.497588, network: 'osaka-metro', lineColor: '#E5171F', importance: 3 },
  { id: 'osaka-metro-namba', name: 'なんば', nameEn: 'Namba', lat: 34.666332, lng: 135.497597, network: 'osaka-metro', lineColor: '#0078BA', importance: 3 },
  { id: 'osaka-metro-tennoji', name: '天王寺', nameEn: 'Tennoji', lat: 34.646078, lng: 135.515268, network: 'osaka-metro', lineColor: '#E5171F', importance: 3 },
];

function computeVisibleImportance(zoom: number): number {
  if (zoom < 7) return 3;
  if (zoom < 9) return 2;
  return 1;
}

function computeInZone(
  node: TransportNode,
  selectedEvent: EarthquakeEvent | null,
  sWaveRadiusKm: number | null,
): boolean {
  if (!selectedEvent) return false;
  if (!isInImpactZone(node.lat, node.lng, selectedEvent)) return false;
  if (sWaveRadiusKm === null) return true;
  return haversineKm(node.lat, node.lng, selectedEvent.lat, selectedEvent.lng) <= sWaveRadiusKm;
}

function nodeRadius(node: TransportNodeDatum): number {
  if (node.network === 'shinkansen') return node.importance >= 4 ? 7 : 5.5;
  return node.importance >= 3 ? 5.5 : 4;
}

function nodeFillColor(node: TransportNodeDatum): RGBA {
  if (node.inZone) {
    return node.network === 'shinkansen'
      ? [239, 68, 68, 230]
      : [251, 191, 36, 220];
  }
  return hexToRgba(node.lineColor, node.network === 'shinkansen' ? 180 : 150);
}

export function createTransportNodeLayers(
  selectedEvent: EarthquakeEvent | null,
  zoom: number,
  sWaveRadiusKm: number | null = null,
  bounds?: LabelBounds | null,
): Layer[] {
  if (zoom < 5) return [];

  const minImportance = computeVisibleImportance(zoom);
  const data: TransportNodeDatum[] = TRANSPORT_NODES
    .filter((node) => node.importance >= minImportance)
    .map((node) => ({
      ...node,
      inZone: computeInZone(node, selectedEvent, sWaveRadiusKm),
    }));

  const layers: Layer[] = [];
  layers.push(new ScatterplotLayer<TransportNodeDatum>({
    id: 'transport-nodes',
    data,
    pickable: false,
    stroked: true,
    filled: true,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    getPosition: (datum) => [datum.lng, datum.lat],
    getRadius: (datum) => nodeRadius(datum),
    getFillColor: (datum) => nodeFillColor(datum),
    getLineColor: (datum) => datum.inZone ? [255, 244, 214, 220] : [255, 255, 255, 120],
    getLineWidth: (datum) => datum.inZone ? 1.5 : 1,
    updateTriggers: {
      getRadius: [zoom],
      getFillColor: [selectedEvent?.id, sWaveRadiusKm],
      getLineColor: [selectedEvent?.id, sWaveRadiusKm],
    },
  }));

  if (zoom >= 7) {
    const labelData = pickVisibleLabels(
      data.filter((datum) => datum.importance >= 3 || datum.inZone),
      {
        bounds,
        cap: zoom >= 9 ? 10 : 6,
        focus: selectedEvent ? { lat: selectedEvent.lat, lng: selectedEvent.lng } : null,
        getPriority: (datum) => (datum.inZone ? 150 : 0) + (datum.importance * 25),
      },
    );

    layers.push(new TextLayer<TransportNodeDatum>({
      id: 'transport-node-labels',
      data: labelData,
      pickable: false,
      getPosition: (datum) => [datum.lng, datum.lat],
      getText: (datum) => datum.nameEn,
      getSize: 10,
      getColor: (datum): RGBA => datum.inZone ? [251, 191, 36, 240] : [226, 232, 240, 170],
      getTextAnchor: 'start',
      getAlignmentBaseline: 'center',
      getPixelOffset: [12, 0],
      fontFamily: 'Noto Sans JP, system-ui, sans-serif',
      fontWeight: 500,
      outlineWidth: 2,
      outlineColor: [10, 14, 20, 180],
      updateTriggers: {
        getColor: [selectedEvent?.id, sWaveRadiusKm],
      },
    }));
  }

  return layers;
}
