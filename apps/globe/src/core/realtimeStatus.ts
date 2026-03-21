import type { RealtimeStatus } from '../ops/readModelTypes';
import { t } from '../i18n';

export interface DeriveRealtimeStatusInput {
  source: RealtimeStatus['source'];
  updatedAt: number;
  now: number;
  staleAfterMs: number;
  fallbackActive: boolean;
  networkError: string | null;
}

export function deriveRealtimeStatus(input: DeriveRealtimeStatusInput): RealtimeStatus {
  if (input.networkError) {
    return {
      source: input.source,
      state: 'degraded',
      updatedAt: input.updatedAt,
      staleAfterMs: input.staleAfterMs,
      message: input.networkError,
    };
  }

  if (input.fallbackActive || input.source !== 'server') {
    const isStale = input.now - input.updatedAt > input.staleAfterMs;
    return {
      source: input.source,
      state: isStale ? 'degraded' : 'stale',
      updatedAt: input.updatedAt,
      staleAfterMs: input.staleAfterMs,
      message: isStale
        ? t('realtime.fallbackStale')
        : t('realtime.fallbackActive'),
    };
  }

  const isStale = input.now - input.updatedAt > input.staleAfterMs;
  return {
    source: input.source,
    state: isStale ? 'stale' : 'fresh',
    updatedAt: input.updatedAt,
    staleAfterMs: input.staleAfterMs,
    message: isStale ? t('realtime.delayed') : undefined,
  };
}
