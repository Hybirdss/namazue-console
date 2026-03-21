import type { PerformanceStatus } from './store';

export interface PerformanceGate {
  sample(frameTimeMs?: number): PerformanceStatus | null;
}

export interface PerformanceGateOptions {
  minFps: number;
  watchFps?: number;
  sampleWindowMs?: number;
  minFramesPerWindow?: number;
}

function resolveTone(input: { fps: number; minFps: number; watchFps: number }): PerformanceStatus['tone'] {
  if (input.fps < input.minFps) return 'degraded';
  if (input.fps < input.watchFps) return 'watch';
  return 'nominal';
}

export function createPerformanceGate(options: PerformanceGateOptions): PerformanceGate {
  const minFps = options.minFps;
  const watchFps = options.watchFps ?? Math.max(options.minFps + 5, 50);
  const sampleWindowMs = options.sampleWindowMs ?? 2000;
  const minFramesPerWindow = options.minFramesPerWindow ?? 20;

  let windowStart = 0;
  let frameCount = 0;

  return {
    sample(frameTimeMs = Date.now()): PerformanceStatus | null {
      if (windowStart === 0) {
        windowStart = frameTimeMs;
        frameCount = 1;
        return null;
      }

      frameCount += 1;
      const elapsed = frameTimeMs - windowStart;
      if (elapsed < sampleWindowMs || frameCount < minFramesPerWindow) {
        return null;
      }

      const fps = Math.max(0, Number(((frameCount * 1000) / elapsed).toFixed(1)));
      const status: PerformanceStatus = {
        fps,
        sampledAt: frameTimeMs,
        tone: resolveTone({ fps, minFps, watchFps }),
        minFps,
      };

      windowStart = frameTimeMs;
      frameCount = 0;
      return status;
    },
  };
}
