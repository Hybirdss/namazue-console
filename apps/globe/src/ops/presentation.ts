import type { EarthquakeEvent } from '../types';
import { getLocalizedPlace } from '../utils/japanGeo';
import type { LaunchMetro, OpsPriority } from './types';
import { t, tf } from '../i18n';

export interface SnapshotModel {
  mode: 'calm' | 'event';
  headline: string;
  summary: string;
  checks: string[];
}

export interface BuildSnapshotInput {
  event: EarthquakeEvent | null;
  priorities: OpsPriority[];
  metro: LaunchMetro;
}

function formatMetroLabel(metro: LaunchMetro): string {
  return metro === 'tokyo' ? t('metro.tokyo') : t('metro.osaka');
}

export function buildSnapshotModel(input: BuildSnapshotInput): SnapshotModel {
  const metroLabel = formatMetroLabel(input.metro);

  if (!input.event) {
    return {
      mode: 'calm',
      headline: t('snapshot.calm.headline'),
      summary: tf('snapshot.calm.summary', { metro: metroLabel }),
      checks: [
        t('snapshot.calm.check.replay'),
        t('snapshot.calm.check.scenario'),
        tf('snapshot.calm.check.inspect', { metro: metroLabel }),
      ],
    };
  }

  return {
    mode: 'event',
    headline: tf('snapshot.event.headline', { place: getLocalizedPlace(input.event.lat, input.event.lng, input.event.place.text) }),
    summary: tf('snapshot.event.summary', { metro: metroLabel }),
    checks: input.priorities.slice(0, 3).map((priority) => priority.title),
  };
}
