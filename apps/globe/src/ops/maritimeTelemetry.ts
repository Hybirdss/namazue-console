import type { Vessel, VesselType } from '../data/aisManager';
import { t, tf } from '../i18n';

export interface MaritimeOverview {
  totalTracked: number;
  highPriorityTracked: number;
  underwayCount: number;
  anchoredCount: number;
  summary: string;
}

export function isHighPriorityVessel(type: VesselType): boolean {
  return type === 'passenger' || type === 'tanker';
}

export function buildMaritimeOverview(vessels: Vessel[]): MaritimeOverview {
  const totalTracked = vessels.length;
  const highPriorityTracked = vessels.filter((v) => isHighPriorityVessel(v.type)).length;
  const underwayCount = vessels.filter((v) => v.sog > 0.5).length;
  const anchoredCount = totalTracked - underwayCount;

  if (totalTracked === 0) {
    return {
      totalTracked: 0,
      highPriorityTracked: 0,
      underwayCount: 0,
      anchoredCount: 0,
      summary: t('maritime.noTraffic'),
    };
  }

  const parts = [tf('maritime.trackedCount', { n: totalTracked })];
  if (highPriorityTracked > 0) parts.push(tf('maritime.highPriorityCount', { n: highPriorityTracked }));
  if (underwayCount > 0) parts.push(tf('maritime.underwayCount', { n: underwayCount }));
  if (anchoredCount > 0) parts.push(tf('maritime.anchoredCount', { n: anchoredCount }));

  return {
    totalTracked,
    highPriorityTracked,
    underwayCount,
    anchoredCount,
    summary: parts.join(' · '),
  };
}
