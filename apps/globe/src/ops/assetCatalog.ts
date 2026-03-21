/**
 * Japan Critical Infrastructure Asset Catalog
 *
 * Nuclear plants are hardcoded as manual overrides (highest priority).
 * All other assets are loaded at runtime from /data/infrastructure.json.
 */

import type { LaunchMetro, OpsAsset, OpsRegion } from './types';
import { fetchReferenceJson } from '../data/referenceApi';
import { cacheRead, cacheWrite } from '../data/idbCache';

const MANUAL_OVERRIDES: OpsAsset[] = [
  { id: 'npp-tomari',           region: 'hokkaido', class: 'nuclear_plant', name: 'Tomari NPP', nameJa: '泊発電所',                    lat: 43.0367, lng: 140.5125, tags: ['nuclear', 'coastal', 'suspended'],           minZoomTier: 'national' },
  { id: 'npp-ohma',             region: 'tohoku',   class: 'nuclear_plant', name: 'Ohma NPP', nameJa: '大間原子力発電所',                      lat: 41.5099, lng: 140.9131, tags: ['nuclear', 'coastal', 'construction'],          minZoomTier: 'national' },
  { id: 'npp-higashidori',      region: 'tohoku',   class: 'nuclear_plant', name: 'Higashidori NPP', nameJa: '東通原子力発電所',               lat: 41.1880, lng: 141.3903, tags: ['nuclear', 'coastal', 'suspended'],           minZoomTier: 'national' },
  { id: 'npp-onagawa',          region: 'tohoku',   class: 'nuclear_plant', name: 'Onagawa NPP', nameJa: '女川原子力発電所',                   lat: 38.3987, lng: 141.5003, tags: ['nuclear', 'coastal', 'operating'],            minZoomTier: 'national' },
  { id: 'npp-fukushima-daiichi',region: 'tohoku',   class: 'nuclear_plant', name: 'Fukushima Daiichi NPP', nameJa: '福島第一原子力発電所',         lat: 37.4218, lng: 141.0337, tags: ['nuclear', 'coastal', 'decommissioning'],      minZoomTier: 'national' },
  { id: 'npp-fukushima-daini',  region: 'tohoku',   class: 'nuclear_plant', name: 'Fukushima Daini NPP', nameJa: '福島第二原子力発電所',           lat: 37.3183, lng: 141.0193, tags: ['nuclear', 'coastal', 'decommissioning'],      minZoomTier: 'national' },
  { id: 'npp-tokai-daini',      region: 'kanto',    class: 'nuclear_plant', name: 'Tokai Daini NPP', nameJa: '東海第二発電所',               lat: 36.4215, lng: 140.6028, tags: ['nuclear', 'coastal', 'suspended'],           minZoomTier: 'national' },
  { id: 'npp-kashiwazaki',      region: 'chubu',    class: 'nuclear_plant', name: 'Kashiwazaki-Kariwa NPP', nameJa: '柏崎刈羽原子力発電所',        lat: 37.4259, lng: 138.5941, tags: ['nuclear', 'coastal', 'suspended'],           minZoomTier: 'national' },
  { id: 'npp-shika',            region: 'chubu',    class: 'nuclear_plant', name: 'Shika NPP', nameJa: '志賀原子力発電所',                     lat: 37.0609, lng: 136.7265, tags: ['nuclear', 'coastal', 'suspended'],           minZoomTier: 'national' },
  { id: 'npp-hamaoka',          region: 'chubu',    class: 'nuclear_plant', name: 'Hamaoka NPP', nameJa: '浜岡原子力発電所',                   lat: 34.6235, lng: 138.1421, tags: ['nuclear', 'coastal', 'suspended'],           minZoomTier: 'national' },
  { id: 'npp-tsuruga',          region: 'kansai',   class: 'nuclear_plant', name: 'Tsuruga NPP', nameJa: '敦賀発電所',                   lat: 35.7519, lng: 136.0189, tags: ['nuclear', 'coastal', 'suspended'],           minZoomTier: 'national' },
  { id: 'npp-mihama',           region: 'kansai',   class: 'nuclear_plant', name: 'Mihama NPP', nameJa: '美浜発電所',                    lat: 35.7024, lng: 135.9634, tags: ['nuclear', 'coastal', 'operating'],            minZoomTier: 'national' },
  { id: 'npp-ohi',              region: 'kansai',   class: 'nuclear_plant', name: 'Ohi NPP', nameJa: '大飯発電所',                       lat: 35.5411, lng: 135.6548, tags: ['nuclear', 'coastal', 'operating'],            minZoomTier: 'national' },
  { id: 'npp-takahama',         region: 'kansai',   class: 'nuclear_plant', name: 'Takahama NPP', nameJa: '高浜発電所',                  lat: 35.5223, lng: 135.5036, tags: ['nuclear', 'coastal', 'operating'],            minZoomTier: 'national' },
  { id: 'npp-shimane',          region: 'chugoku',  class: 'nuclear_plant', name: 'Shimane NPP', nameJa: '島根原子力発電所',                   lat: 35.5379, lng: 132.9991, tags: ['nuclear', 'coastal', 'suspended'],           minZoomTier: 'national' },
  { id: 'npp-ikata',            region: 'shikoku',  class: 'nuclear_plant', name: 'Ikata NPP', nameJa: '伊方発電所',                     lat: 33.4909, lng: 132.3088, tags: ['nuclear', 'coastal', 'operating'],            minZoomTier: 'national' },
  { id: 'npp-genkai',           region: 'kyushu',   class: 'nuclear_plant', name: 'Genkai NPP', nameJa: '玄海原子力発電所',                    lat: 33.5152, lng: 129.8360, tags: ['nuclear', 'coastal', 'operating'],            minZoomTier: 'national' },
  { id: 'npp-sendai',           region: 'kyushu',   class: 'nuclear_plant', name: 'Sendai (Satsumasendai) NPP', nameJa: '川内原子力発電所',    lat: 31.8335, lng: 130.1887, tags: ['nuclear', 'coastal', 'operating'],            minZoomTier: 'national' },
];

export let OPS_ASSETS: OpsAsset[] = [...MANUAL_OVERRIDES];

const manualIds = new Set(MANUAL_OVERRIDES.map((a) => a.id));

interface AssetCatalogResponse {
  assets: OpsAsset[];
}

const CACHE_KEY = 'infrastructure-v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

export async function loadOpsAssets(): Promise<number> {
  // 1. IndexedDB cache — instant load on repeat visits
  const cached = await cacheRead<OpsAsset[]>(CACHE_KEY, CACHE_TTL);
  if (cached && cached.length > 0) {
    OPS_ASSETS = [...MANUAL_OVERRIDES, ...cached.filter((a) => !manualIds.has(a.id))];
    return OPS_ASSETS.length;
  }

  // 2. Static file — full catalog (21K+ assets)
  try {
    const res = await fetch('/data/infrastructure.json');
    if (res.ok) {
      const loaded: OpsAsset[] = await res.json();
      OPS_ASSETS = [...MANUAL_OVERRIDES, ...loaded.filter((a) => !manualIds.has(a.id))];
      cacheWrite(CACHE_KEY, loaded); // fire-and-forget
      return OPS_ASSETS.length;
    }
  } catch (err) {
    console.warn('[assetCatalog] Static infrastructure.json failed:', err);
  }

  // 3. Worker API fallback — for future R2-backed catalog
  const payload = await fetchReferenceJson<AssetCatalogResponse>('/api/reference/assets', 10_000);
  if (Array.isArray(payload?.assets) && payload.assets.length > 0) {
    OPS_ASSETS = payload.assets;
    return OPS_ASSETS.length;
  }

  console.warn('[assetCatalog] All sources failed, using manual overrides only');
  return OPS_ASSETS.length;
}

// ── Query helpers ────────────────────────────────────────────────

export function getMetroAssets(metro: LaunchMetro): OpsAsset[] {
  return OPS_ASSETS.filter((asset) => asset.metro === metro);
}

export function getRegionAssets(region: OpsRegion): OpsAsset[] {
  return OPS_ASSETS.filter((asset) => asset.region === region);
}

export function getAssetsByClass(assetClass: OpsAsset['class']): OpsAsset[] {
  return OPS_ASSETS.filter((asset) => asset.class === assetClass);
}

export function getAssetById(id: string): OpsAsset | undefined {
  return OPS_ASSETS.find((asset) => asset.id === id);
}
