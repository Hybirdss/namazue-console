/**
 * Localized labels for severity, trust, and performance tone values.
 * Centralizes all .toUpperCase() replacements for i18n.
 */

import { t } from '../i18n';
import type { PerformanceTone } from '../core/store';

export type SeverityLevel = 'critical' | 'priority' | 'watch' | 'clear' | 'info';
export type TrustLevel = 'confirmed' | 'review' | 'degraded' | string;

export function localizedSeverityLabel(severity: string): string {
  const key = `severity.${severity}`;
  const label = t(key);
  // If key is missing (t returns the key itself), fallback to uppercase
  return label !== key ? label : severity.toUpperCase();
}

export function localizedTrustLabel(trust: string): string {
  const key = `trust.${trust}`;
  const label = t(key);
  return label !== key ? label : trust.toUpperCase();
}

export function localizedPerformanceTone(tone: PerformanceTone): string {
  const key = `performance.tone.${tone}`;
  const label = t(key);
  return label !== key ? label : tone.toUpperCase();
}
