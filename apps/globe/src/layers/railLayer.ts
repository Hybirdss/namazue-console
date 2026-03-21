/**
 * Rail Layer — Japan's Shinkansen and major rail corridors.
 *
 * Professional transit cartography:
 *   - Thin, clean lines (2px max) — like official JR route maps
 *   - Monochrome base palette (cool slate/blue) — color only for status
 *   - Glow underlay for active disruptions only
 *   - Status overrides: suspended=red dashed, delayed=amber, partial=amber dim
 */

import { PathLayer, TextLayer } from '@deck.gl/layers';
import { PathStyleExtension } from '@deck.gl/extensions';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent, RailLineStatus, RailOperationStatus } from '../types';
import { haversineKm, impactRadiusKm } from './impactZone';
import { escapeHtml } from '../utils/escapeHtml';
import { smoothPath } from './smoothPath';
import { t, tf } from '../i18n';

type RGBA = [number, number, number, number];
type Coord = [number, number]; // [lng, lat]

export interface RailRoute {
  id: string;
  name: string;
  nameEn: string;
  type: 'shinkansen' | 'conventional';
  path: Coord[];
  color: RGBA;
}

interface RailDatum extends RailRoute {
  affected: boolean;
  liveStatus: RailOperationStatus | null;
  liveCause?: string;
}

// ── Status Alert Colors (only used when disrupted) ──────────
const AFFECTED_COLOR:  RGBA = [220, 80, 70, 180];
const SUSPENDED_COLOR: RGBA = [220, 70, 60, 210];
const DELAYED_COLOR:   RGBA = [230, 175, 50, 190];
const PARTIAL_COLOR:   RGBA = [220, 170, 50, 140];

// Glow for disrupted lines
const SUSPENDED_GLOW: RGBA = [220, 70, 60, 40];
const DELAYED_GLOW:   RGBA = [230, 175, 50, 30];

// ── Shinkansen Routes ────────────────────────────────────────
// Professional palette: subtle differentiation within cool tones
// Color only distinguishes routes — not screaming for attention

// ── Shinkansen Routes ────────────────────────────────────────
// Detailed station-by-station + intermediate waypoints for realistic curves.
// Coordinates follow actual rail corridors via known station positions.

export const RAIL_ROUTES: RailRoute[] = [
  {
    id: 'tokaido',
    name: '東海道新幹線',
    nameEn: 'Tokaido Shinkansen',
    type: 'shinkansen',
    color: [100, 150, 200, 140],
    path: [
      // Tokyo → Shin-Yokohama → Odawara → Atami → Mishima → Shin-Fuji → Shizuoka → Kakegawa → Hamamatsu → Toyohashi → Mikawa-Anjo → Nagoya → Gifu-Hashima → Maibara → Kyoto → Shin-Osaka
      [139.7671, 35.6812], // Tokyo
      [139.7400, 35.6700], [139.7100, 35.6550], [139.6800, 35.6400],
      [139.6178, 35.5075], // Shin-Yokohama
      [139.5600, 35.4700], [139.4800, 35.4200], [139.3800, 35.3600],
      [139.2800, 35.3100], [139.1553, 35.2564], // Odawara
      [139.0800, 35.1800], [139.0769, 35.1039], // Atami
      [139.0300, 35.0800], [138.9110, 35.1265], // Mishima
      [138.7300, 35.1600], [138.6200, 35.1500], // Shin-Fuji
      [138.3891, 34.9719], // Shizuoka
      [138.2500, 34.9200], [138.1300, 34.8700],
      [137.9800, 34.8200], [137.7900, 34.7200], // Hamamatsu
      [137.6500, 34.7000], [137.3900, 34.7600], // Toyohashi
      [137.1500, 34.9200], [137.0500, 34.9600],
      [136.8815, 35.1709], // Nagoya
      [136.7200, 35.2600], [136.6800, 35.3200], // Gifu-Hashima
      [136.4500, 35.3100], [136.2800, 35.3500], [136.0800, 35.3400],
      [135.9700, 35.2700], // Maibara
      [135.8300, 35.1700], [135.7586, 34.9855], // Kyoto
      [135.6200, 34.8600], [135.5001, 34.7335], // Shin-Osaka
    ],
  },
  {
    id: 'sanyo',
    name: '山陽新幹線',
    nameEn: 'Sanyo Shinkansen',
    type: 'shinkansen',
    color: [100, 150, 200, 130],
    path: [
      // Shin-Osaka → Shin-Kobe → Nishi-Akashi → Himeji → Aioi → Okayama → Shin-Kurashiki → Fukuyama → Shin-Onomichi → Mihara → Higashi-Hiroshima → Hiroshima → Shin-Iwakuni → Tokuyama → Shin-Yamaguchi → Kokura → Hakata
      [135.5001, 34.7335], // Shin-Osaka
      [135.3500, 34.7100], [135.1955, 34.6915], // Shin-Kobe
      [135.0100, 34.6500], [134.8500, 34.6700],
      [134.6914, 34.8267], // Himeji
      [134.5000, 34.8300], [134.3500, 34.8000],
      [133.9184, 34.6653], // Okayama
      [133.7700, 34.6300], [133.5500, 34.5200],
      [133.3625, 34.4867], // Fukuyama
      [133.1800, 34.4500], [132.9500, 34.4200],
      [132.7500, 34.4000], [132.4757, 34.3977], // Hiroshima
      [132.2200, 34.2800], [132.0500, 34.1800],
      [131.8100, 34.0800], [131.6200, 34.0500],
      [131.4636, 34.0887], // Shin-Yamaguchi
      [131.2500, 34.0200], [131.0500, 33.9500],
      [130.8820, 33.8856], // Kokura
      [130.7200, 33.7800], [130.5500, 33.6800],
      [130.4206, 33.5898], // Hakata
    ],
  },
  {
    id: 'tohoku',
    name: '東北新幹線',
    nameEn: 'Tohoku Shinkansen',
    type: 'shinkansen',
    color: [110, 170, 160, 140],
    path: [
      // Tokyo → Ueno → Omiya → Oyama → Utsunomiya → Nasushiobara → Shin-Shirakawa → Koriyama → Fukushima → Shiroishi-Zao → Sendai → Furukawa → Kurikoma-Kogen → Ichinoseki → Mizusawa-Esashi → Kitakami → Shin-Hanamaki → Morioka → Iwate-Numakunai → Ninohe → Hachinohe → Shichinohe-Towada → Shin-Aomori
      [139.7671, 35.6812], // Tokyo
      [139.7770, 35.7141], // Ueno
      [139.6501, 35.8616], // Omiya
      [139.6100, 35.9200], [139.5800, 35.9800], [139.5500, 36.0500],
      [139.5200, 36.1200], [139.8000, 36.3100],
      [139.8969, 36.3131], // Oyama
      [140.0500, 36.4000], [140.1069, 36.5597], // Utsunomiya
      [140.0700, 36.7500], [140.0200, 36.9600], // Nasushiobara
      [140.2200, 37.1300], // Shin-Shirakawa
      [140.3616, 37.3981], // Koriyama
      [140.4553, 37.7544], // Fukushima
      [140.5500, 37.8987], // Shiroishi-Zao
      [140.7500, 38.1000], [140.8824, 38.2606], // Sendai
      [140.9500, 38.4500], [140.9800, 38.5700], // Furukawa
      [140.9900, 38.7500], [141.0700, 38.9300],
      [141.1072, 39.0139], // Ichinoseki
      [141.1200, 39.1500], [141.1300, 39.2900], // Kitakami
      [141.1200, 39.4000], [141.1376, 39.4827], // Shin-Hanamaki
      [141.1350, 39.7015], // Morioka
      [141.2000, 39.8500], [141.3000, 40.0000],
      [141.3500, 40.1500], [141.3200, 40.2700], // Ninohe
      [141.4900, 40.5124], // Hachinohe
      [141.1000, 40.6500], [140.8500, 40.7500],
      [140.7247, 40.8240], // Shin-Aomori
    ],
  },
  {
    id: 'hokkaido',
    name: '北海道新幹線',
    nameEn: 'Hokkaido Shinkansen',
    type: 'shinkansen',
    color: [120, 140, 160, 120],
    path: [
      // Shin-Aomori → Okutsugaru-Imabetsu → (Seikan Tunnel) → Kikonai → Shin-Hakodate-Hokuto
      [140.7247, 40.8240], // Shin-Aomori
      [140.5500, 40.9300], [140.4200, 41.0400], // Okutsugaru-Imabetsu
      [140.3247, 41.2140], // Seikan Tunnel north portal approach
      [140.2500, 41.3500], [140.3000, 41.4500],
      [140.4000, 41.5500], [140.5000, 41.6500],
      [140.6531, 41.7762], // Kikonai
      [140.6800, 41.8200], [140.7000, 41.8600],
      [140.7267, 41.9046], // Shin-Hakodate-Hokuto
    ],
  },
  {
    id: 'joetsu',
    name: '上越新幹線',
    nameEn: 'Joetsu Shinkansen',
    type: 'shinkansen',
    color: [150, 150, 120, 130],
    path: [
      // Omiya → Kumagaya → Honjo-Waseda → Takasaki → Jomo-Kogen → Echigo-Yuzawa → Urasa → Nagaoka → Tsubame-Sanjo → Niigata
      [139.6501, 35.8616], // Omiya
      [139.4000, 36.0500], [139.3500, 36.1500],
      [139.3881, 36.1470], // Kumagaya
      [139.1800, 36.2800], // Honjo-Waseda
      [139.0235, 36.3914], // Takasaki
      [138.9600, 36.5500], [138.8200, 36.7500],
      [138.8169, 36.9372], // Echigo-Yuzawa
      [138.9285, 36.9326], // (tunnel section waypoint)
      [138.9600, 37.0700], [139.0000, 37.2000],
      [139.0100, 37.3500], [139.0100, 37.4500], // Urasa
      [139.0400, 37.5500], [139.0582, 37.6471], // Nagaoka
      [139.0400, 37.7500], [139.0300, 37.8200],
      [139.0388, 37.9137], // Niigata
    ],
  },
  {
    id: 'hokuriku',
    name: '北陸新幹線',
    nameEn: 'Hokuriku Shinkansen',
    type: 'shinkansen',
    color: [130, 130, 170, 130],
    path: [
      // Takasaki → Annaka-Haruna → Karuizawa → Sakudaira → Ueda → Nagano → Iiyama → Joetsu-Myoko → Itoigawa → Kurobe-Unazukionsen → Toyama → Shin-Takaoka → Kanazawa → Komatsu → Kagaonsen → Awara-Onsen → Fukui → Echizen-Takefu → Tsuruga
      [139.0235, 36.3914], // Takasaki
      [138.9200, 36.3600], [138.8300, 36.3400],
      [138.6316, 36.3474], // Karuizawa
      [138.4800, 36.3200], [138.2529, 36.2310], // Sakudaira
      [138.1811, 36.4030], // Ueda
      [138.1900, 36.5943], // Nagano
      [138.3500, 36.7500], [138.5000, 36.8500],
      [138.6200, 36.9800], // Iiyama
      [138.4500, 37.0300], [138.2500, 37.0500], // Joetsu-Myoko
      [137.8500, 36.9900], // Itoigawa
      [137.6000, 36.8500], [137.4400, 36.7800],
      [137.2115, 36.6953], // Toyama
      [137.0200, 36.6500], [136.8800, 36.6200], // Shin-Takaoka
      [136.6637, 36.5782], // Kanazawa
      [136.4500, 36.4100], [136.3500, 36.3000], // Komatsu
      [136.2500, 36.2000], [136.1865, 36.0700], // Awara-Onsen
      [136.2200, 35.9452], // Fukui
      [136.1700, 35.8500], [136.0800, 35.7500],
      [136.0222, 35.6484], // Tsuruga
    ],
  },
  {
    id: 'kyushu',
    name: '九州新幹線',
    nameEn: 'Kyushu Shinkansen',
    type: 'shinkansen',
    color: [160, 120, 120, 130],
    path: [
      // Hakata → Shin-Tosu → Kurume → Chikugo-Funagoya → Shin-Omuta → Shin-Tamana → Kumamoto → Shin-Yatsushiro → Shin-Minamata → Izumi → Sendai → Kagoshima-Chuo
      [130.4206, 33.5898], // Hakata
      [130.4800, 33.5200], [130.5100, 33.4500],
      [130.5479, 33.3593], // Shin-Tosu
      [130.5300, 33.2800], [130.5500, 33.2000], // Kurume
      [130.5800, 33.1000], [130.6500, 33.0000], // Shin-Omuta
      [130.7183, 32.8800], [130.7300, 32.8063], // Kumamoto
      [130.6800, 32.6500], [130.6500, 32.5000], // Shin-Yatsushiro
      [130.6200, 32.3500], [130.6000, 32.2200],
      [130.6880, 32.1031], // Shin-Minamata
      [130.5800, 32.0200], [130.5600, 31.9000],
      [130.5475, 31.7266], // Sendai
      [130.5400, 31.6500], [130.5410, 31.5840], // Kagoshima-Chuo
    ],
  },
  {
    id: 'nishi-kyushu',
    name: '西九州新幹線',
    nameEn: 'Nishi-Kyushu Shinkansen',
    type: 'shinkansen',
    color: [150, 120, 120, 100],
    path: [
      // Takeo-Onsen → Ureshino-Onsen → Shin-Omura → Isahaya → Nagasaki
      [130.1082, 33.1594], // Takeo-Onsen
      [130.0500, 33.1000], [129.9800, 33.0400],
      [129.9440, 32.9496], // Shin-Omura
      [129.9100, 32.8800], [129.8800, 32.8400],
      [129.8640, 32.7924], // Isahaya
      [129.8700, 32.7800], [129.8735, 32.7718], // Nagasaki
    ],
  },
];

// ── Impact Check ─────────────────────────────────────────────

function isRouteAffected(route: RailRoute, event: EarthquakeEvent | null): boolean {
  if (!event) return false;
  const radius = impactRadiusKm(event.magnitude, event.depth_km, event.faultType);
  return route.path.some(([lng, lat]) =>
    haversineKm(lat, lng, event.lat, event.lng) <= radius,
  );
}

// ── Tooltip ──────────────────────────────────────────────────

const STATUS_LABELS: Record<RailOperationStatus, { text: () => string; color: string }> = {
  normal: { text: () => t('rail.tooltip.normalOps'), color: '#6ee7b7' },
  delayed: { text: () => t('rail.tooltip.delayed'), color: '#e6af32' },
  suspended: { text: () => t('rail.tooltip.suspended'), color: '#dc4640' },
  partial: { text: () => t('rail.tooltip.partial'), color: '#dcaa32' },
  unknown: { text: () => t('rail.tooltip.unknown'), color: '#94a3b8' },
};

export function formatRailTooltip(
  route: RailRoute,
  event: EarthquakeEvent | null,
  statuses?: RailLineStatus[],
): string {
  const affected = isRouteAffected(route, event);
  const live = statuses?.find((s) => s.lineId === route.id);
  const typeLabel = route.type === 'shinkansen' ? t('rail.tooltip.shinkansen') : t('rail.tooltip.conventional');
  const stations = route.path.length;

  let statusHtml = '';
  if (live && live.status !== 'normal') {
    const label = STATUS_LABELS[live.status];
    statusHtml = `
      <div style="color:${label.color};font-weight:600;margin-top:4px">
        ${label.text()}${live.cause ? ` — ${escapeHtml(live.cause)}` : ''}
      </div>`;
  } else if (affected) {
    statusHtml = `<div style="color:#dc4640;font-weight:600;margin-top:4px">${t('rail.tooltip.likelySuspended')}</div>`;
  } else if (live) {
    statusHtml = `<div style="color:#6ee7b7;font-size:10px;margin-top:4px">${t('rail.tooltip.normalStatus')}</div>`;
  }

  return `
    <div style="font-weight:600;font-size:12px;margin-bottom:3px">${escapeHtml(route.name)}</div>
    <div style="opacity:0.7;font-size:11px">${escapeHtml(route.nameEn)}</div>
    <div style="margin-top:4px;opacity:0.6">${typeLabel} · ${tf('rail.tooltip.stations', { n: stations })}</div>
    ${statusHtml}
  `;
}

// ── Layer Factory ────────────────────────────────────────────

export function createRailLayers(
  selectedEvent: EarthquakeEvent | null,
  zoom: number,
  railStatuses: RailLineStatus[] = [],
  sWaveRadiusKm: number | null = null,
): Layer[] {
  if (zoom < 4) return [];

  const statusMap = new Map(railStatuses.map((s) => [s.lineId, s]));

  const data: RailDatum[] = RAIL_ROUTES.map((r) => {
    let affected = isRouteAffected(r, selectedEvent);

    // S-wave cascade: override to unaffected if wave hasn't reached any segment point
    if (affected && sWaveRadiusKm !== null && selectedEvent) {
      const anyReached = r.path.some(([lng, lat]) =>
        haversineKm(lat, lng, selectedEvent.lat, selectedEvent.lng) <= sWaveRadiusKm,
      );
      if (!anyReached) {
        affected = false;
      }
    }

    return {
      ...r,
      affected,
      liveStatus: statusMap.get(r.id)?.status ?? null,
      liveCause: statusMap.get(r.id)?.cause,
    };
  });

  const layers: Layer[] = [];

  // 1. Glow underlay — only for disrupted lines
  const disruptedData = data.filter((d) =>
    d.liveStatus === 'suspended' || d.liveStatus === 'delayed' || d.liveStatus === 'partial',
  );
  if (disruptedData.length > 0) {
    layers.push(new PathLayer<RailDatum>({
      id: 'rail-glow',
      data: disruptedData,
      pickable: false,
      widthUnits: 'pixels',
      widthMinPixels: 0,
      getPath: (d) => smoothPath(d.path, 4),
      getWidth: (d) => d.liveStatus === 'suspended' ? 10 : 8,
      getColor: (d): RGBA =>
        d.liveStatus === 'suspended' ? SUSPENDED_GLOW : DELAYED_GLOW,
      updateTriggers: {
        getColor: [railStatuses],
        getWidth: [railStatuses],
      },
    }));
  }

  // 2. Main path layer
  layers.push(new PathLayer<RailDatum>({
    id: 'rail',
    data,
    pickable: true,
    autoHighlight: true,
    highlightColor: [140, 180, 220, 120],
    widthUnits: 'pixels',
    widthMinPixels: 0.5,
    getPath: (d) => smoothPath(d.path, 4),
    getWidth: (d) => {
      if (d.liveStatus === 'suspended') return 2.5;
      if (d.liveStatus === 'delayed' || d.liveStatus === 'partial') return 2.2;
      return d.type === 'shinkansen' ? 2 : 1;
    },
    getColor: (d): RGBA => {
      if (d.liveStatus === 'suspended') return SUSPENDED_COLOR;
      if (d.liveStatus === 'delayed') return DELAYED_COLOR;
      if (d.liveStatus === 'partial') return PARTIAL_COLOR;
      if (d.affected) return AFFECTED_COLOR;
      return d.color;
    },
    ...({
      getDashArray: (d: RailDatum): [number, number] => {
        if (d.liveStatus === 'suspended') return [6, 3];
        if (d.liveStatus === 'partial') return [10, 3];
        return [0, 0];
      },
      dashJustified: true,
    } as Record<string, unknown>),
    extensions: [new PathStyleExtension({ dash: true })],
    updateTriggers: {
      getColor: [selectedEvent?.id, railStatuses, sWaveRadiusKm],
      getWidth: [railStatuses, sWaveRadiusKm],
      getDashArray: [railStatuses],
    },
  }));

  // 3. Status badges at midpoint (z6+)
  if (zoom >= 6 && disruptedData.length > 0) {
    layers.push(new TextLayer<RailDatum>({
      id: 'rail-status-badges',
      data: disruptedData,
      pickable: false,
      getPosition: (d) => {
        const mid = Math.floor(d.path.length / 2);
        return d.path[mid];
      },
      getText: (d) => {
        if (d.liveStatus === 'suspended') return '運休';
        if (d.liveStatus === 'delayed') return '遅延';
        if (d.liveStatus === 'partial') return '一部運休';
        return '';
      },
      getSize: 10,
      getColor: (d) => {
        if (d.liveStatus === 'suspended') return [220, 70, 60, 240];
        return [230, 175, 50, 240];
      },
      fontFamily: 'Noto Sans JP, system-ui, sans-serif',
      fontWeight: 700,
      outlineWidth: 3,
      outlineColor: [10, 14, 20, 220],
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      getPixelOffset: [0, -12],
    }));
  }

  return layers;
}
