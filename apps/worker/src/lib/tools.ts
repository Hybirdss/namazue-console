/**
 * AI Chat Tools — Tool definitions and execution for Grok tool calling.
 *
 * 5 tools:
 * - search_earthquakes: DB search (mag, depth, region, time)
 * - get_analysis: Fetch AI analysis for a specific earthquake
 * - compare_earthquakes: Compare 2-5 earthquakes
 * - get_report: Fetch weekly/monthly reports
 * - visualize_on_globe: Client-side pass-through (fly_to, highlight_events)
 */

import { createDb } from './db.ts';
import { earthquakes } from '@namazue/db';
import { gte, lte, and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { Env } from '../index.ts';

// ── Tool Definitions (OpenAI-compatible format) ──

export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_earthquakes',
      description: 'Search the earthquake database with filters. Returns up to 20 matching events.',
      parameters: {
        type: 'object',
        properties: {
          mag_min: { type: 'number', description: 'Minimum magnitude' },
          mag_max: { type: 'number', description: 'Maximum magnitude' },
          depth_min: { type: 'number', description: 'Minimum depth in km' },
          depth_max: { type: 'number', description: 'Maximum depth in km' },
          region: { type: 'string', description: 'Region name to search (e.g., "tohoku", "nankai", "kanto")' },
          relative: { type: 'string', enum: ['24h', '7d', '30d', '1yr', 'all'], description: 'Time range relative to now' },
          query: { type: 'string', description: 'Free-text search in place names' },
          limit: { type: 'number', description: 'Max results (1-20, default 10)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_earthquakes',
      description: 'Compare 2-5 earthquakes by their event IDs. Returns key metrics side by side.',
      parameters: {
        type: 'object',
        properties: {
          event_ids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 5,
            description: 'Array of USGS event IDs to compare',
          },
        },
        required: ['event_ids'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_report',
      description: 'Get a summary report of recent seismic activity.',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['24h', '7d', '30d'], description: 'Report period' },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'visualize_on_globe',
      description: 'Control the 3D globe visualization. Use this to highlight events or fly to locations.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['fly_to', 'highlight_events', 'show_intensity'],
            description: 'Visualization action',
          },
          lat: { type: 'number', description: 'Latitude for fly_to' },
          lng: { type: 'number', description: 'Longitude for fly_to' },
          event_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Event IDs to highlight',
          },
        },
        required: ['action'],
      },
    },
  },
];

// ── Tool Execution ──

export interface ToolResult {
  name: string;
  result: unknown;
}

export async function executeTool(
  env: Env,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case 'search_earthquakes':
      return { name, result: await toolSearchEarthquakes(env, args) };
    case 'compare_earthquakes':
      return { name, result: await toolCompareEarthquakes(env, args) };
    case 'get_report':
      return { name, result: await toolGetReport(env, args) };
    case 'visualize_on_globe': {
      // Sanitize LLM-generated args before returning to client
      const clampCoord = (v: unknown, min: number, max: number) =>
        typeof v === 'number' && isFinite(v) ? Math.max(min, Math.min(max, v)) : undefined;
      const safeEventIds = Array.isArray(args.event_ids)
        ? (args.event_ids as unknown[])
            .filter((id): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(id))
            .slice(0, 20)
        : undefined;
      return {
        name,
        result: {
          action: ['fly_to', 'highlight_events', 'show_intensity'].includes(String(args.action))
            ? String(args.action) : 'highlight_events',
          lat: clampCoord(args.lat, -90, 90),
          lng: clampCoord(args.lng, -180, 180),
          event_ids: safeEventIds,
        },
      };
    }
    default:
      return { name, result: { error: 'Tool not available' } };
  }
}

// ── Tool Implementations ──

async function toolSearchEarthquakes(
  env: Env,
  args: Record<string, unknown>,
): Promise<unknown> {
  const db = createDb(env.DATABASE_URL);
  const conditions: SQL[] = [];

  const clamp = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && isFinite(v) ? Math.max(min, Math.min(max, v)) : undefined;
  const magMin = clamp(args.mag_min, -2, 12);
  const magMax = clamp(args.mag_max, -2, 12);
  const depthMin = clamp(args.depth_min, -10, 800);
  const depthMax = clamp(args.depth_max, -10, 800);
  const region = typeof args.region === 'string' ? args.region.slice(0, 120) : undefined;
  const query = typeof args.query === 'string' ? args.query.slice(0, 120) : undefined;
  const relative = typeof args.relative === 'string' ? args.relative : undefined;
  const limit = Math.min(Math.max(typeof args.limit === 'number' ? args.limit : 10, 1), 20);

  if (magMin !== undefined) conditions.push(gte(earthquakes.magnitude, magMin));
  if (magMax !== undefined) conditions.push(lte(earthquakes.magnitude, magMax));
  if (depthMin !== undefined) conditions.push(gte(earthquakes.depth_km, depthMin));
  if (depthMax !== undefined) conditions.push(lte(earthquakes.depth_km, depthMax));

  if (region) {
    const pattern = `%${escapeLike(region)}%`;
    conditions.push(or(
      ilike(earthquakes.place, pattern),
      ilike(earthquakes.place_ja, pattern),
    )!);
  }

  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    conditions.push(or(
      ilike(earthquakes.place, pattern),
      ilike(earthquakes.place_ja, pattern),
    )!);
  }

  if (relative) {
    const now = Date.now();
    const ranges: Record<string, number> = {
      '24h': 86_400_000,
      '7d': 7 * 86_400_000,
      '30d': 30 * 86_400_000,
      '1yr': 365 * 86_400_000,
    };
    if (ranges[relative]) {
      conditions.push(gte(earthquakes.time, new Date(now - ranges[relative])));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db.select({
    id: earthquakes.id,
    lat: earthquakes.lat,
    lng: earthquakes.lng,
    depth_km: earthquakes.depth_km,
    magnitude: earthquakes.magnitude,
    time: earthquakes.time,
    place: earthquakes.place,
    fault_type: earthquakes.fault_type,
    tsunami: earthquakes.tsunami,
  })
    .from(earthquakes)
    .where(where)
    .orderBy(desc(earthquakes.magnitude))
    .limit(limit);

  return rows;
}

async function toolCompareEarthquakes(
  env: Env,
  args: Record<string, unknown>,
): Promise<unknown> {
  const eventIds = Array.isArray(args.event_ids)
    ? (args.event_ids as string[])
        .filter((id): id is string => typeof id === 'string' && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id))
        .slice(0, 5)
    : [];

  if (eventIds.length < 2) return { error: 'Need at least 2 valid event IDs' };

  const db = createDb(env.DATABASE_URL);
  const results = [];

  for (const id of eventIds) {
    const rows = await db.select({
      id: earthquakes.id,
      lat: earthquakes.lat,
      lng: earthquakes.lng,
      depth_km: earthquakes.depth_km,
      magnitude: earthquakes.magnitude,
      time: earthquakes.time,
      place: earthquakes.place,
      fault_type: earthquakes.fault_type,
      tsunami: earthquakes.tsunami,
    })
      .from(earthquakes)
      .where(eq(earthquakes.id, id))
      .limit(1);

    if (rows.length > 0) results.push(rows[0]);
  }

  return { events: results, count: results.length };
}

async function toolGetReport(
  env: Env,
  args: Record<string, unknown>,
): Promise<unknown> {
  const period = typeof args.period === 'string' ? args.period : '7d';
  const now = Date.now();
  const ranges: Record<string, number> = {
    '24h': 86_400_000,
    '7d': 7 * 86_400_000,
    '30d': 30 * 86_400_000,
  };

  const cutoff = new Date(now - (ranges[period] || ranges['7d']));
  const db = createDb(env.DATABASE_URL);

  const rows = await db.select({
    id: earthquakes.id,
    magnitude: earthquakes.magnitude,
    depth_km: earthquakes.depth_km,
    place: earthquakes.place,
    time: earthquakes.time,
    fault_type: earthquakes.fault_type,
    tsunami: earthquakes.tsunami,
  })
    .from(earthquakes)
    .where(gte(earthquakes.time, cutoff))
    .orderBy(desc(earthquakes.magnitude))
    .limit(50);

  const totalCount = rows.length;
  const maxMag = rows.length > 0 ? Math.max(...rows.map(r => r.magnitude)) : 0;
  const avgMag = rows.length > 0 ? rows.reduce((s, r) => s + r.magnitude, 0) / rows.length : 0;
  const tsunamiCount = rows.filter(r => r.tsunami).length;

  return {
    period,
    total_events: totalCount,
    max_magnitude: maxMag,
    avg_magnitude: Number(avgMag.toFixed(1)),
    tsunami_events: tsunamiCount,
    top_events: rows.slice(0, 5),
  };
}

/**
 * Escape LIKE wildcard characters so literal %/_ in user input
 * are not treated as patterns.
 */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, (m) => `\\${m}`);
}
