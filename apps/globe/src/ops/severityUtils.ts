import type { OpsRegion, OpsSeverity } from './types';
import { t } from '../i18n';

export function severityRank(severity: OpsSeverity): number {
  switch (severity) {
    case 'critical': return 3;
    case 'priority': return 2;
    case 'watch': return 1;
    case 'clear': return 0;
  }
}

export function maxSeverity(left: OpsSeverity, right: OpsSeverity): OpsSeverity {
  return severityRank(left) >= severityRank(right) ? left : right;
}

export function formatRegion(region: OpsRegion | null): string {
  if (!region) return t('region.japan');
  return t(`region.${region}`);
}
