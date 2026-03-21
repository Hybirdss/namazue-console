/**
 * Rail Status Manager — Polls /api/rail for live Shinkansen operation status.
 *
 * Fetches ODPT-normalized rail status from the worker API every 60s.
 * Updates consoleStore.railStatuses so the rail layer can color by
 * live operation status (normal/delayed/suspended) rather than just
 * earthquake impact inference.
 */

import type { RailLineStatus } from "../types";
import { API_BASE, R2_FEED_BASE } from "./config";

const POLL_INTERVAL_MS = 600_000; // 10min default, governor can shorten during incidents
const FETCH_TIMEOUT_MS = 8_000;

// R2 CDN feed URL — static snapshots, zero Worker invocations
const RAIL_R2_FEED = R2_FEED_BASE ? `${R2_FEED_BASE}/feed/rail.json` : "";

interface RailStatusResponse {
	lines: RailLineStatus[];
	source: string;
	updatedAt: number;
}

export interface RailStatusManager {
	start(): void;
	stop(): void;
}

export function createRailStatusManager(
	onUpdate: (statuses: RailLineStatus[]) => void,
): RailStatusManager {
	let timer: ReturnType<typeof setInterval> | null = null;

	async function fetch_(): Promise<void> {
		// Try R2 CDN feed first (zero Worker invocations)
		if (RAIL_R2_FEED) {
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
				const res = await fetch(RAIL_R2_FEED, { signal: controller.signal });
				clearTimeout(timeout);
				if (res.ok) {
					const data: RailStatusResponse = await res.json();
					if (Array.isArray(data.lines)) {
						onUpdate(data.lines);
						return;
					}
				}
			} catch {
				// R2 unavailable, fall through to Worker API
			}
		}

		// Fall back to Worker API
		if (!API_BASE) return;
		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
			const res = await fetch(`${API_BASE}/api/rail`, {
				signal: controller.signal,
			});
			clearTimeout(timeout);
			if (!res.ok) return;
			const data: RailStatusResponse = await res.json();
			if (Array.isArray(data.lines)) {
				onUpdate(data.lines);
			}
		} catch {
			// Non-critical — rail status is supplementary
		}
	}

	return {
		start() {
			fetch_();
			timer = setInterval(fetch_, POLL_INTERVAL_MS);
		},
		stop() {
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
		},
	};
}
