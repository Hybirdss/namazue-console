#!/usr/bin/env npx tsx
/**
 * Fetch missing infrastructure categories that failed in the initial run.
 * Merges results into the existing infrastructure.json.
 */

import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '../apps/globe/public/data/infrastructure.json');
const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const DELAY_MS = 35_000;

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number; lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface AssetRecord {
  id: string; region: string; class: string;
  name: string; nameJa: string | null;
  lat: number; lng: number;
  tags: string[]; minZoomTier: string;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function getCoords(el: OverpassElement) {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function isInJapan(lat: number, lng: number) {
  return lat >= 24.0 && lat <= 46.0 && lng >= 122.0 && lng <= 154.0;
}

function classifyRegion(lat: number, lng: number): string {
  if (lat > 41.3) return 'hokkaido';
  if (lat < 30.0) return 'kyushu';
  if (lat > 36.85 && lng > 139.0) return 'tohoku';
  if (lat > 37.0 && lng >= 137.5 && lng <= 140.0) return 'chubu';
  if (lat >= 35.0 && lat <= 36.85 && lng >= 138.8 && lng <= 140.9) return 'kanto';
  if (lat >= 32.7 && lat <= 34.35 && lng >= 132.0 && lng <= 134.9) return 'shikoku';
  if (lng < 131.5 && lat < 34.5) return 'kyushu';
  if (lat < 33.3 && lng < 132.0) return 'kyushu';
  if (lat < 33.0) return 'kyushu';
  if (lat >= 33.3 && lat <= 35.8 && lng >= 130.5 && lng < 134.0) return 'chugoku';
  if (lat >= 33.5 && lat <= 35.5 && lng >= 134.0 && lng <= 137.0) return 'kansai';
  if (lat >= 34.5 && lat <= 37.5 && lng >= 135.5 && lng <= 139.5) return 'chubu';
  if (lng < 134.0) return 'chugoku';
  if (lat > 36.5) return 'tohoku';
  return 'chubu';
}

function getName(tags: Record<string, string>) {
  const nameJa = tags['name'] || null;
  const nameEn = tags['name:en'] || tags['name:ro'] || null;
  if (nameEn) return { name: nameEn, nameJa };
  if (nameJa) return { name: nameJa, nameJa };
  return { name: 'Unknown', nameJa: null };
}

function makeId(prefix: string, el: OverpassElement) {
  return `osm-${prefix}-${el.type[0]}${el.id}`;
}

async function queryOverpass(filter: string): Promise<OverpassElement[]> {
  const query = `[out:json][timeout:300];area["ISO3166-1"="JP"]->.japan;(${filter}(area.japan););out center;`;
  const body = `data=${encodeURIComponent(query)}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (resp.status === 429 && attempt < 3) {
      console.log(`  ⚠ Rate limited, waiting ${40 * attempt}s...`);
      await sleep(40_000 * attempt);
      continue;
    }
    if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
    const data = await resp.json() as { elements: OverpassElement[] };
    return data.elements;
  }
  throw new Error('Max retries');
}

// ── Categories that failed ──────────────────────────────────

interface Cat {
  label: string;
  filter: string;
  process: (el: OverpassElement) => AssetRecord | null;
}

const MISSING: Cat[] = [
  {
    label: 'Airports',
    filter: 'nwr["aeroway"="aerodrome"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;
      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;
      if (tags.aeroway === 'heliport') return null;
      const type = tags['aerodrome:type'] || tags.type || '';
      if (type === 'private') return null;
      const isInt = tags.international === 'yes' || (nameJa || name).includes('国際') || name.includes('International');
      const iata = tags.iata || '';
      let tier = 'regional';
      if (isInt || ['NRT','HND','KIX','NGO','CTS','FUK','OKA'].includes(iata)) tier = 'national';
      const t2 = ['aviation'];
      if (isInt) t2.push('international');
      if (iata) t2.push(`iata:${iata}`);
      if (type === 'military' || tags.military === 'yes') t2.push('military');
      return { id: makeId('airport', el), region: classifyRegion(coords.lat, coords.lng), class: 'airport', name, nameJa, lat: coords.lat, lng: coords.lng, tags: t2, minZoomTier: tier };
    },
  },
  {
    label: 'Water Treatment',
    filter: 'nwr["man_made"="water_works"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;
      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;
      const n = nameJa || name;
      const isMajor = n.includes('浄水場') || n.includes('Water Purification');
      return { id: makeId('water', el), region: classifyRegion(coords.lat, coords.lng), class: 'water_facility', name, nameJa, lat: coords.lat, lng: coords.lng, tags: ['water', ...(isMajor ? ['purification'] : [])], minZoomTier: isMajor ? 'regional' : 'city' };
    },
  },
  {
    label: 'Dams',
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
      return { id: makeId('dam', el), region: classifyRegion(coords.lat, coords.lng), class: 'dam', name, nameJa, lat: coords.lat, lng: coords.lng, tags: ['dam', ...(height > 0 ? [`height:${height}m`] : [])], minZoomTier: tier };
    },
  },
  {
    label: 'Telecom Infrastructure',
    filter: 'nwr["man_made"="communications_tower"];nwr["telecom"="data_center"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;
      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;
      const isDC = tags.telecom === 'data_center' || (nameJa || name).includes('データセンター');
      return { id: makeId('telecom', el), region: classifyRegion(coords.lat, coords.lng), class: 'telecom_hub', name, nameJa, lat: coords.lat, lng: coords.lng, tags: ['telecom', isDC ? 'datacenter' : 'tower'], minZoomTier: isDC ? 'regional' : 'city' };
    },
  },
  {
    label: 'Evacuation Shelters',
    filter: 'nwr["social_facility"="shelter"];nwr["emergency"="assembly_point"];nwr["amenity"="shelter"]["shelter_type"="flood"]',
    process(el) {
      const tags = el.tags || {};
      const coords = getCoords(el);
      if (!coords || !isInJapan(coords.lat, coords.lng)) return null;
      const { name, nameJa } = getName(tags);
      if (name === 'Unknown') return null;
      return { id: makeId('evac', el), region: classifyRegion(coords.lat, coords.lng), class: 'evacuation_site', name, nameJa, lat: coords.lat, lng: coords.lng, tags: ['shelter', 'evacuation'], minZoomTier: 'city' };
    },
  },
];

async function main() {
  // Load existing
  const existing: AssetRecord[] = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
  const existingIds = new Set(existing.map(a => a.id));
  console.log(`📦 Loaded ${existing.length} existing assets\n`);

  const newAssets: AssetRecord[] = [];

  for (let i = 0; i < MISSING.length; i++) {
    const cat = MISSING[i];
    console.log(`[${i+1}/${MISSING.length}] Fetching ${cat.label}...`);
    try {
      const elements = await queryOverpass(cat.filter);
      console.log(`  → ${elements.length} raw elements`);
      let count = 0;
      for (const el of elements) {
        const asset = cat.process(el);
        if (asset && !existingIds.has(asset.id)) {
          newAssets.push(asset);
          existingIds.add(asset.id);
          count++;
        }
      }
      console.log(`  → ${count} new assets\n`);
    } catch (err) {
      console.error(`  ✗ Failed: ${err}\n`);
    }
    if (i < MISSING.length - 1) {
      console.log(`  ⏳ Waiting ${DELAY_MS/1000}s...\n`);
      await sleep(DELAY_MS);
    }
  }

  // Merge and deduplicate
  const merged = [...existing, ...newAssets];
  // Dedup by proximity
  const seen = new Set<string>();
  const deduped: AssetRecord[] = [];
  for (const a of merged) {
    const key = `${a.class}:${(a.lat*100).toFixed(0)}:${(a.lng*100).toFixed(0)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(a);
  }

  // Sort
  const tierOrder: Record<string, number> = { national: 0, regional: 1, city: 2, district: 3 };
  deduped.sort((a, b) => (tierOrder[a.minZoomTier] ?? 3) - (tierOrder[b.minZoomTier] ?? 3) || a.class.localeCompare(b.class));

  writeFileSync(OUTPUT_PATH, JSON.stringify(deduped, null, 2), 'utf-8');
  console.log(`\n✅ Merged: ${existing.length} + ${newAssets.length} = ${deduped.length} total assets`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
