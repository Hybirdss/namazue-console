import { describe, expect, it } from 'vitest';

import { consoleStore } from '../../core/store';
import type { EarthquakeEvent } from '../../types';
import {
  createDefaultEventSequenceState,
  createEventSequenceState,
  deriveEventSequenceFrame,
} from '../eventSequenceState';

const selectedEvent: EarthquakeEvent = {
  id: 'eq-sequence-test',
  lat: 35.68,
  lng: 139.69,
  depth_km: 20,
  magnitude: 8,
  time: Date.parse('2026-03-10T00:00:00.000Z'),
  faultType: 'crustal',
  tsunami: false,
  place: { text: 'Tokyo Bay' },
};

describe('eventSequenceState', () => {
  it('defines a shared event sequence contract with safe defaults', () => {
    expect(createDefaultEventSequenceState()).toEqual({
      mode: 'live-selection',
      phase: 'idle',
      active: false,
      selectedEventId: null,
      startedAt: 0,
      elapsedMs: 0,
      sWaveRadiusKm: null,
      handoffKm: null,
    });
  });

  it('supports overriding the shared sequence fields', () => {
    expect(createEventSequenceState({
      mode: 'replay',
      phase: 's-wave',
      active: true,
      selectedEventId: 'eq-20260310',
      startedAt: 1_000,
      elapsedMs: 2_400,
      sWaveRadiusKm: 84,
      handoffKm: 132,
    })).toEqual({
      mode: 'replay',
      phase: 's-wave',
      active: true,
      selectedEventId: 'eq-20260310',
      startedAt: 1_000,
      elapsedMs: 2_400,
      sWaveRadiusKm: 84,
      handoffKm: 132,
    });
  });

  it('adds a safe default sequence to ConsoleState', () => {
    expect(consoleStore.getState().eventSequence).toEqual(createDefaultEventSequenceState());
  });

  it('advances sequence phases in the intended order as elapsed time changes', () => {
    const baseState = createEventSequenceState({
      active: true,
      selectedEventId: selectedEvent.id,
      startedAt: 1_000,
    });

    expect(deriveEventSequenceFrame({
      state: baseState,
      now: 1_000,
      selectedEvent,
    }).phase).toBe('epicenter-flash');
    expect(deriveEventSequenceFrame({
      state: baseState,
      now: 1_120,
      selectedEvent,
    }).phase).toBe('p-wave');
    expect(deriveEventSequenceFrame({
      state: baseState,
      now: 1_380,
      selectedEvent,
    }).phase).toBe('s-wave');
    expect(deriveEventSequenceFrame({
      state: baseState,
      now: 2_200,
      selectedEvent,
    }).phase).toBe('intensity-reveal');
    expect(deriveEventSequenceFrame({
      state: baseState,
      now: 3_200,
      selectedEvent,
    }).phase).toBe('infrastructure-handoff');
    expect(deriveEventSequenceFrame({
      state: baseState,
      now: 4_000,
      selectedEvent,
    }).phase).toBe('aftershock-cascade');
    expect(deriveEventSequenceFrame({
      state: baseState,
      now: 4_400,
      selectedEvent,
    }).phase).toBe('settled');
  });

  it('derives s-wave radius and handoff distance from the shared sequence helper', () => {
    const baseState = createEventSequenceState({
      active: true,
      selectedEventId: selectedEvent.id,
      startedAt: 1_000,
    });

    const waveFrame = deriveEventSequenceFrame({
      state: baseState,
      now: 2_000,
      selectedEvent,
    });

    expect(waveFrame.sWaveRadiusKm).toBeCloseTo(86.8, 3);
    expect(waveFrame.handoffKm).toBeNull();

    const handoffFrame = deriveEventSequenceFrame({
      state: baseState,
      now: 3_200,
      selectedEvent,
    });

    expect(handoffFrame.sWaveRadiusKm).toBeCloseTo(254.8, 3);
    expect(handoffFrame.handoffKm).toBe(250);

    const settledFrame = deriveEventSequenceFrame({
      state: baseState,
      now: 4_400,
      selectedEvent,
    });

    expect(settledFrame.active).toBe(false);
    expect(settledFrame.handoffKm).toBe(420);
  });
});
