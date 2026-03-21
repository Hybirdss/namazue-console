/**
 * EarthquakeContext Builder — Pure Function
 *
 * Takes pre-queried data (from DB, static files, APIs) and assembles
 * the EarthquakeContext object for Claude.
 *
 * This function has ZERO side effects: no DB queries, no API calls, no I/O.
 * All data must be provided via BuilderInput.
 */

import type { BuilderInput, EarthquakeContext, TectonicContext } from '@namazue/db';
import { computeOmoriStats } from './omori.ts';
import { assessTsunamiRisk } from './tsunami.ts';

interface VolcanoReference {
  name: string;
  lat: number;
  lng: number;
  alert_level: number;
}

interface GlobalAnalogSeed {
  name: string;
  mag: number;
  depth: number;
  mechanism: string;
  keywords: readonly string[];
  why_similar: string;
  outcome_summary: string;
}

const JAPAN_VOLCANOES: VolcanoReference[] = [
  { name: 'Sakurajima', lat: 31.593, lng: 130.657, alert_level: 3 },
  { name: 'Aso', lat: 32.884, lng: 131.104, alert_level: 2 },
  { name: 'Kirishima', lat: 31.934, lng: 130.862, alert_level: 2 },
  { name: 'Fuji', lat: 35.3606, lng: 138.7274, alert_level: 1 },
  { name: 'Asama', lat: 36.406, lng: 138.523, alert_level: 1 },
  { name: 'Hakone', lat: 35.233, lng: 139.021, alert_level: 1 },
  { name: 'Kusatsu-Shirane', lat: 36.62, lng: 138.53, alert_level: 1 },
  { name: 'Ontake', lat: 35.893, lng: 137.48, alert_level: 1 },
  { name: 'Unzen', lat: 32.761, lng: 130.298, alert_level: 2 },
  { name: 'Suwanosejima', lat: 29.638, lng: 129.714, alert_level: 2 },
  { name: 'Usu', lat: 42.544, lng: 140.839, alert_level: 1 },
  { name: 'Tarumae', lat: 42.688, lng: 141.379, alert_level: 1 },
  { name: 'Tokachidake', lat: 43.418, lng: 142.686, alert_level: 1 },
];

const GLOBAL_ANALOGS: GlobalAnalogSeed[] = [
  {
    name: '2011 Tohoku, Japan',
    mag: 9.0,
    depth: 29,
    mechanism: 'subduction_interface',
    keywords: ['subduction_interface', 'intraslab'],
    why_similar: 'Large offshore subduction rupture with broad regional exposure.',
    outcome_summary: 'Generated extreme shaking and basin-wide tsunami with prolonged infrastructure disruption.',
  },
  {
    name: '2010 Maule, Chile',
    mag: 8.8,
    depth: 35,
    mechanism: 'subduction_interface',
    keywords: ['subduction_interface'],
    why_similar: 'Megathrust geometry and depth range comparable to Pacific-margin interface events.',
    outcome_summary: 'Major coastal damage, tsunami impacts, and long-duration restoration of lifelines.',
  },
  {
    name: '1964 Alaska, USA',
    mag: 9.2,
    depth: 25,
    mechanism: 'subduction_interface',
    keywords: ['subduction_interface'],
    why_similar: 'Very large interface rupture with cascading infrastructure effects.',
    outcome_summary: 'Severe ground failure and tsunami losses across ports and coastal settlements.',
  },
  {
    name: '1995 Kobe, Japan',
    mag: 6.9,
    depth: 16,
    mechanism: 'intraplate_shallow',
    keywords: ['intraplate_shallow', 'crustal'],
    why_similar: 'Shallow inland crustal rupture pattern relevant to urban corridor risk.',
    outcome_summary: 'Concentrated building collapse and transport-network interruption in dense city districts.',
  },
  {
    name: '1994 Northridge, USA',
    mag: 6.7,
    depth: 18,
    mechanism: 'intraplate_shallow',
    keywords: ['intraplate_shallow', 'crustal'],
    why_similar: 'Urban shallow event with strong local amplification effects.',
    outcome_summary: 'High direct losses and prolonged disruption to roads, utilities, and hospitals.',
  },
  {
    name: '2016 Kumamoto, Japan',
    mag: 7.0,
    depth: 10,
    mechanism: 'strike_slip',
    keywords: ['intraplate_shallow', 'crustal', 'transform'],
    why_similar: 'Active-fault inland sequence with repeated strong shaking.',
    outcome_summary: 'Serial mainshock-aftershock damage pattern and widespread slope failures.',
  },
  {
    name: '2004 Sumatra-Andaman',
    mag: 9.1,
    depth: 30,
    mechanism: 'subduction_interface',
    keywords: ['subduction_interface'],
    why_similar: 'Very large subduction rupture with tsunami-dominant hazard profile.',
    outcome_summary: 'Catastrophic trans-oceanic tsunami and long-horizon humanitarian response.',
  },
];

export function buildContext(input: BuilderInput): EarthquakeContext {
  const { event, tier } = input;

  // ── Basic ──
  const basic = {
    id: event.id,
    mag: event.magnitude,
    depth_km: event.depth_km,
    lat: event.lat,
    lon: event.lng,
    time: event.time.toISOString(),
    place_ja: event.place_ja ?? event.place ?? '',
    place_en: event.place ?? '',
    mag_type: (event.mag_type ?? 'mw') as 'mw' | 'mb' | 'ml',
  };

  // ── Tectonic ──
  const tectonic: TectonicContext = {
    plate: classifyPlate(event.lat, event.lng),
    boundary_type: classifyBoundary(event.fault_type, event.depth_km),
    slab2: input.slab2 ?? { depth_at_point: null, distance_to_slab: null, dip_angle: null },
    nearest_trench: findNearestTrench(event.lat, event.lng),
    nearest_active_fault: input.nearest_faults?.[0] ? {
      name: input.nearest_faults[0].name_en ?? '',
      name_ja: input.nearest_faults[0].name_ja ?? '',
      distance_km: input.nearest_faults[0].distance_km,
      expected_max_mag: input.nearest_faults[0].estimated_mw,
      fault_type: input.nearest_faults[0].fault_type,
      last_activity: input.nearest_faults[0].last_activity,
      recurrence_years: input.nearest_faults[0].recurrence_years,
      prob_30yr: input.nearest_faults[0].probability_30yr?.toString() ?? null,
    } : null,
    nearest_volcano: findNearestVolcano(event.lat, event.lng),
    vs30: input.vs30 ?? 400,
    soil_class: input.soil_class ?? 'stiff',
  };

  // ── B-tier returns minimal context ──
  if (tier === 'B') {
    return {
      basic,
      tectonic,
      mechanism: null,
      spatial: buildEmptySpatial(),
      impact: null,
      aftershock_stats: null,
      similar_past: [],
      global_analogs: null,
    };
  }

  // ── Mechanism (M5+ only) ──
  const mechanism = input.moment_tensor ?? null;

  // ── Spatial ──
  const spatial = buildEmptySpatial();
  if (input.spatial_stats) {
    spatial.nearby_30yr_stats = input.spatial_stats;
  }

  // ── Aftershock (M5+) ──
  const aftershock_stats = event.magnitude >= 5
    ? computeOmoriStats(event.magnitude)
    : null;

  // ── Similar past ──
  const similar_past = input.similar_events ?? [];

  // ── Tsunami ──
  const tsunami_risk = assessTsunamiRisk(
    event.magnitude, event.depth_km, event.fault_type, event.lat, event.lng,
    event.place, event.place_ja, event.tsunami,
  );

  // ── Impact ──
  const impact = event.magnitude >= 5 ? {
    max_intensity: { value: 0, scale: 'JMA' as const, source: 'gmpe' as const },
    city_intensities: [],
    population_exposure: {
      intensity_6plus: 0,
      intensity_5plus: 0,
      intensity_4plus: 0,
      total_felt: 0,
    },
    tsunami: tsunami_risk,
    landslide: null,
  } : null;

  return {
    basic,
    tectonic,
    mechanism,
    spatial,
    impact,
    aftershock_stats,
    similar_past,
    global_analogs: tier === 'S'
      ? buildGlobalAnalogs(event.magnitude, event.depth_km, tectonic.boundary_type)
      : null,
  };
}

// ── Helpers ──

function classifyPlate(lat: number, lng: number): TectonicContext['plate'] {
  // Non-Japan region
  if (lat < 20 || lat > 50 || lng < 120 || lng > 155) return 'other';
  // Simplified: East of Japan trench → Pacific plate
  if (lng > 144 && lat > 30) return 'pacific';
  if (lng > 136 && lat < 34) return 'philippine';
  if (lat > 36) return 'north_american';
  return 'eurasian';
}

function classifyBoundary(
  faultType?: string, depth?: number,
): TectonicContext['boundary_type'] {
  if (faultType === 'interface') return 'subduction_interface';
  if (faultType === 'intraslab') return 'intraslab';
  if (faultType === 'crustal') {
    return (depth ?? 0) > 30 ? 'intraplate_deep' : 'intraplate_shallow';
  }
  return 'unknown';
}

function findNearestTrench(lat: number, lng: number) {
  // Japan-only trench classification — not meaningful for global events
  if (lat < 20 || lat > 50 || lng < 120 || lng > 155) {
    return { name: 'Outside Japan region', distance_km: -1 };
  }

  const trenches = [
    { name: 'Japan Trench', lat: 38, lng: 144 },
    { name: 'Nankai Trough', lat: 33, lng: 135 },
    { name: 'Ryukyu Trench', lat: 27, lng: 128 },
    { name: 'Izu-Bonin Trench', lat: 30, lng: 142 },
  ];

  let nearest = trenches[0];
  let minDist = Infinity;

  for (const t of trenches) {
    const d = Math.sqrt((lat - t.lat) ** 2 + (lng - t.lng) ** 2) * 111;
    if (d < minDist) {
      minDist = d;
      nearest = t;
    }
  }

  return { name: nearest.name, distance_km: Math.round(minDist) };
}

function buildEmptySpatial() {
  return {
    nearby_30yr_stats: {
      total: 0,
      by_mag: { m4: 0, m5: 0, m6: 0, m7plus: 0 },
      by_depth: { shallow_0_30: 0, mid_30_70: 0, intermediate_70_300: 0, deep_300_700: 0 },
      largest: { mag: 0, date: '', place: '', id: '' },
      avg_per_year: 0,
    },
    preceding_30d: {
      count: 0,
      events: [],
      rate_vs_avg: 1.0,
      trend: 'stable' as const,
    },
    recurrence: {
      events: [],
      avg_interval_years: null,
      years_since_last_m5: 0,
      years_since_last_m6: 0,
    },
    seismic_gap: {
      is_gap: false,
      last_significant: null,
      years_quiet: 0,
      expected_m6_rate: 0,
    },
  };
}

function findNearestVolcano(
  lat: number,
  lng: number,
): TectonicContext['nearest_volcano'] {
  // Use volcano context only for Japan operational footprint.
  if (lat < 20 || lat > 50 || lng < 120 || lng > 155) return null;
  let nearest: VolcanoReference | null = null;
  let minDist = Infinity;
  for (const volcano of JAPAN_VOLCANOES) {
    const d = haversineKm(lat, lng, volcano.lat, volcano.lng);
    if (d < minDist) {
      minDist = d;
      nearest = volcano;
    }
  }
  if (!nearest) return null;
  return {
    name: nearest.name,
    distance_km: Math.round(minDist),
    alert_level: nearest.alert_level,
  };
}

function buildGlobalAnalogs(
  magnitude: number,
  depthKm: number,
  boundaryType: TectonicContext['boundary_type'],
): EarthquakeContext['global_analogs'] {
  const scored = GLOBAL_ANALOGS.map((analog) => {
    const magScore = Math.abs(analog.mag - magnitude) * 2.8;
    const depthScore = Math.abs(analog.depth - depthKm) / 35;
    const boundaryBonus = analog.keywords.includes(boundaryType) ? -2.5 : 0;
    return { analog, score: magScore + depthScore + boundaryBonus };
  })
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(({ analog }) => ({
      name: analog.name,
      mag: analog.mag,
      depth: analog.depth,
      mechanism: analog.mechanism,
      why_similar: analog.why_similar,
      outcome_summary: analog.outcome_summary,
    }));
  return scored;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
