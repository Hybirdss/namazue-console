/**
 * Event Feed — Shared current-runtime earthquake fetch + normalization helpers.
 *
 * Used by the operator console and historical feed UI.
 */

import { classifyFaultType } from "./usgsApi";
import type { EarthquakeEvent, EarthquakeSource, FaultType } from "../types";
import type { GovernorPolicyEnvelope } from "../governor/types.ts";
import { API_BASE, R2_FEED_BASE } from "./config";

const JAPAN_BBOX = { minLat: 24, maxLat: 46, minLng: 122, maxLng: 150 };
const FETCH_TIMEOUT_MS = 5_000;

export interface ServerEventRecord {
	id: string;
	lat: number;
	lng: number;
	depth_km: number;
	magnitude: number;
	time: string | number;
	place: string | null;
	fault_type: string | null;
	source?: string | null;
	tsunami: boolean | null;
	maxi?: string | null;
	mt_strike?: number | null;
}

interface ServerEventsResponse {
	events: ServerEventRecord[];
	count: number;
	governor?: GovernorPolicyEnvelope;
}

interface USGSFeature {
	properties: { mag: number; place: string; time: number; tsunami: number };
	geometry: { coordinates: [number, number, number] };
	id: string;
}

interface USGSResponse {
	features: USGSFeature[];
}

interface R2EventsFeed {
	events: ServerEventRecord[];
	count: number;
	governor?: GovernorPolicyEnvelope;
	generated_at: number;
}

export interface FetchEventsResult {
	events: EarthquakeEvent[];
	source: "server" | "usgs";
	updatedAt: number;
	governor: GovernorPolicyEnvelope | null;
}

async function fetchWithTimeout<T>(url: string): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		return (await res.json()) as T;
	} finally {
		clearTimeout(timer);
	}
}

export function serverEventToEq(ev: ServerEventRecord): EarthquakeEvent | null {
	if (
		!Number.isFinite(ev.lat) ||
		!Number.isFinite(ev.lng) ||
		!Number.isFinite(ev.depth_km) ||
		!Number.isFinite(ev.magnitude)
	) {
		return null;
	}

	const parsedTime =
		typeof ev.time === "number" ? ev.time : Date.parse(ev.time);
	if (!Number.isFinite(parsedTime)) return null;

	const faultType: FaultType =
		ev.fault_type === "crustal" ||
		ev.fault_type === "interface" ||
		ev.fault_type === "intraslab"
			? ev.fault_type
			: classifyFaultType(ev.depth_km, ev.lat, ev.lng);

	const source: EarthquakeSource =
		ev.source === "jma" ||
		ev.source === "usgs" ||
		ev.source === "historical" ||
		ev.source === "scenario"
			? ev.source
			: "server";

	return {
		id: ev.id,
		lat: ev.lat,
		lng: ev.lng,
		depth_km: ev.depth_km,
		magnitude: ev.magnitude,
		time: parsedTime,
		source,
		faultType,
		tsunami: ev.tsunami === true,
		place: { text: ev.place ?? "Unknown location" },
		observedIntensity: ev.maxi ?? null,
		mtStrike: ev.mt_strike ?? null,
	};
}

function usgsFeatureToEq(feature: USGSFeature): EarthquakeEvent {
	const [lng, lat, depth] = feature.geometry.coordinates;
	return {
		id: feature.id,
		lat,
		lng,
		depth_km: Math.max(0, depth),
		magnitude: feature.properties.mag,
		time: feature.properties.time,
		source: "usgs",
		faultType: classifyFaultType(depth, lat, lng),
		tsunami: feature.properties.tsunami === 1,
		place: { text: feature.properties.place ?? "Unknown location" },
	};
}

async function fetchFromUsgs(): Promise<EarthquakeEvent[]> {
	const url =
		"https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson";
	const data = await fetchWithTimeout<USGSResponse>(url);
	if (!Array.isArray(data.features)) return [];

	return data.features
		.filter((feature) => {
			const [lng, lat] = feature.geometry.coordinates;
			return (
				lat >= JAPAN_BBOX.minLat &&
				lat <= JAPAN_BBOX.maxLat &&
				lng >= JAPAN_BBOX.minLng &&
				lng <= JAPAN_BBOX.maxLng
			);
		})
		.map(usgsFeatureToEq);
}

export async function fetchEventsWithMeta(): Promise<FetchEventsResult> {
	const updatedAt = Date.now();

	if (R2_FEED_BASE) {
		try {
			const data = await fetchWithTimeout<R2EventsFeed>(
				`${R2_FEED_BASE}/feed/events.json`,
			);
			if (Array.isArray(data.events) && data.events.length > 0) {
				return {
					events: data.events
						.map(serverEventToEq)
						.filter((event): event is EarthquakeEvent => event !== null),
					source: "server",
					updatedAt,
					governor: data.governor ?? null,
				};
			}
		} catch {
			// R2 unavailable, fall through to Worker API.
		}
	}

	if (API_BASE) {
		try {
			const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
			const url = `${API_BASE}/api/events?mag_min=2.5&lat_min=${JAPAN_BBOX.minLat}&lat_max=${JAPAN_BBOX.maxLat}&lng_min=${JAPAN_BBOX.minLng}&lng_max=${JAPAN_BBOX.maxLng}&limit=500&since=${since}`;
			const data = await fetchWithTimeout<ServerEventsResponse>(url);
			return {
				events: Array.isArray(data.events)
					? data.events
							.map(serverEventToEq)
							.filter((event): event is EarthquakeEvent => event !== null)
					: [],
				source: "server",
				updatedAt,
				governor: data.governor ?? null,
			};
		} catch {
			// Worker API unavailable, fall through to USGS.
		}
	}

	return {
		events: await fetchFromUsgs(),
		source: "usgs",
		updatedAt,
		governor: null,
	};
}

export async function fetchEventsByRange(
	sinceMs: number,
	untilMs?: number,
): Promise<FetchEventsResult> {
	const updatedAt = Date.now();

	if (!API_BASE) {
		const events = await fetchFromUsgs();
		return {
			events: events.filter(
				(event) => event.time >= sinceMs && (!untilMs || event.time <= untilMs),
			),
			source: "usgs",
			updatedAt,
			governor: null,
		};
	}

	try {
		const since = new Date(sinceMs).toISOString();
		const url = `${API_BASE}/api/events?mag_min=2.5&lat_min=${JAPAN_BBOX.minLat}&lat_max=${JAPAN_BBOX.maxLat}&lng_min=${JAPAN_BBOX.minLng}&lng_max=${JAPAN_BBOX.maxLng}&limit=500&since=${since}`;
		const data = await fetchWithTimeout<ServerEventsResponse>(url);

		if (!Array.isArray(data.events)) {
			return { events: [], source: "server", updatedAt, governor: null };
		}

		let events = data.events
			.map(serverEventToEq)
			.filter((event): event is EarthquakeEvent => event !== null);

		if (untilMs) {
			events = events.filter((event) => event.time <= untilMs);
		}

		return {
			events,
			source: "server",
			updatedAt,
			governor: data.governor ?? null,
		};
	} catch {
		const events = await fetchFromUsgs();
		return {
			events: events.filter(
				(event) => event.time >= sinceMs && (!untilMs || event.time <= untilMs),
			),
			source: "usgs",
			updatedAt,
			governor: null,
		};
	}
}
