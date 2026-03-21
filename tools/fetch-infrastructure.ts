#!/usr/bin/env npx tsx
/**
 * Fetch Japanese Infrastructure from OpenStreetMap Overpass API
 *
 * Queries OSM for critical infrastructure across Japan and outputs
 * a normalized JSON file compatible with OpsAsset interface.
 *
 * Categories: hospitals, fire stations, rail stations, airports,
 * power plants, substations, water works, dams, ports, government,
 * telecom towers
 *
 * Usage: npx tsx tools/fetch-infrastructure.ts
 * Output: apps/globe/public/data/infrastructure.json
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '../apps/globe/public/data/infrastructure.json');

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const REQUEST_DELAY_MS = 25_000; // Overpass rate limit: ~2 req/min, generous buffer

// ── Types ────────────────────────────────────────────────────

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface AssetRecord {
  id: string;
  region: string;
  class: string;
  name: string;
  nameJa: string | null;
  lat: number;
  lng: number;
  tags: string[];
  minZoomTier: string;
}

// ── Region Classifier ────────────────────────────────────────

function classifyRegion(lat: number, lng: number): string {
  // Hokkaido
  if (lat > 41.3) return 'hokkaido';
  // Okinawa / far south
  if (lat < 30.0) return 'kyushu';
  // Tohoku (northeast Honshu)
  if (lat > 36.85 && lng > 139.0) return 'tohoku';
  // Niigata area (Chubu, northeast)
  if (lat > 37.0 && lng >= 137.5 && lng <= 140.0) return 'chubu';
  // Kanto
  if (lat >= 35.0 && lat <= 36.85 && lng >= 138.8 && lng <= 140.9) return 'kanto';
  // Shikoku (island south of Chugoku)
  if (lat >= 32.7 && lat <= 34.35 && lng >= 132.0 && lng <= 134.9) return 'shikoku';
  // Kyushu
  if (lng < 131.5 && lat < 34.5) return 'kyushu';
  if (lat < 33.3 && lng < 132.0) return 'kyushu';
  if (lat < 33.0) return 'kyushu';
  // Chugoku
  if (lat >= 33.3 && lat <= 35.8 && lng >= 130.5 && lng < 134.0) return 'chugoku';
  // Kansai
  if (lat >= 33.5 && lat <= 35.5 && lng >= 134.0 && lng <= 137.0) return 'kansai';
  // Chubu (central catch-all)
  if (lat >= 34.5 && lat <= 37.5 && lng >= 135.5 && lng <= 139.5) return 'chubu';
  // Fallback heuristics
  if (lng < 134.0) return 'chugoku';
  if (lat > 36.5) return 'tohoku';
  return 'chubu';
}

// ── Coordinate Extraction ────────────────────────────────────

function getCoords(el: OverpassElement): { lat: number; lng: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

// ── Overpass Query Runner ────────────────────────────────────

async function queryOverpass(filter: string, retries = 3): Promise<OverpassElement[]> {
  const query = `[out:json][timeout:300];area["ISO3166-1"="JP"]->.japan;(${filter}(area.japan););out center;`;
  const body = `data=${encodeURIComponent(query)}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const resp = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (resp.status === 429 && attempt < retries) {
      const wait = 30_000 * attempt;
      console.log(`  ⚠ Rate limited, retry ${attempt}/${retries} in ${wait / 1000}s...`);
      await sleep(wait);
      continue;
    }

    if (!resp.ok) {
      throw new Error(`Overpass ${resp.status}`);
    }

    const data = await resp.json() as { elements: OverpassElement[] };
    return data.elements;
  }

  throw new Error('Overpass: max retries exceeded');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Category Processors ──────────────────────────────────────

interface CategoryDef {
  label: string;
  assetClass: string;
  filter: string;
  process: (el: OverpassElement) => AssetRecord | null;
}

function makeId(prefix: string, el: OverpassElement): string {
  return `osm-${prefix}-${el.type[0]}${el.id}`;
}

function getName(tags: Record<string, string>): { name: string; nameJa: string | null } {
  const nameJa = tags['name'] || null;
  const nameEn = tags['name:en'] || tags['name:ro'] || null;

  // If English name exists, use it as primary with Japanese as secondary
  if (nameEn) {
    return { name: nameEn, nameJa };
  }
  // Otherwise use Japanese for both
  if (nameJa) {
    return { name: nameJa, nameJa };
  }
  return { name: 'Unknown', nameJa: null };
}

function isInJapan(lat: number, lng: number): boolean {
  return lat >= 24.0 && lat <= 46.0 && lng >= 122.0 && lng <= 154.0;
}

const CATEGORIES: CategoryDef[] = [
  // ── Hospitals ──────────────────────────────────────────
  {
    label: 'Hospitals',
    assetClass: 'hospital',
    filter: 'nwr["amenity"="hospital"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      // Filter: skip very small clinics
      // Include if: has beds, is emergency-designated, or is named (most real hospitals have names)
      const beds = parseInt(tags.beds || '0');
      const isEmergency = tags.emergency === 'yes' || tags['emergency:phone'] != null;
      const isUniversity = (nameJa || name).includes('大学') || name.includes('University');
      const isMedCenter = (nameJa || name).includes('医療センター') || name.includes('Medical Center');
      const isRedCross = (nameJa || name).includes('赤十字') || name.includes('Red Cross');
      const isDMAT = (nameJa || name).includes('災害拠点');

      // Zoom tier
      let tier = 'city';
      if (beds >= 500 || isUniversity || isDMAT) tier = 'national';
      else if (beds >= 200 || isEmergency || isMedCenter || isRedCross) tier = 'regional';

      // Tags
      const assetTags: string[] = [];
      if (isEmergency) assetTags.push('emergency');
      if (isUniversity) assetTags.push('university');
      if (isRedCross) assetTags.push('red-cross');
      if (isDMAT) assetTags.push('dmat');
      if (beds >= 500) assetTags.push('major');
      if (beds > 0) assetTags.push(`beds:${beds}`);

      return {
        id: makeId('hospital', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'hospital',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: assetTags,
        minZoomTier: tier,
      };
    },
  },

  // ── Fire Stations ──────────────────────────────────────
  {
    label: 'Fire Stations',
    assetClass: 'government_eoc',
    filter: 'nwr["amenity"="fire_station"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      const n = nameJa || name;
      const isHQ = n.includes('本部') || n.includes('消防局') || n.includes('Headquarters');
      const tier = isHQ ? 'regional' : 'city';

      return {
        id: makeId('fire', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'government_eoc',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: ['fire_station', 'emergency', ...(isHQ ? ['headquarters'] : [])],
        minZoomTier: tier,
      };
    },
  },

  // ── Rail Stations ──────────────────────────────────────
  {
    label: 'Rail Stations',
    assetClass: 'rail_hub',
    filter: 'nwr["railway"="station"]["train"!="no"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      // Determine importance
      const isShinkansen = (tags.highspeed === 'yes')
        || (tags.name || '').includes('新幹線')
        || (tags.operator || '').includes('新幹線');
      const isJR = (tags.operator || '').includes('JR') || (tags.operator || '').includes('旅客鉄道');
      const isMetro = tags.station === 'subway' || (tags.network || '').includes('メトロ');
      const isMajorTerminal = ['東京駅', '新宿駅', '渋谷駅', '大阪駅', '梅田駅', '名古屋駅',
        '博多駅', '京都駅', '横浜駅', '札幌駅', '仙台駅', '広島駅', '神戸駅',
        'Tokyo', 'Shinjuku', 'Shibuya', 'Osaka', 'Umeda', 'Nagoya',
        'Hakata', 'Kyoto', 'Yokohama', 'Sapporo', 'Sendai', 'Hiroshima',
      ].some((t) => (nameJa || name).includes(t));

      let tier = 'district';
      if (isShinkansen || isMajorTerminal) tier = 'national';
      else if (isJR) tier = 'regional';
      else if (isMetro) tier = 'city';

      // Skip minor private railway halts
      if (tier === 'district' && !isJR && !isMetro) return null;

      const assetTags: string[] = [];
      if (isShinkansen) assetTags.push('shinkansen');
      if (isJR) assetTags.push('jr');
      if (isMetro) assetTags.push('metro');
      if (isMajorTerminal) assetTags.push('terminal');

      return {
        id: makeId('rail', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'rail_hub',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: assetTags,
        minZoomTier: tier,
      };
    },
  },

  // ── Airports ───────────────────────────────────────────
  {
    label: 'Airports',
    assetClass: 'airport',
    filter: 'nwr["aeroway"="aerodrome"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      // Skip heliports and very small airfields
      if (tags.aeroway === 'heliport') return null;
      const type = tags['aerodrome:type'] || tags.type || '';
      if (type === 'private' || type === 'military') {
        // Include military airfields at lower tier
        if (type === 'military') {
          return {
            id: makeId('airport', el),
            region: classifyRegion(coords.lat, coords.lng),
            class: 'airport',
            name,
            nameJa,
            lat: coords.lat,
            lng: coords.lng,
            tags: ['aviation', 'military'],
            minZoomTier: 'regional',
          };
        }
        return null;
      }

      const isInternational = (tags.international === 'yes')
        || (nameJa || name).includes('国際')
        || name.includes('International');
      const iata = tags.iata || '';

      let tier = 'regional';
      if (isInternational || ['NRT', 'HND', 'KIX', 'NGO', 'CTS', 'FUK', 'OKA'].includes(iata)) {
        tier = 'national';
      }

      const assetTags = ['aviation'];
      if (isInternational) assetTags.push('international');
      if (tags.military === 'yes') assetTags.push('military');
      if (iata) assetTags.push(`iata:${iata}`);

      return {
        id: makeId('airport', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'airport',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: assetTags,
        minZoomTier: tier,
      };
    },
  },

  // ── Power Plants ───────────────────────────────────────
  {
    label: 'Power Plants',
    assetClass: 'power_substation',
    filter: 'nwr["power"="plant"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      // Skip solar farms and tiny generators
      const source = tags['plant:source'] || tags['generator:source'] || '';
      if (source === 'solar' || source === 'wind') return null;

      const output = parseFloat(tags['plant:output:electricity'] || '0');
      const isNuclear = source === 'nuclear';
      // Skip nuclear — we keep those as manual overrides
      if (isNuclear) return null;

      let tier = 'city';
      if (output >= 1000) tier = 'national';    // >= 1 GW
      else if (output >= 100) tier = 'regional'; // >= 100 MW

      const assetTags: string[] = [];
      if (source) assetTags.push(source);
      if (tags.operator) assetTags.push(`op:${tags.operator}`);

      return {
        id: makeId('power', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'power_substation',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: assetTags,
        minZoomTier: tier,
      };
    },
  },

  // ── Power Substations ──────────────────────────────────
  {
    label: 'Power Substations',
    assetClass: 'power_substation',
    filter: 'nwr["power"="substation"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      // Parse voltage — only include high-voltage substations (>= 66kV)
      const voltageStr = tags.voltage || '0';
      const voltages = voltageStr.split(';').map((v) => parseInt(v.trim()));
      const maxVoltage = Math.max(...voltages);
      if (maxVoltage < 66000) return null; // Skip distribution-level

      let tier = 'city';
      if (maxVoltage >= 500000) tier = 'national';     // UHV
      else if (maxVoltage >= 275000) tier = 'national'; // Extra High Voltage
      else if (maxVoltage >= 154000) tier = 'regional'; // High Voltage

      return {
        id: makeId('substation', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'power_substation',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: ['substation', `voltage:${maxVoltage}`],
        minZoomTier: tier,
      };
    },
  },

  // ── Water Works ────────────────────────────────────────
  {
    label: 'Water Treatment',
    assetClass: 'water_facility',
    filter: 'nwr["man_made"="water_works"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      const n = nameJa || name;
      const isMajor = n.includes('浄水場') || n.includes('Water Purification');

      return {
        id: makeId('water', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'water_facility',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: ['water', ...(isMajor ? ['purification'] : [])],
        minZoomTier: isMajor ? 'regional' : 'city',
      };
    },
  },

  // ── Dams ───────────────────────────────────────────────
  {
    label: 'Dams',
    assetClass: 'dam',
    filter: 'nwr["waterway"="dam"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      const height = parseFloat(tags.height || '0');
      let tier = 'city';
      if (height >= 100) tier = 'national';
      else if (height >= 50) tier = 'regional';

      const assetTags: string[] = ['dam'];
      if (height > 0) assetTags.push(`height:${height}m`);

      return {
        id: makeId('dam', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'dam',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: assetTags,
        minZoomTier: tier,
      };
    },
  },

  // ── Ports ──────────────────────────────────────────────
  {
    label: 'Ports & Harbours',
    assetClass: 'port',
    filter: `nwr["seamark:type"="harbour"];nwr["industrial"="port"];nwr["landuse"="port"]`,
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      // Skip marinas and small fishing ports
      if (tags.leisure === 'marina') return null;

      const n = nameJa || name;
      const isInternational = n.includes('国際') || name.includes('International');
      const isMajor = ['東京港', '横浜港', '名古屋港', '大阪港', '神戸港', '博多港', '千葉港',
        'Tokyo', 'Yokohama', 'Nagoya', 'Osaka', 'Kobe', 'Hakata', 'Chiba',
      ].some((t) => (nameJa || name).includes(t));

      let tier = 'city';
      if (isMajor || isInternational) tier = 'national';
      else tier = 'regional';

      const assetTags = ['port', 'coastal'];
      if (isInternational) assetTags.push('international');

      return {
        id: makeId('port', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'port',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: assetTags,
        minZoomTier: tier,
      };
    },
  },

  // ── Government ─────────────────────────────────────────
  {
    label: 'Government Offices',
    assetClass: 'government_eoc',
    filter: 'nwr["office"="government"]["admin_level"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      const level = parseInt(tags.admin_level || '99');
      // admin_level: 2=national, 4=prefectural, 7=municipal
      if (level > 8) return null; // Skip sub-municipal

      let tier = 'city';
      if (level <= 4) tier = 'national';
      else if (level <= 7) tier = 'regional';

      return {
        id: makeId('gov', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'government_eoc',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: ['government', `admin_level:${level}`],
        minZoomTier: tier,
      };
    },
  },

  // ── Telecom ────────────────────────────────────────────
  {
    label: 'Telecom Infrastructure',
    assetClass: 'telecom_hub',
    filter: 'nwr["man_made"="communications_tower"];nwr["telecom"="data_center"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      const isDataCenter = tags.telecom === 'data_center' || (nameJa || name).includes('データセンター');

      return {
        id: makeId('telecom', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'telecom_hub',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: ['telecom', isDataCenter ? 'datacenter' : 'tower'],
        minZoomTier: isDataCenter ? 'regional' : 'city',
      };
    },
  },

  // ── Evacuation Shelters ────────────────────────────────
  {
    label: 'Evacuation Shelters',
    assetClass: 'evacuation_site',
    filter: 'nwr["social_facility"="shelter"];nwr["emergency"="assembly_point"];nwr["amenity"="shelter"]["shelter_type"="flood"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;

      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;

      return {
        id: makeId('evac', el),
        region: classifyRegion(coords.lat, coords.lng),
        class: 'evacuation_site',
        name,
        nameJa,
        lat: coords.lat,
        lng: coords.lng,
        tags: ['shelter', 'evacuation'],
        minZoomTier: 'city',
      };
    },
  },
];

// ── Deduplication ────────────────────────────────────────────

function deduplicateByProximity(assets: AssetRecord[]): AssetRecord[] {
  const result: AssetRecord[] = [];
  const seen = new Set<string>();

  for (const asset of assets) {
    // Grid-based dedup: round to ~100m cells
    const key = `${asset.class}:${(asset.lat * 100).toFixed(0)}:${(asset.lng * 100).toFixed(0)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(asset);
  }

  return result;
}

// ── Main Pipeline ────────────────────────────────────────────

async function main() {
  console.log('🏗️  Fetching Japanese infrastructure from OpenStreetMap...\n');

  const allAssets: AssetRecord[] = [];
  const stats: Record<string, number> = {};

  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    console.log(`[${i + 1}/${CATEGORIES.length}] Fetching ${cat.label}...`);

    try {
      const elements = await queryOverpass(cat.filter);
      console.log(`  → ${elements.length} raw elements`);

      let count = 0;
      for (const el of elements) {
        const asset = cat.process(el);
        if (asset) {
          allAssets.push(asset);
          count++;
        }
      }

      stats[cat.label] = count;
      console.log(`  → ${count} assets after filtering\n`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err}`);
      stats[cat.label] = 0;
    }

    // Rate limit delay (skip after last)
    if (i < CATEGORIES.length - 1) {
      console.log(`  ⏳ Waiting ${REQUEST_DELAY_MS / 1000}s for rate limit...\n`);
      await sleep(REQUEST_DELAY_MS);
    }
  }

  // Deduplicate
  console.log('\n🔄 Deduplicating by proximity...');
  const deduped = deduplicateByProximity(allAssets);
  console.log(`  ${allAssets.length} → ${deduped.length} assets\n`);

  // Sort: national > regional > city > district
  const tierOrder: Record<string, number> = { national: 0, regional: 1, city: 2, district: 3 };
  deduped.sort((a, b) => {
    const td = (tierOrder[a.minZoomTier] ?? 3) - (tierOrder[b.minZoomTier] ?? 3);
    if (td !== 0) return td;
    return a.class.localeCompare(b.class);
  });

  // Write output
  writeFileSync(OUTPUT_PATH, JSON.stringify(deduped, null, 2), 'utf-8');
  console.log(`✅ Written ${deduped.length} assets to ${OUTPUT_PATH}\n`);

  // Summary
  console.log('── Summary ──────────────────────────────────');
  for (const [label, count] of Object.entries(stats)) {
    console.log(`  ${label}: ${count}`);
  }
  console.log(`  TOTAL: ${deduped.length} (after dedup)`);

  // Tier breakdown
  const tierCounts: Record<string, number> = {};
  for (const a of deduped) {
    tierCounts[a.minZoomTier] = (tierCounts[a.minZoomTier] || 0) + 1;
  }
  console.log('\n── Zoom Tier Breakdown ──────────────────────');
  for (const [tier, count] of Object.entries(tierCounts).sort()) {
    console.log(`  ${tier}: ${count}`);
  }

  // Region breakdown
  const regionCounts: Record<string, number> = {};
  for (const a of deduped) {
    regionCounts[a.region] = (regionCounts[a.region] || 0) + 1;
  }
  console.log('\n── Region Breakdown ────────────────────────');
  for (const [region, count] of Object.entries(regionCounts).sort()) {
    console.log(`  ${region}: ${count}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
