import { getLocale, tf } from '../i18n';

function formatEnglishCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
  }
  return `${Math.round(value)}`;
}

export function formatPopulationShort(value: number): string {
  const locale = getLocale();
  if (locale === 'en') {
    return formatEnglishCompact(value);
  }
  if (value >= 10_000) {
    return tf('impact.populationMan', { n: (value / 10_000).toFixed(1) });
  }
  return tf('impact.populationNin', { n: Math.round(value).toLocaleString() });
}

export function formatPopulationCoverage(catalogedPopulation: number, totalPopulation: number): string {
  const ratio = totalPopulation > 0 ? Math.round((catalogedPopulation / totalPopulation) * 100) : 0;
  const locale = getLocale();

  switch (locale) {
    case 'ja':
      return `人口カバレッジ ${ratio}%`;
    case 'ko':
      return `인구 커버리지 ${ratio}%`;
    default:
      return `Coverage ${ratio}%`;
  }
}

export function formatAreaKm2(value: number): string {
  return `${Math.round(value).toLocaleString()} km²`;
}

export function formatMinutesShort(value: number): string {
  const rounded = Math.round(value);
  const locale = getLocale();
  if (locale === 'ja') return `${rounded}分`;
  if (locale === 'ko') return `${rounded}분`;
  return `${rounded}m`;
}

export function formatDistanceKm(value: number): string {
  const rounded = Math.round(value);
  const locale = getLocale();
  if (locale === 'ja' || locale === 'en') return `${rounded}km`;
  return `${rounded}km`;
}

export function formatWaveHeightMeters(value: number): string {
  const locale = getLocale();
  if (locale === 'ja' || locale === 'en') return `${value} m`;
  return `${value}m`;
}
