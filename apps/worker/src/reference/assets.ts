import type { OpsAsset } from '../../../globe/src/ops/types.ts';

export interface ReferenceAssetBindings {
  FEED_BUCKET?: R2Bucket;
  REFERENCE_DATA_BASE_URL?: string;
}

export interface ReferenceAssetCatalog {
  assets: OpsAsset[];
  source: 'manual' | 'bucket' | 'remote';
}

const MANUAL_OVERRIDES: OpsAsset[] = [
  { id: 'npp-tomari', region: 'hokkaido', class: 'nuclear_plant', name: 'Tomari NPP', nameJa: '泊発電所', lat: 43.0367, lng: 140.5125, tags: ['nuclear', 'coastal', 'suspended'], minZoomTier: 'national' },
  { id: 'npp-ohma', region: 'tohoku', class: 'nuclear_plant', name: 'Ohma NPP', nameJa: '大間原子力発電所', lat: 41.5099, lng: 140.9131, tags: ['nuclear', 'coastal', 'construction'], minZoomTier: 'national' },
  { id: 'npp-higashidori', region: 'tohoku', class: 'nuclear_plant', name: 'Higashidori NPP', nameJa: '東通原子力発電所', lat: 41.188, lng: 141.3903, tags: ['nuclear', 'coastal', 'suspended'], minZoomTier: 'national' },
  { id: 'npp-onagawa', region: 'tohoku', class: 'nuclear_plant', name: 'Onagawa NPP', nameJa: '女川原子力発電所', lat: 38.3987, lng: 141.5003, tags: ['nuclear', 'coastal', 'operating'], minZoomTier: 'national' },
  { id: 'npp-fukushima-daiichi', region: 'tohoku', class: 'nuclear_plant', name: 'Fukushima Daiichi NPP', nameJa: '福島第一原子力発電所', lat: 37.4218, lng: 141.0337, tags: ['nuclear', 'coastal', 'decommissioning'], minZoomTier: 'national' },
  { id: 'npp-fukushima-daini', region: 'tohoku', class: 'nuclear_plant', name: 'Fukushima Daini NPP', nameJa: '福島第二原子力発電所', lat: 37.3183, lng: 141.0193, tags: ['nuclear', 'coastal', 'decommissioning'], minZoomTier: 'national' },
  { id: 'npp-tokai-daini', region: 'kanto', class: 'nuclear_plant', name: 'Tokai Daini NPP', nameJa: '東海第二発電所', lat: 36.4215, lng: 140.6028, tags: ['nuclear', 'coastal', 'suspended'], minZoomTier: 'national' },
  { id: 'npp-kashiwazaki', region: 'chubu', class: 'nuclear_plant', name: 'Kashiwazaki-Kariwa NPP', nameJa: '柏崎刈羽原子力発電所', lat: 37.4259, lng: 138.5941, tags: ['nuclear', 'coastal', 'suspended'], minZoomTier: 'national' },
  { id: 'npp-shika', region: 'chubu', class: 'nuclear_plant', name: 'Shika NPP', nameJa: '志賀原子力発電所', lat: 37.0609, lng: 136.7265, tags: ['nuclear', 'coastal', 'suspended'], minZoomTier: 'national' },
  { id: 'npp-hamaoka', region: 'chubu', class: 'nuclear_plant', name: 'Hamaoka NPP', nameJa: '浜岡原子力発電所', lat: 34.6235, lng: 138.1421, tags: ['nuclear', 'coastal', 'suspended'], minZoomTier: 'national' },
  { id: 'npp-tsuruga', region: 'kansai', class: 'nuclear_plant', name: 'Tsuruga NPP', nameJa: '敦賀発電所', lat: 35.7519, lng: 136.0189, tags: ['nuclear', 'coastal', 'suspended'], minZoomTier: 'national' },
  { id: 'npp-mihama', region: 'kansai', class: 'nuclear_plant', name: 'Mihama NPP', nameJa: '美浜発電所', lat: 35.7024, lng: 135.9634, tags: ['nuclear', 'coastal', 'operating'], minZoomTier: 'national' },
  { id: 'npp-ohi', region: 'kansai', class: 'nuclear_plant', name: 'Ohi NPP', nameJa: '大飯発電所', lat: 35.5411, lng: 135.6548, tags: ['nuclear', 'coastal', 'operating'], minZoomTier: 'national' },
  { id: 'npp-takahama', region: 'kansai', class: 'nuclear_plant', name: 'Takahama NPP', nameJa: '高浜発電所', lat: 35.5223, lng: 135.5036, tags: ['nuclear', 'coastal', 'operating'], minZoomTier: 'national' },
  { id: 'npp-shimane', region: 'chugoku', class: 'nuclear_plant', name: 'Shimane NPP', nameJa: '島根原子力発電所', lat: 35.5379, lng: 132.9991, tags: ['nuclear', 'coastal', 'suspended'], minZoomTier: 'national' },
  { id: 'npp-ikata', region: 'shikoku', class: 'nuclear_plant', name: 'Ikata NPP', nameJa: '伊方発電所', lat: 33.4909, lng: 132.3088, tags: ['nuclear', 'coastal', 'operating'], minZoomTier: 'national' },
  { id: 'npp-genkai', region: 'kyushu', class: 'nuclear_plant', name: 'Genkai NPP', nameJa: '玄海原子力発電所', lat: 33.5152, lng: 129.836, tags: ['nuclear', 'coastal', 'operating'], minZoomTier: 'national' },
  { id: 'npp-sendai', region: 'kyushu', class: 'nuclear_plant', name: 'Sendai (Satsumasendai) NPP', nameJa: '川内原子力発電所', lat: 31.8335, lng: 130.1887, tags: ['nuclear', 'coastal', 'operating'], minZoomTier: 'national' },
];

const manualIds = new Set(MANUAL_OVERRIDES.map((asset) => asset.id));

function mergeAssets(loaded: OpsAsset[]): OpsAsset[] {
  return [...MANUAL_OVERRIDES, ...loaded.filter((asset) => !manualIds.has(asset.id))];
}

async function loadAssetsFromBucket(bucket: R2Bucket | undefined): Promise<OpsAsset[] | null> {
  if (!bucket) return null;

  const object = await bucket.get('reference/infrastructure.json');
  if (!object) return null;

  const loaded = await object.json() as OpsAsset[];
  return Array.isArray(loaded) ? loaded : null;
}

async function loadAssetsFromRemote(baseUrl: string | undefined): Promise<OpsAsset[] | null> {
  if (!baseUrl) return null;

  const target = new URL('/data/infrastructure.json', baseUrl).toString();
  const response = await fetch(target, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`asset catalog responded ${response.status}`);
  }

  const loaded = await response.json() as OpsAsset[];
  return Array.isArray(loaded) ? loaded : null;
}

export async function loadReferenceAssetCatalog(
  bindings: ReferenceAssetBindings,
): Promise<ReferenceAssetCatalog> {
  try {
    const fromBucket = await loadAssetsFromBucket(bindings.FEED_BUCKET);
    if (fromBucket) {
      return { assets: mergeAssets(fromBucket), source: 'bucket' };
    }
  } catch (error) {
    console.warn('[reference/assets] failed to load asset catalog from bucket:', error);
  }

  try {
    const fromRemote = await loadAssetsFromRemote(bindings.REFERENCE_DATA_BASE_URL);
    if (fromRemote) {
      return { assets: mergeAssets(fromRemote), source: 'remote' };
    }
  } catch (error) {
    console.warn('[reference/assets] failed to load asset catalog from remote:', error);
  }

  return {
    assets: [...MANUAL_OVERRIDES],
    source: 'manual',
  };
}

export function getManualAssetOverrides(): OpsAsset[] {
  return [...MANUAL_OVERRIDES];
}
