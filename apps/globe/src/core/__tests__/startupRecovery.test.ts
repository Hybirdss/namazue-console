import { describe, expect, it } from 'vitest';

import type { MapLoadHandle } from '../startupRecovery';
import { describeStartupFailure, waitForMapLoad } from '../startupRecovery';

describe('describeStartupFailure', () => {
  it('returns a WebGL-specific recovery message for map init failures', () => {
    const failure = describeStartupFailure(new Error('Failed to initialize WebGL'));

    expect(failure.title).toBe('Unable to start the map');
    expect(failure.detail).toContain('WebGL');
    expect(failure.detail).toContain('browser');
  });

  it('falls back to a generic startup message for unknown errors', () => {
    const failure = describeStartupFailure(new Error('Unexpected startup failure'));

    expect(failure.title).toBe('Unable to start Namazue');
    expect(failure.detail).toContain('Refresh');
  });
});

describe('waitForMapLoad', () => {
  it('resolves immediately when the map is already loaded', async () => {
    let listenerRegistered = false;
    const map = {
      loaded: () => true,
      once: () => {
        listenerRegistered = true;
        return map;
      },
    } as unknown as MapLoadHandle;

    await expect(waitForMapLoad(map)).resolves.toBeUndefined();
    expect(listenerRegistered).toBe(false);
  });

  it('waits for the load event when the map is not ready yet', async () => {
    let onLoad: (() => void) | undefined;
    const map = {
      loaded: () => false,
      once: (_event: 'load', handler: () => void) => {
        onLoad = handler;
        return map;
      },
    } as unknown as MapLoadHandle;

    const promise = waitForMapLoad(map);
    expect(onLoad).toBeTypeOf('function');

    onLoad?.();
    await expect(promise).resolves.toBeUndefined();
  });
});
