/**
 * Similar Earthquake Search — PostGIS-powered
 *
 * Replaces client-side scoreSimilarity() with efficient DB queries.
 * Uses ST_DWithin for spatial filtering + composite scoring.
 */

import type { Database } from '../lib/db.ts';
import { sql } from 'drizzle-orm';

export interface SimilarEventRow {
  id: string;
  lat: number;
  lng: number;
  depth_km: number;
  magnitude: number;
  time: Date;
  place: string;
  distance_km: number;
}

/**
 * Find similar earthquakes using PostGIS spatial queries.
 *
 * Scoring (from AI.md §7-2):
 *   score = 100
 *     - haversine_km * 0.2        (200km → -40)
 *     - |depth_diff| * 0.3        (100km → -30)
 *     - |mag_diff| * 10           (M1 → -10)
 *     + same_zone bonus (+25)
 *     + same_mechanism bonus (+15)
 *     + same_depth_band bonus (+10)
 *
 * For now, uses SQL-based distance + sorting as approximation.
 * Full PostGIS ST_DWithin will be used once geom column is added.
 */
export async function findSimilarEvents(
  db: Database,
  event: { lat: number; lng: number; depth_km: number; magnitude: number; time: Date },
  limit: number = 8,
): Promise<SimilarEventRow[]> {
  // Indexed bbox prefilter for ~500km search radius.
  const latRadius = 4.6;
  const lngRadius = Math.max(
    4.6,
    4.6 / Math.max(0.2, Math.cos((event.lat * Math.PI) / 180)),
  );
  const boundedLimit = Math.min(20, Math.max(1, limit));
  const fetchLimit = Math.min(50, boundedLimit * 4);

  try {
    const result = await db.execute(sql`
      SELECT
        id,
        lat,
        lng,
        depth_km,
        magnitude,
        time,
        place,
        sqrt(power(lat - ${event.lat}, 2) + power(lng - ${event.lng}, 2)) * 111 AS distance_km,
        (
          abs(magnitude - ${event.magnitude}) * 10
          + abs(depth_km - ${event.depth_km}) * 0.3
          + sqrt(power(lat - ${event.lat}, 2) + power(lng - ${event.lng}, 2)) * 111 * 0.2
        ) AS similarity_cost
      FROM earthquakes
      WHERE time < ${event.time}
        AND magnitude BETWEEN ${event.magnitude - 1.5} AND ${event.magnitude + 1.5}
        AND lat BETWEEN ${event.lat - latRadius} AND ${event.lat + latRadius}
        AND lng BETWEEN ${event.lng - lngRadius} AND ${event.lng + lngRadius}
      ORDER BY similarity_cost ASC, time DESC
      LIMIT ${fetchLimit}
    `);

    const rows = result.rows as Array<Record<string, unknown>>;
    return rows
      .map((row) => {
        const timeVal = row.time instanceof Date ? row.time : new Date(String(row.time));
        return {
          id: String(row.id),
          lat: Number(row.lat),
          lng: Number(row.lng),
          depth_km: Number(row.depth_km),
          magnitude: Number(row.magnitude),
          time: timeVal,
          place: String(row.place ?? ''),
          distance_km: Math.round(Number(row.distance_km) * 10) / 10,
        };
      })
      .filter((row) => Number.isFinite(row.distance_km) && !Number.isNaN(row.time.getTime()))
      .slice(0, boundedLimit);
  } catch {
    // Graceful fallback for environments without SQL function/index support.
    return [];
  }
}
