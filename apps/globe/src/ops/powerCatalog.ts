import type { PowerPlant } from './powerAssessment';
import { fetchReferenceJson } from '../data/referenceApi';

export let POWER_PLANTS: PowerPlant[] = [
  { id: 'npp-tomari', name: '泊発電所', nameEn: 'Tomari', lat: 43.0367, lng: 140.5122, type: 'nuclear', status: 'shutdown', capacityMw: 2070, units: 3, region: 'hokkaido' },
  { id: 'npp-higashidori', name: '東通原子力発電所', nameEn: 'Higashidori', lat: 41.1847, lng: 141.3858, type: 'nuclear', status: 'shutdown', capacityMw: 1100, units: 1, region: 'tohoku' },
  { id: 'npp-onagawa', name: '女川原子力発電所', nameEn: 'Onagawa', lat: 38.4028, lng: 141.5019, type: 'nuclear', status: 'operating', capacityMw: 2174, units: 3, region: 'tohoku' },
  { id: 'npp-fukushima1', name: '福島第一原子力発電所', nameEn: 'Fukushima Daiichi', lat: 37.4211, lng: 141.0328, type: 'nuclear', status: 'decommissioning', capacityMw: 0, units: 6, region: 'tohoku' },
  { id: 'npp-fukushima2', name: '福島第二原子力発電所', nameEn: 'Fukushima Daini', lat: 37.3169, lng: 141.0250, type: 'nuclear', status: 'decommissioning', capacityMw: 0, units: 4, region: 'tohoku' },
  { id: 'npp-tokai2', name: '東海第二発電所', nameEn: 'Tokai Daini', lat: 36.4667, lng: 140.6056, type: 'nuclear', status: 'shutdown', capacityMw: 1100, units: 1, region: 'kanto' },
  { id: 'npp-kashiwazaki', name: '柏崎刈羽原子力発電所', nameEn: 'Kashiwazaki-Kariwa', lat: 37.4264, lng: 138.5958, type: 'nuclear', status: 'shutdown', capacityMw: 8212, units: 7, region: 'chubu' },
  { id: 'npp-shika', name: '志賀原子力発電所', nameEn: 'Shika', lat: 37.0606, lng: 136.7269, type: 'nuclear', status: 'shutdown', capacityMw: 1898, units: 2, region: 'chubu' },
  { id: 'npp-hamaoka', name: '浜岡原子力発電所', nameEn: 'Hamaoka', lat: 34.6236, lng: 138.1433, type: 'nuclear', status: 'shutdown', capacityMw: 3617, units: 3, region: 'chubu' },
  { id: 'npp-tsuruga', name: '敦賀発電所', nameEn: 'Tsuruga', lat: 35.7547, lng: 136.0222, type: 'nuclear', status: 'shutdown', capacityMw: 1517, units: 2, region: 'kansai' },
  { id: 'npp-mihama', name: '美浜発電所', nameEn: 'Mihama', lat: 35.7014, lng: 135.9631, type: 'nuclear', status: 'operating', capacityMw: 826, units: 1, region: 'kansai' },
  { id: 'npp-ohi', name: '大飯発電所', nameEn: 'Ohi', lat: 35.5414, lng: 135.6553, type: 'nuclear', status: 'operating', capacityMw: 2360, units: 2, region: 'kansai' },
  { id: 'npp-takahama', name: '高浜発電所', nameEn: 'Takahama', lat: 35.5222, lng: 135.5019, type: 'nuclear', status: 'operating', capacityMw: 3392, units: 4, region: 'kansai' },
  { id: 'npp-shimane', name: '島根原子力発電所', nameEn: 'Shimane', lat: 35.5389, lng: 132.9994, type: 'nuclear', status: 'operating', capacityMw: 1373, units: 2, region: 'chugoku' },
  { id: 'npp-ikata', name: '伊方発電所', nameEn: 'Ikata', lat: 33.4908, lng: 132.3128, type: 'nuclear', status: 'operating', capacityMw: 890, units: 1, region: 'shikoku' },
  { id: 'npp-genkai', name: '玄海原子力発電所', nameEn: 'Genkai', lat: 33.5153, lng: 129.8364, type: 'nuclear', status: 'operating', capacityMw: 2319, units: 2, region: 'kyushu' },
  { id: 'npp-sendai', name: '川内原子力発電所', nameEn: 'Sendai', lat: 31.8333, lng: 130.1903, type: 'nuclear', status: 'operating', capacityMw: 1780, units: 2, region: 'kyushu' },
  { id: 'npp-ohma', name: '大間原子力発電所', nameEn: 'Ohma', lat: 41.5089, lng: 140.9092, type: 'nuclear', status: 'shutdown', capacityMw: 1383, units: 1, region: 'tohoku' },
  { id: 'tpp-kashima', name: '鹿島火力発電所', nameEn: 'Kashima Thermal', lat: 35.9617, lng: 140.7003, type: 'thermal', status: 'operating', capacityMw: 4400, units: 6, region: 'kanto' },
  { id: 'tpp-hekinan', name: '碧南火力発電所', nameEn: 'Hekinan Thermal', lat: 34.8333, lng: 136.9833, type: 'thermal', status: 'operating', capacityMw: 4100, units: 5, region: 'chubu' },
  { id: 'tpp-chita', name: '知多火力発電所', nameEn: 'Chita Thermal', lat: 34.9750, lng: 136.8500, type: 'thermal', status: 'operating', capacityMw: 3966, units: 6, region: 'chubu' },
  { id: 'tpp-maizuru', name: '舞鶴発電所', nameEn: 'Maizuru Thermal', lat: 35.4833, lng: 135.3833, type: 'thermal', status: 'operating', capacityMw: 1800, units: 2, region: 'kansai' },
  { id: 'tpp-matsuura', name: '松浦火力発電所', nameEn: 'Matsuura Thermal', lat: 33.3500, lng: 129.6667, type: 'thermal', status: 'operating', capacityMw: 2000, units: 2, region: 'kyushu' },
  { id: 'tpp-futtsu', name: '富津火力発電所', nameEn: 'Futtsu Thermal', lat: 35.3421, lng: 139.8319, type: 'thermal', status: 'operating', capacityMw: 5160, units: 4, region: 'kanto' },
  { id: 'tpp-kawasaki', name: '川崎火力発電所', nameEn: 'Kawasaki Thermal', lat: 35.5123, lng: 139.7626, type: 'thermal', status: 'operating', capacityMw: 3420, units: 3, region: 'kanto' },
  { id: 'tpp-anegasaki', name: '姉崎火力発電所', nameEn: 'Anegasaki Thermal', lat: 35.4845, lng: 140.0172, type: 'thermal', status: 'operating', capacityMw: 3600, units: 6, region: 'kanto' },
  { id: 'tpp-sodegaura', name: '袖ケ浦火力発電所', nameEn: 'Sodegaura Thermal', lat: 35.4626, lng: 139.9768, type: 'thermal', status: 'operating', capacityMw: 3600, units: 4, region: 'kanto' },
  { id: 'tpp-yokosuka', name: '横須賀火力発電所', nameEn: 'Yokosuka Thermal', lat: 35.2156, lng: 139.7164, type: 'thermal', status: 'operating', capacityMw: 2274, units: 2, region: 'kanto' },
  { id: 'tpp-yokohama', name: '横浜火力発電所', nameEn: 'Yokohama Thermal', lat: 35.4770, lng: 139.6779, type: 'thermal', status: 'operating', capacityMw: 3325, units: 8, region: 'kanto' },
  { id: 'tpp-hitachinaka', name: '常陸那珂火力発電所', nameEn: 'Hitachinaka Thermal', lat: 36.4368, lng: 140.6138, type: 'thermal', status: 'operating', capacityMw: 2000, units: 2, region: 'kanto' },
  { id: 'tpp-hirono', name: '広野火力発電所', nameEn: 'Hirono Thermal', lat: 37.2330, lng: 141.0150, type: 'thermal', status: 'operating', capacityMw: 3800, units: 6, region: 'tohoku' },
  { id: 'tpp-taketoyo', name: '武豊火力発電所', nameEn: 'Taketoyo Thermal', lat: 34.8244, lng: 136.9238, type: 'thermal', status: 'operating', capacityMw: 1070, units: 2, region: 'chubu' },
  { id: 'tpp-goi', name: '五井火力発電所', nameEn: 'Goi Thermal', lat: 35.5470, lng: 140.0724, type: 'thermal', status: 'operating', capacityMw: 2340, units: 3, region: 'kanto' },
  { id: 'tpp-isogo', name: '磯子火力発電所', nameEn: 'Isogo Thermal', lat: 35.4033, lng: 139.6414, type: 'thermal', status: 'operating', capacityMw: 1200, units: 2, region: 'kanto' },
  { id: 'tpp-tachibana-wan', name: '橘湾火力発電所', nameEn: 'Tachibana-wan Thermal', lat: 33.8563, lng: 134.6514, type: 'thermal', status: 'operating', capacityMw: 2100, units: 2, region: 'shikoku' },
  { id: 'tpp-takehara', name: '竹原火力発電所', nameEn: 'Takehara Thermal', lat: 34.3376, lng: 132.9603, type: 'thermal', status: 'operating', capacityMw: 1300, units: 3, region: 'chugoku' },
  { id: 'tpp-haramachi', name: '原町火力発電所', nameEn: 'Haramachi Thermal', lat: 37.6661, lng: 141.0183, type: 'thermal', status: 'operating', capacityMw: 2000, units: 2, region: 'tohoku' },
  { id: 'tpp-himeji2', name: '姫路第二発電所', nameEn: 'Himeji No.2 Thermal', lat: 34.7772, lng: 134.6903, type: 'thermal', status: 'operating', capacityMw: 2919, units: 6, region: 'kansai' },
  { id: 'tpp-shin-kokura', name: '新小倉発電所', nameEn: 'Shin-Kokura Thermal', lat: 33.9078, lng: 130.8614, type: 'thermal', status: 'operating', capacityMw: 1800, units: 4, region: 'kyushu' },
  { id: 'tpp-reihoku', name: '苓北火力発電所', nameEn: 'Reihoku Thermal', lat: 32.4859, lng: 130.0420, type: 'thermal', status: 'operating', capacityMw: 1400, units: 2, region: 'kyushu' },
  { id: 'tpp-tomato-atsuma', name: '苫東厚真火力発電所', nameEn: 'Tomato-Atsuma Thermal', lat: 42.6120, lng: 141.8050, type: 'thermal', status: 'operating', capacityMw: 1650, units: 4, region: 'hokkaido' },
  { id: 'tpp-shin-sendai', name: '新仙台火力発電所', nameEn: 'Shin-Sendai Thermal', lat: 38.2768, lng: 141.0393, type: 'thermal', status: 'operating', capacityMw: 1000, units: 2, region: 'tohoku' },
  { id: 'tpp-tsuruga-thermal', name: '敦賀火力発電所', nameEn: 'Tsuruga Thermal', lat: 35.6724, lng: 136.0815, type: 'thermal', status: 'operating', capacityMw: 1200, units: 2, region: 'kansai' },
];

interface PowerCatalogResponse {
  plants: PowerPlant[];
}

export async function loadPowerCatalog(): Promise<number> {
  const payload = await fetchReferenceJson<PowerCatalogResponse>('/api/reference/power');
  if (Array.isArray(payload?.plants) && payload.plants.length > 0) {
    POWER_PLANTS = payload.plants;
  }
  return POWER_PLANTS.length;
}
