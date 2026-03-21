import { earthquakeStore } from '../data/earthquakeStore';
import type { Vessel } from '../data/aisManager';
import {
  calibrateGridToObservedIntensity,
  computeIntensityGrid,
  jmaThresholdDistanceKm,
} from '../engine/gmpe';
import { OPS_ASSETS } from '../ops/assetCatalog';
import { buildOperatorBundleSummaries } from '../ops/bundleSummaries';
import {
  buildDefaultBundleDomainOverviews,
  filterScopedDomainOverrides,
  mergeBundleDomainOverrides,
} from '../ops/bundleDomainOverviews';
import { selectOperationalFocusEvent, type SelectedOperationalFocus } from '../ops/eventSelection';
import { buildAssetExposures } from '../ops/exposure';
import type { OpsAsset, OpsAssetExposure } from '../ops/types';
import type {
  OperatorBundleDomainOverrides,
  RealtimeSource,
  RealtimeStatus,
  ServiceReadModel,
} from '../ops/readModelTypes';
import { buildServiceReadModel } from '../ops/serviceReadModel';
import type { ViewportState as OpsViewportState } from '../ops/types';
import { buildOpsPriorities } from '../ops/priorities';
import { buildMaritimeOverview } from '../ops/maritimeTelemetry';
import { computeTsunamiSummary } from '../ops/impactIntelligence';
import type { ActiveFault, EarthquakeEvent, FaultType, IntensityGrid, RailLineStatus, TsunamiAssessment } from '../types';
import { deriveRealtimeStatus } from './realtimeStatus';
import type { ViewportState as ConsoleViewportState } from './viewportManager';

export interface DeriveConsoleOperationalStateInput {
  now: number;
  events: EarthquakeEvent[];
  currentSelectedEventId: string | null;
  /** When true, currentSelectedEventId is an explicit user click — bypass ops focus scoring */
  forceSelection?: boolean;
  source: RealtimeSource;
  updatedAt: number;
  realtimeStatusOverride?: RealtimeStatus;
  viewport: ConsoleViewportState;
  faults?: ActiveFault[];
  domainOverrides?: OperatorBundleDomainOverrides;
  railStatuses?: RailLineStatus[];
  /** USGS ShakeMap grid — when available, overrides GMPE computation for real events */
  shakeMapGrid?: IntensityGrid | null;
  shakeMapEventId?: string | null;
}

export interface ConsoleOperationalState {
  mode: 'calm' | 'event';
  selectedEvent: EarthquakeEvent | null;
  intensityGrid: IntensityGrid | null;
  exposures: ReturnType<typeof buildAssetExposures>;
  priorities: ReturnType<typeof buildOpsPriorities>;
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
}

interface CachedHazardComputation {
  key: string;
  intensityGrid: IntensityGrid;
  exposures: ReturnType<typeof buildAssetExposures>;
  priorities: ReturnType<typeof buildOpsPriorities>;
}

let cachedHazardComputation: CachedHazardComputation | null = null;

export function applyConsoleRealtimeError(input: {
  now: number;
  source: RealtimeSource;
  updatedAt: number;
  message: string;
  readModel: ServiceReadModel;
}): Pick<ConsoleOperationalState, 'readModel' | 'realtimeStatus'> {
  const realtimeStatus = deriveRealtimeStatus({
    source: input.source,
    updatedAt: input.updatedAt,
    now: input.now,
    staleAfterMs: STALE_AFTER_MS,
    fallbackActive: input.source !== 'server',
    networkError: input.message,
  });

  return {
    realtimeStatus,
    readModel: {
      ...input.readModel,
      freshnessStatus: realtimeStatus,
    },
  };
}

export function refreshConsoleBundleTruth(input: {
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
  selectedEvent: EarthquakeEvent | null;
  exposures: OpsAssetExposure[];
  vessels: Vessel[];
  assets: OpsAsset[];
  domainOverrides?: OperatorBundleDomainOverrides;
  railStatuses?: RailLineStatus[];
}): ServiceReadModel {
  const baseReadModel = input.readModel;
  const currentEvent = input.selectedEvent ?? baseReadModel.currentEvent;
  const trustLevel = baseReadModel.systemHealth.level === 'degraded' || input.realtimeStatus.state === 'degraded'
    ? 'degraded'
    : baseReadModel.systemHealth.level === 'watch' || input.realtimeStatus.state === 'stale'
      ? 'review'
      : 'confirmed';
  const railComponent = input.realtimeStatus.components?.find((component) => component.id === 'rail');
  const applicableDomainOverrides = filterScopedDomainOverrides({
    domainOverrides: input.domainOverrides,
    selectedEventId: currentEvent?.id ?? null,
  });
  const hasRailOverride = Boolean(applicableDomainOverrides.lifelines?.some((domain) => domain.id === 'rail'));
  const hasPowerOverride = Boolean(applicableDomainOverrides.lifelines?.some((domain) => domain.id === 'power'));
  const hasWaterOverride = Boolean(applicableDomainOverrides.lifelines?.some((domain) => domain.id === 'water'));
  const hasMedicalOverride = Boolean(applicableDomainOverrides.medical?.length);
  return {
    ...baseReadModel,
    currentEvent,
    bundleSummaries: buildOperatorBundleSummaries({
      selectedEvent: currentEvent,
      assets: input.assets,
      exposures: input.exposures,
      operationalOverview: baseReadModel.operationalOverview,
      maritimeOverview: buildMaritimeOverview(input.vessels),
      domainOverviews: mergeBundleDomainOverrides({
        overviews: buildDefaultBundleDomainOverviews({
          assets: input.assets,
          exposures: baseReadModel.nationalExposureSummary,
          priorities: baseReadModel.nationalPriorityQueue,
          trustLevel,
          selectedEvent: currentEvent,
          includeMedicalOverview: !hasMedicalOverride,
          includePowerDomain: !hasPowerOverride,
          includeRailDomain: !hasRailOverride,
          includeWaterDomain: !hasWaterOverride,
          railStatuses: hasRailOverride ? undefined : input.railStatuses,
          railComponent: hasRailOverride ? undefined : railComponent,
        }),
        domainOverrides: applicableDomainOverrides,
        trust: trustLevel,
      }),
      trustLevel,
    }),
    freshnessStatus: input.realtimeStatus,
  };
}

const STALE_AFTER_MS = 60_000;

function classifyRegion(lat: number, lng: number): OpsViewportState['activeRegion'] {
  if (lat >= 42) return 'hokkaido';
  if (lat >= 37) return 'tohoku';
  if (lat >= 34.5 && lng >= 138) return 'kanto';
  if (lat >= 34 && lng >= 136) return 'chubu';
  if (lat >= 33.5 && lng >= 132.5) return 'kansai';
  if (lat >= 33 && lng >= 131) return 'chugoku';
  if (lat >= 32.5 && lng >= 133) return 'shikoku';
  return 'kyushu';
}

function toOpsViewportState(viewport: ConsoleViewportState): OpsViewportState {
  return {
    center: viewport.center,
    zoom: viewport.zoom,
    bounds: viewport.bounds,
    tier: viewport.tier,
    activeRegion: classifyRegion(viewport.center.lat, viewport.center.lng),
    pitch: viewport.pitch ?? 0,
    bearing: viewport.bearing ?? 0,
  };
}

function quickTsunami(event: EarthquakeEvent | null): TsunamiAssessment | null {
  const summary = computeTsunamiSummary(event);
  if (!summary || !event) return null;

  return {
    risk: summary.risk,
    confidence: summary.confidence,
    factors: summary.factors,
    locationType: 'offshore',
    coastDistanceKm: null,
    faultType: event.faultType,
  };
}

// ── Fault Strike Estimation ───────────────────────────────────
//
// For the finite-fault distance correction, we need the dominant fault
// strike direction. For scenario events we compute it directly from
// fault geometry. For real-time events we estimate from regional
// subduction/fault architecture.
//
// Subduction trench orientations derived from the USGS Slab2 model:
//   Hayes, G.P. et al. (2018). "Slab2, a comprehensive subduction zone
//   geometry model." Science 362(6410):58-61. doi:10.1126/science.aat4723
//
// Representative slab contour azimuths (computed from Slab2 iso-depth lines):
//   Japan Trench (Pacific plate, ~36-41°N): ~195° (≡ 15° NNE)
//   Nankai Trough (Philippine Sea plate, ~32-34°N): ~245° (≡ 65° ENE)
//   Ryukyu Trench (~24-30°N): ~220° (≡ 40° NE)
//
// Crustal fault trends from the GSI Active Fault Database (国土地理院活断層データベース)
// and HERP long-term probability assessments (地震調査研究推進本部).

const DEG_TO_RAD = Math.PI / 180;

function computeStrikeFromSegments(segments: [number, number][]): number {
  const first = segments[0];
  const last = segments[segments.length - 1];
  const dLng = last[0] - first[0];
  const dLat = last[1] - first[1];
  const cosLat = Math.cos(first[1] * DEG_TO_RAD);
  const azimuthRad = Math.atan2(dLng * cosLat, dLat);
  return ((azimuthRad * 180 / Math.PI) + 360) % 360;
}

/**
 * Estimate dominant fault strike from regional tectonics.
 *
 * Subduction zone strikes from Slab2 iso-depth contour azimuths (Hayes 2018).
 * Crustal fault trends from GSI Active Fault DB + HERP probability assessments.
 */
function estimateRegionalStrike(lat: number, lng: number, faultType: FaultType): number {
  if (faultType === 'interface' || faultType === 'intraslab') {
    // Slab2 contour azimuths:
    //   Japan Trench: iso-depth lines trend ~15° (NNE) at 36-41°N, 140-145°E
    //   Nankai Trough: iso-depth lines trend ~65° (ENE) at 32-34°N, 132-137°E
    //   Ryukyu Trench: iso-depth lines trend ~40° (NE) at 24-31°N, 123-130°E
    if (lng >= 140) return 15;
    if (lat < 31) return 40;
    return 65;
  }

  // Crustal fault trends (GSI/HERP):
  //   Sagami Trough region (~35°N, 139°E): ~N140°E (NW-SE)
  //     — Sagami Trough strikes approximately NW-SE (GSI)
  //   Median Tectonic Line (~34°N, 132-136°E): ~N80°E (≈E-W)
  //     — MTL strikes roughly E-W across Shikoku-Kii (HERP)
  //   Tohoku inland faults (>37°N): ~N20°E (NNE-SSW)
  //     — Parallel to the volcanic arc (GSI fault traces)
  //   Kyushu faults (<33°N): ~N50°E (NE-SW)
  //     — Beppu-Shimabara graben system (HERP)
  if (lat >= 35 && lat < 37 && lng >= 139) return 140;
  if (lat >= 34 && lat < 36 && lng < 137) return 80;
  if (lat >= 37) return 20;
  if (lat < 33) return 50;
  return 45;
}

function estimateStrikeAngle(
  event: EarthquakeEvent,
  faults: ActiveFault[],
): number {
  // Prefer authoritative USGS moment tensor strike when available
  if (event.mtStrike != null && Number.isFinite(event.mtStrike)) {
    return event.mtStrike;
  }
  // For scenario events, use exact fault geometry
  if (event.scenarioFaultId || event.id.startsWith('scenario-')) {
    const faultId = event.scenarioFaultId ?? event.id.replace('scenario-', '');
    const fault = faults.find((f) => f.id === faultId);
    if (fault && fault.segments.length >= 2) {
      return computeStrikeFromSegments(fault.segments);
    }
  }
  return estimateRegionalStrike(event.lat, event.lng, event.faultType);
}

function buildHazardComputationKey(input: {
  event: EarthquakeEvent;
  updatedAt: number;
  faults: ActiveFault[];
}): string {
  const scenarioFaultId = input.event.scenarioFaultId
    ?? (input.event.id.startsWith('scenario-') ? input.event.id.replace('scenario-', '') : null);
  const scenarioFault = scenarioFaultId
    ? input.faults.find((fault) => fault.id === scenarioFaultId)
    : null;
  const segmentCount = scenarioFault?.segments.length ?? 0;
  return [
    input.event.id,
    input.event.time,
    input.event.lat.toFixed(4),
    input.event.lng.toFixed(4),
    input.event.magnitude.toFixed(2),
    input.event.depth_km.toFixed(1),
    input.event.faultType,
    input.event.tsunami ? '1' : '0',
    input.event.observedIntensity ?? 'none',
    input.updatedAt,
    scenarioFault?.id ?? 'none',
    segmentCount,
  ].join('|');
}

export function deriveConsoleOperationalState(
  input: DeriveConsoleOperationalStateInput,
): ConsoleOperationalState {
  // CRITICAL: Never upsert scenario events into the persistent earthquake store.
  // Scenario events (id starts with 'scenario-') are ephemeral and only exist
  // while scenario mode is active. Storing them would cause the ops focus algorithm
  // to auto-select them on subsequent polls even after scenario mode is turned off.
  const realEvents = input.events.filter((e) => !e.id.startsWith('scenario-'));
  earthquakeStore.upsert(realEvents, {
    source: input.source === 'fallback' ? 'usgs' : input.source,
    issuedAt: input.updatedAt,
    receivedAt: input.now,
  });

  // Build candidate list from store (real events only — scenario events are excluded)
  const events = [...earthquakeStore.getAll()].filter((e) => !e.id.startsWith('scenario-'));

  // When user explicitly clicks an event, bypass ops focus scoring.
  // selectOperationalFocusEvent filters for "significant" events (M≥4.5, recent)
  // and would override user clicks on smaller/older earthquakes.
  let selectedEvent: EarthquakeEvent | null;
  let focusReason: SelectedOperationalFocus['reason'];

  if (input.forceSelection && input.currentSelectedEventId) {
    // For scenario events, find in the input events (not in earthquakeStore)
    selectedEvent = earthquakeStore.get(input.currentSelectedEventId)
      ?? input.events.find((e) => e.id === input.currentSelectedEventId)
      ?? null;
    focusReason = 'retain-current';
  } else {
    const focus = selectOperationalFocusEvent({
      now: input.now,
      currentSelectedEventId: input.currentSelectedEventId,
      candidates: events.map((event) => ({
        event,
        envelope: earthquakeStore.getEnvelope(event.id) ?? null,
        revisionHistory: [...earthquakeStore.getRevisionHistory(event.id)],
      })),
    });
    selectedEvent = focus.selectedEventId
      ? earthquakeStore.get(focus.selectedEventId) ?? null
      : null;
    focusReason = focus.reason;
  }
  // Dynamic radius from GMPE-derived JMA 0.5 threshold distance.
  // jmaThresholdDistanceKm correctly accounts for depth and fault type — not just magnitude.
  // Divide by 0.92 for the circular edge-fade margin (outer 8% of grid fades to zero).
  // Use JMA 1.0 boundary as grid radius — captures full operationally relevant area.
  // For M8.5+, grid extends to ~800-1200km, ensuring distant assets get real intensity.
  const thresholdKm = selectedEvent
    ? jmaThresholdDistanceKm(selectedEvent.magnitude, selectedEvent.depth_km, selectedEvent.faultType, 1.0)
    : 333;
  const intensityRadiusDeg = (thresholdKm / 111) / 0.92;
  // Grid spacing: ~100 rows regardless of radius (total cells ≈ 10-12K)
  const intensitySpacing = Math.max(0.04, intensityRadiusDeg * 0.02);

  // Estimate fault strike for directional intensity propagation
  const strikeAngle = selectedEvent
    ? estimateStrikeAngle(selectedEvent, input.faults ?? [])
    : undefined;

  const tsunamiSummary = computeTsunamiSummary(selectedEvent);
  const tsunamiAssessment = quickTsunami(selectedEvent);
  let intensityGrid: IntensityGrid | null = null;
  let exposures: ReturnType<typeof buildAssetExposures> = [];
  let priorities: ReturnType<typeof buildOpsPriorities> = [];

  if (selectedEvent) {
    const computationKey = buildHazardComputationKey({
      event: selectedEvent,
      updatedAt: input.updatedAt,
      faults: input.faults ?? [],
    });

    // Use USGS ShakeMap grid when available (real observed data >> single-GMPE model)
    const useShakeMap = input.shakeMapGrid
      && input.shakeMapEventId === selectedEvent.id
      && !selectedEvent.id.startsWith('scenario-');

    const cacheKey = useShakeMap ? `shakemap:${computationKey}` : computationKey;

    if (cachedHazardComputation?.key === cacheKey) {
      intensityGrid = cachedHazardComputation.intensityGrid;
      exposures = cachedHazardComputation.exposures;
      priorities = cachedHazardComputation.priorities;
    } else {
      if (useShakeMap) {
        intensityGrid = input.shakeMapGrid!;
      } else {
        const gmpeGrid = computeIntensityGrid(
          { lat: selectedEvent.lat, lng: selectedEvent.lng },
          selectedEvent.magnitude,
          selectedEvent.depth_km,
          selectedEvent.faultType,
          intensitySpacing,
          intensityRadiusDeg,
          undefined,     // vs30Grid
          strikeAngle,   // directivity from fault strike
        );
        intensityGrid = calibrateGridToObservedIntensity(
          gmpeGrid,
          selectedEvent.observedIntensity,
        );
      }
      exposures = buildAssetExposures({ grid: intensityGrid, assets: OPS_ASSETS, tsunamiAssessment });
      priorities = buildOpsPriorities({ assets: OPS_ASSETS, exposures });
      cachedHazardComputation = {
        key: cacheKey,
        intensityGrid,
        exposures,
        priorities,
      };
    }
  }
  const realtimeStatus = input.realtimeStatusOverride ?? deriveRealtimeStatus({
    source: input.source,
    updatedAt: input.updatedAt,
    now: input.now,
    staleAfterMs: STALE_AFTER_MS,
    fallbackActive: input.source !== 'server',
    networkError: null,
  });
  const viewport = toOpsViewportState(input.viewport);
  const readModel = buildServiceReadModel({
    selectedEvent,
    selectedEventEnvelope: selectedEvent ? earthquakeStore.getEnvelope(selectedEvent.id) ?? null : null,
    selectedEventRevisionHistory: selectedEvent ? [...earthquakeStore.getRevisionHistory(selectedEvent.id)] : [],
    selectionReason: focusReason,
    tsunamiAssessment,
    tsunamiSummary,
    impactResults: null,
    assets: OPS_ASSETS,
    viewport,
    exposures,
    priorities,
    domainOverrides: input.domainOverrides,
    railStatuses: input.railStatuses,
    freshnessStatus: realtimeStatus,
  });

  return {
    mode: selectedEvent ? 'event' : 'calm',
    selectedEvent,
    intensityGrid,
    exposures,
    priorities,
    readModel,
    realtimeStatus,
  };
}
