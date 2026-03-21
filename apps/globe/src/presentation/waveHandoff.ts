import { tf, t } from '../i18n';

export interface WaveHandoffInput {
  sequenceSWaveKm: number | null;
  selectedEvent: { magnitude: number; depth_km: number } | null;
}

export interface WaveHandoffModel {
  phase: 'idle' | 'propagating' | 'arrived';
  label: string;
  tone: 'nominal' | 'watch' | 'priority';
}

export function toWaveHandoffDisplayKm(km: number): number {
  return Math.max(0, Math.round(km / 10) * 10);
}

function resolveArrivalThreshold(input: WaveHandoffInput): number {
  if (!input.selectedEvent) return 300;
  const magnitudeSpread = Math.max(0, input.selectedEvent.magnitude - 4) * 55;
  const depthSpread = Math.max(0, input.selectedEvent.depth_km) * 0.3;
  return Math.min(900, Math.max(220, 220 + magnitudeSpread + depthSpread));
}

export function buildWaveHandoffModel(input: WaveHandoffInput): WaveHandoffModel {
  const radius = input.sequenceSWaveKm;
  if (radius === null || radius <= 0) {
    return { phase: 'idle', label: t('wave.standby'), tone: 'nominal' };
  }
  const displayKm = toWaveHandoffDisplayKm(radius);

  const arrivalThreshold = resolveArrivalThreshold(input);
  if (radius >= arrivalThreshold) {
    return {
      phase: 'arrived',
      label: tf('wave.reached', { n: displayKm }),
      tone: 'priority',
    };
  }

  return {
    phase: 'propagating',
    label: tf('wave.front', { n: displayKm }),
    tone: 'watch',
  };
}
