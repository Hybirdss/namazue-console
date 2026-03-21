/**
 * ingest-historical-usgs.ts — Ingest USGS earthquake catalog 1900-1993 into Neon
 *
 * Fetches the full USGS FDSNWS earthquake catalog for 1900-1993 (M4.5+, worldwide),
 * and inserts into the Neon `earthquakes` table. This complements the existing
 * catalog which covers 1994-present.
 *
 * Strategy:
 *   - Yearly chunks to stay under USGS 20,000 event limit per request
 *   - Years with > 20K events are split into half-year chunks automatically
 *   - ON CONFLICT (id) DO NOTHING for safe re-runs
 *   - Batch INSERTs (100 rows per batch) for throughput
 *   - 2s delay between API requests to respect USGS rate limits
 *
 * Usage:
 *   DATABASE_URL=... npx tsx tools/ingest-historical-usgs.ts
 *
 * Options (env):
 *   START_YEAR  — first year to ingest (default: 1900)
 *   END_YEAR    — last year to ingest, inclusive (default: 1993)
 *   MIN_MAG     — minimum magnitude (default: 4.5)
 *   DRY_RUN     — set "true" to fetch but not insert
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

// ── Config ────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL required in .env');

const sql = neon(DATABASE_URL);

const START_YEAR = parseInt(process.env.START_YEAR ?? '1900', 10);
const END_YEAR = parseInt(process.env.END_YEAR ?? '1993', 10);
const MIN_MAG = parseFloat(process.env.MIN_MAG ?? '4.5');
const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 100; // rows per INSERT batch
const REQUEST_DELAY_MS = 2000; // polite delay between API requests
const LIMIT_PER_REQUEST = 20000;
const REQUEST_TIMEOUT_MS = 60_000; // 60s timeout per request

const USGS_BASE_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

// ── Types ─────────────────────────────────────────────────────────

interface USGSFeature {
  type: 'Feature';
  id: string;
  properties: {
    mag: number | null;
    place: string | null;
    time: number; // epoch ms
    tsunami: number; // 0 or 1
    magType: string | null; // Mw, mb, ML, etc.
    type: string; // "earthquake"
    status: string; // "automatic" | "reviewed"
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [lng, lat, depth_km]
  };
}

interface USGSResponse {
  type: 'FeatureCollection';
  metadata: {
    count: number;
    title: string;
  };
  features: USGSFeature[];
}

type FaultType = 'crustal' | 'interface' | 'intraslab';

interface EarthquakeRow {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  mag_type: string | null;
  time: string; // ISO 8601
  place: string | null;
  fault_type: FaultType;
  source: string;
  tsunami: boolean;
  data_status: string;
}

// ── Fault type classification ─────────────────────────────────────
// Same logic as build-historical-catalog.ts / usgsApi.ts

const PLATE_BOUNDARY_SEGMENTS = [
  { latMin: 34, latMax: 42, lngMin: 140, lngMax: 146 }, // Japan Trench
  { latMin: 30, latMax: 35, lngMin: 131, lngMax: 140 }, // Nankai Trough
  { latMin: 33, latMax: 36, lngMin: 138, lngMax: 142 }, // Sagami Trough
  { latMin: 24, latMax: 31, lngMin: 125, lngMax: 132 }, // Ryukyu Trench
  { latMin: 42, latMax: 46, lngMin: 144, lngMax: 150 }, // Kuril-Kamchatka
  // Global major subduction zones
  { latMin: -60, latMax: 20, lngMin: -82, lngMax: -68 }, // South America (Nazca)
  { latMin: 8, latMax: 20, lngMin: -105, lngMax: -92 },  // Central America
  { latMin: 50, latMax: 62, lngMin: -170, lngMax: -140 }, // Alaska-Aleutian
  { latMin: 0, latMax: 12, lngMin: 92, lngMax: 100 },     // Sumatra
  { latMin: -11, latMax: 0, lngMin: 104, lngMax: 140 },   // Java-Banda
  { latMin: 5, latMax: 20, lngMin: 119, lngMax: 128 },    // Philippines
  { latMin: -50, latMax: -35, lngMin: 165, lngMax: 180 },  // New Zealand
  { latMin: -25, latMax: -5, lngMin: 165, lngMax: 175 },   // Vanuatu-Tonga
];

function isNearPlateBoundary(lat: number, lng: number): boolean {
  return PLATE_BOUNDARY_SEGMENTS.some(
    (seg) =>
      lat >= seg.latMin && lat <= seg.latMax &&
      lng >= seg.lngMin && lng <= seg.lngMax,
  );
}

function classifyFaultType(depthKm: number, lat: number, lng: number): FaultType {
  if (depthKm > 60) return 'intraslab';
  if (depthKm <= 60 && isNearPlateBoundary(lat, lng)) return 'interface';
  return 'crustal';
}

// ── Helpers ───────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function featureToRow(f: USGSFeature): EarthquakeRow | null {
  const [lng, lat, depthRaw] = f.geometry.coordinates;
  const mag = f.properties.mag;

  // Skip features with missing critical data
  if (mag === null || mag === undefined || isNaN(mag)) return null;
  if (lat === undefined || lng === undefined) return null;

  const depth = Math.max(0, depthRaw ?? 0); // some old events have negative depth

  return {
    id: f.id,
    lat: parseFloat(lat.toFixed(4)),
    lng: parseFloat(lng.toFixed(4)),
    depth_km: parseFloat(depth.toFixed(1)),
    magnitude: parseFloat(mag.toFixed(1)),
    mag_type: f.properties.magType ?? null,
    time: new Date(f.properties.time).toISOString(),
    place: f.properties.place ?? null,
    fault_type: classifyFaultType(depth, lat, lng),
    source: 'usgs',
    tsunami: f.properties.tsunami === 1,
    data_status: f.properties.status === 'reviewed' ? 'reviewed' : 'automatic',
  };
}

// ── USGS API fetching ─────────────────────────────────────────────

interface TimeRange {
  starttime: string;
  endtime: string;
  label: string;
}

function buildTimeRanges(year: number): TimeRange[] {
  // Start with a full year; if we hit the limit, caller will split
  return [{
    starttime: `${year}-01-01`,
    endtime: `${year + 1}-01-01`,
    label: `${year}`,
  }];
}

function splitHalfYear(year: number): TimeRange[] {
  return [
    {
      starttime: `${year}-01-01`,
      endtime: `${year}-07-01`,
      label: `${year} H1`,
    },
    {
      starttime: `${year}-07-01`,
      endtime: `${year + 1}-01-01`,
      label: `${year} H2`,
    },
  ];
}

function splitQuarters(year: number): TimeRange[] {
  return [
    { starttime: `${year}-01-01`, endtime: `${year}-04-01`, label: `${year} Q1` },
    { starttime: `${year}-04-01`, endtime: `${year}-07-01`, label: `${year} Q2` },
    { starttime: `${year}-07-01`, endtime: `${year}-10-01`, label: `${year} Q3` },
    { starttime: `${year}-10-01`, endtime: `${year + 1}-01-01`, label: `${year} Q4` },
  ];
}

async function fetchRange(range: TimeRange): Promise<USGSFeature[]> {
  const params = new URLSearchParams({
    format: 'geojson',
    starttime: range.starttime,
    endtime: range.endtime,
    minmagnitude: String(MIN_MAG),
    limit: String(LIMIT_PER_REQUEST),
    orderby: 'time',
  });

  const url = `${USGS_BASE_URL}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const resp = await fetch(url, { signal: controller.signal });

    if (resp.status === 429) {
      console.warn(`    [rate-limited] Waiting 30s before retry...`);
      await sleep(30_000);
      clearTimeout(timer);
      return fetchRange(range); // retry once
    }

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
    }

    const data: USGSResponse = await resp.json();
    return data.features;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.error(`    [timeout] ${range.label}: request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    } else {
      console.error(`    [error] ${range.label}:`, (err as Error).message);
    }
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYear(year: number): Promise<USGSFeature[]> {
  // Try full year first
  const ranges = buildTimeRanges(year);
  const features = await fetchRange(ranges[0]);

  // If we hit the limit, split into halves
  if (features.length >= LIMIT_PER_REQUEST) {
    console.warn(`    [split] ${year}: hit ${LIMIT_PER_REQUEST} limit, splitting into half-years`);
    await sleep(REQUEST_DELAY_MS);

    const halfRanges = splitHalfYear(year);
    let allFeatures: USGSFeature[] = [];

    for (const hr of halfRanges) {
      const hf = await fetchRange(hr);

      // If a half still hits the limit, split into quarters
      if (hf.length >= LIMIT_PER_REQUEST) {
        console.warn(`    [split] ${hr.label}: still hitting limit, splitting into quarters`);
        await sleep(REQUEST_DELAY_MS);

        const quarterRanges = hr.label.includes('H1')
          ? splitQuarters(year).slice(0, 2)
          : splitQuarters(year).slice(2, 4);

        for (const qr of quarterRanges) {
          const qf = await fetchRange(qr);
          console.log(`      ${qr.label}: ${qf.length} events`);
          allFeatures.push(...qf);
          await sleep(REQUEST_DELAY_MS);
        }
      } else {
        console.log(`      ${hr.label}: ${hf.length} events`);
        allFeatures.push(...hf);
      }

      await sleep(REQUEST_DELAY_MS);
    }

    return allFeatures;
  }

  return features;
}

// ── Database insertion ────────────────────────────────────────────

async function insertBatch(rows: EarthquakeRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  // Build a multi-row INSERT using neon tagged templates.
  // Since neon() doesn't support multi-row VALUES in a single tagged template
  // cleanly, we insert one-by-one within a conceptual batch and use
  // ON CONFLICT DO NOTHING for idempotency.
  let inserted = 0;

  for (const row of rows) {
    try {
      const result = await sql`
        INSERT INTO earthquakes (
          id, lat, lng, depth_km, magnitude, mag_type,
          time, place, fault_type, source, tsunami, data_status, updated_at
        ) VALUES (
          ${row.id},
          ${row.lat},
          ${row.lng},
          ${row.depth_km},
          ${row.magnitude},
          ${row.mag_type},
          ${row.time}::timestamptz,
          ${row.place},
          ${row.fault_type},
          ${row.source},
          ${row.tsunami},
          ${row.data_status},
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `;
      // neon returns empty array for INSERT with no RETURNING, but doesn't throw on conflict
      inserted++;
    } catch (err) {
      // Log but continue — don't let one bad row kill the batch
      console.error(`      [insert-error] ${row.id}:`, (err as Error).message?.slice(0, 120));
    }
  }

  return inserted;
}

// ── Main ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== USGS Historical Earthquake Ingestion ===');
  console.log(`  Range: ${START_YEAR}-${END_YEAR} (inclusive)`);
  console.log(`  Min magnitude: M${MIN_MAG}`);
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log('');

  // Verify DB connection
  const connTest = await sql`SELECT NOW() as now`;
  console.log(`  DB connected: ${connTest[0].now}`);

  // Check existing count
  const existing = await sql`SELECT COUNT(*) as count FROM earthquakes`;
  console.log(`  Existing earthquakes: ${existing[0].count}`);

  // Check how many historical events we already have
  const historicalExisting = await sql`
    SELECT COUNT(*) as count FROM earthquakes
    WHERE time < '1994-01-01'::timestamptz
  `;
  console.log(`  Pre-1994 earthquakes already in DB: ${historicalExisting[0].count}`);
  console.log('');

  let totalFetched = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  const startTime = Date.now();

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    const yearStart = Date.now();
    process.stdout.write(`  [${year}] Fetching... `);

    const features = await fetchYear(year);
    const rows = features
      .map(featureToRow)
      .filter((r): r is EarthquakeRow => r !== null);

    const fetched = rows.length;
    totalFetched += fetched;

    process.stdout.write(`${fetched} events. `);

    if (DRY_RUN) {
      console.log('(dry run, skipping insert)');
    } else {
      // Insert in batches
      let yearInserted = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const count = await insertBatch(batch);
        yearInserted += count;
      }

      // Count actual new rows vs skipped (conflicts)
      // Since neon doesn't return affected row count easily with ON CONFLICT DO NOTHING,
      // we track attempts. The inserted count from insertBatch is attempts (not actual new rows),
      // so we check post-hoc.
      totalInserted += yearInserted;

      const elapsed = ((Date.now() - yearStart) / 1000).toFixed(1);
      console.log(`Inserted batch of ${yearInserted}. (${elapsed}s)`);
    }

    // Polite delay between years
    if (year < END_YEAR) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const totalElapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('');
  console.log('=== Summary ===');
  console.log(`  Years processed: ${END_YEAR - START_YEAR + 1}`);
  console.log(`  Events fetched:  ${totalFetched}`);
  console.log(`  Insert attempts: ${totalInserted}`);
  console.log(`  Total time:      ${totalElapsed} min`);

  // Final count
  if (!DRY_RUN) {
    const finalCount = await sql`SELECT COUNT(*) as count FROM earthquakes`;
    const finalHistorical = await sql`
      SELECT COUNT(*) as count FROM earthquakes
      WHERE time < '1994-01-01'::timestamptz
    `;
    console.log(`  DB total now:    ${finalCount[0].count}`);
    console.log(`  Pre-1994 total:  ${finalHistorical[0].count}`);

    // Magnitude distribution for ingested range
    const magDist = await sql`
      SELECT
        CASE
          WHEN magnitude >= 8 THEN 'M8+'
          WHEN magnitude >= 7 THEN 'M7-7.9'
          WHEN magnitude >= 6 THEN 'M6-6.9'
          WHEN magnitude >= 5 THEN 'M5-5.9'
          ELSE 'M4.5-4.9'
        END as range,
        COUNT(*) as count
      FROM earthquakes
      WHERE time < '1994-01-01'::timestamptz
      GROUP BY 1
      ORDER BY 1 DESC
    `;
    console.log('\n  Magnitude distribution (pre-1994):');
    for (const row of magDist) {
      console.log(`    ${row.range}: ${row.count}`);
    }
  }

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
