// Shared constants, types, and utilities used across cron sub-modules.

export const CHUNK_SIZE = 10;

// Dedup: if an event within ±5min, ±0.3°, ±0.5M exists, skip it
export const DEDUP_TIME_MS = 5 * 60 * 1000;
export const DEDUP_DEG = 0.3;
export const DEDUP_MAG = 0.5;

export const GOVERNOR_LOOKBACK_MS = 6 * 60 * 60 * 1000;
export const EVENTS_PROJECTION_STALE_AFTER_MS = 90_000;
export const GOVERNOR_PROJECTION_STALE_AFTER_MS = 90_000;
export const MARITIME_PROJECTION_STALE_AFTER_MS = 300_000;
export const RAIL_PROJECTION_STALE_AFTER_MS = 300_000;

export const FEED_EVENTS_LIMIT = 500;
export const FEED_EVENTS_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export interface SourcePollResult {
  ingested: number;
  analyzed: number;
  revised: number;
  persisted: boolean;
  /** IDs of genuinely new events (for IndexNow submission). */
  newEventIds?: string[];
}

// ─── JMA Fingerprinting ───────────────────────────────────
// Hash sorted event IDs into a compact fingerprint.
// If fingerprint matches KV cache → JMA feed is unchanged → skip DB entirely.

export function computeFingerprint(events: Array<{ id: string; magnitude: number }>): string {
  // Include both IDs and magnitudes to detect revisions (e.g., M4.2 → M4.5)
  const sorted = events
    .map(e => `${e.id}:${e.magnitude}`)
    .sort()
    .join('|');
  // Simple hash — we don't need cryptographic strength, just change detection.
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const ch = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash.toString(36);
}
