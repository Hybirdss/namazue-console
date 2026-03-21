import { jmaThresholdDistanceKm } from '../engine/gmpe';
import type { EarthquakeEvent } from '../types';

export type EventSequenceMode = 'live-selection' | 'replay' | 'preview';

export type EventSequencePhase =
  | 'idle'
  | 'epicenter-flash'
  | 'p-wave'
  | 's-wave'
  | 'intensity-reveal'
  | 'infrastructure-handoff'
  | 'aftershock-cascade'
  | 'settled';

export interface EventSequenceState {
  mode: EventSequenceMode;
  phase: EventSequencePhase;
  active: boolean;
  selectedEventId: string | null;
  startedAt: number;
  elapsedMs: number;
  sWaveRadiusKm: number | null;
  handoffKm: number | null;
}

export const EVENT_SEQUENCE_PHASE_START_MS = {
  'epicenter-flash': 0,
  'p-wave': 120,
  's-wave': 380,
  'intensity-reveal': 1200,
  'infrastructure-handoff': 2200,
  'aftershock-cascade': 3000,
  settled: 3400,
} as const;

export const EVENT_SEQUENCE_S_WAVE_SPEED_KMS = 140;
const EVENT_SEQUENCE_HANDOFF_STEP_KM = 10;

const DEFAULT_EVENT_SEQUENCE_STATE = {
  mode: 'live-selection',
  phase: 'idle',
  active: false,
  selectedEventId: null,
  startedAt: 0,
  elapsedMs: 0,
  sWaveRadiusKm: null,
  handoffKm: null,
} as const satisfies EventSequenceState;

export function createDefaultEventSequenceState(): EventSequenceState {
  return { ...DEFAULT_EVENT_SEQUENCE_STATE };
}

export function createEventSequenceState(
  overrides: Partial<EventSequenceState> = {},
): EventSequenceState {
  return {
    ...createDefaultEventSequenceState(),
    ...overrides,
  };
}

export function getEventSequencePhaseForElapsedMs(elapsedMs: number): EventSequencePhase {
  const clampedElapsedMs = Math.max(0, elapsedMs);

  if (clampedElapsedMs >= EVENT_SEQUENCE_PHASE_START_MS.settled) return 'settled';
  if (clampedElapsedMs >= EVENT_SEQUENCE_PHASE_START_MS['aftershock-cascade']) return 'aftershock-cascade';
  if (clampedElapsedMs >= EVENT_SEQUENCE_PHASE_START_MS['infrastructure-handoff']) return 'infrastructure-handoff';
  if (clampedElapsedMs >= EVENT_SEQUENCE_PHASE_START_MS['intensity-reveal']) return 'intensity-reveal';
  if (clampedElapsedMs >= EVENT_SEQUENCE_PHASE_START_MS['s-wave']) return 's-wave';
  if (clampedElapsedMs >= EVENT_SEQUENCE_PHASE_START_MS['p-wave']) return 'p-wave';
  return 'epicenter-flash';
}

export function getEventSequenceSWaveRadiusKm(input: {
  elapsedMs: number;
  selectedEvent: EarthquakeEvent | null;
}): number | null {
  if (!input.selectedEvent) return null;
  if (input.elapsedMs < EVENT_SEQUENCE_PHASE_START_MS['s-wave']) return 0;

  const maxRadiusKm = jmaThresholdDistanceKm(
    input.selectedEvent.magnitude,
    input.selectedEvent.depth_km,
    input.selectedEvent.faultType,
  );
  const sWaveElapsedSeconds = (input.elapsedMs - EVENT_SEQUENCE_PHASE_START_MS['s-wave']) / 1000;
  return Math.min(maxRadiusKm, Math.max(0, sWaveElapsedSeconds * EVENT_SEQUENCE_S_WAVE_SPEED_KMS));
}

export function getEventSequenceHandoffKm(input: {
  phase: EventSequencePhase;
  sWaveRadiusKm: number | null;
}): number | null {
  if (input.sWaveRadiusKm === null) return null;
  if (
    input.phase !== 'infrastructure-handoff'
    && input.phase !== 'aftershock-cascade'
    && input.phase !== 'settled'
  ) {
    return null;
  }

  return Math.max(0, Math.round(input.sWaveRadiusKm / EVENT_SEQUENCE_HANDOFF_STEP_KM) * EVENT_SEQUENCE_HANDOFF_STEP_KM);
}

export function deriveEventSequenceFrame(input: {
  state: EventSequenceState;
  now: number;
  selectedEvent: EarthquakeEvent | null;
}): EventSequenceState {
  if (!input.selectedEvent) {
    return createEventSequenceState({
      mode: input.state.mode,
      phase: 'idle',
      active: false,
      selectedEventId: null,
      startedAt: 0,
      elapsedMs: 0,
      sWaveRadiusKm: null,
      handoffKm: null,
    });
  }

  const elapsedMs = Math.max(0, input.now - input.state.startedAt);
  const phase = getEventSequencePhaseForElapsedMs(elapsedMs);
  const sWaveRadiusKm = getEventSequenceSWaveRadiusKm({
    elapsedMs,
    selectedEvent: input.selectedEvent,
  });
  const handoffKm = getEventSequenceHandoffKm({
    phase,
    sWaveRadiusKm,
  });

  return createEventSequenceState({
    ...input.state,
    selectedEventId: input.selectedEvent.id,
    elapsedMs,
    phase,
    active: phase !== 'settled',
    sWaveRadiusKm,
    handoffKm,
  });
}
