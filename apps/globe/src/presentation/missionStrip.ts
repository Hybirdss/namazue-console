import { getBundleDefinition, getOperatorViewPreset } from '../layers/bundleRegistry';
import { t } from '../i18n';
import type {
  MissionStripAlert,
  MissionStripCell,
  MissionStripCellId,
  MissionStripFreshnessContext,
  MissionStripInput,
  MissionStripModel,
  MissionStripRegionContext,
  MissionStripTrustContext,
  PresentationTone,
} from './types';

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRegionLabel(region: MissionStripRegionContext | null | undefined): string {
  if (!region || region.tier === 'national' || !region.activeRegion) {
    return t('sysbar.japan');
  }
  return capitalize(region.activeRegion);
}

function resolveFreshnessTone(freshness: MissionStripFreshnessContext): PresentationTone {
  switch (freshness.state) {
    case 'degraded':
      return 'degraded';
    case 'stale':
      return 'watch';
    default:
      return 'nominal';
  }
}

function resolveRealtimeAlerts(freshness: MissionStripFreshnessContext): MissionStripAlert[] {
  const alerts: MissionStripAlert[] = [];

  // Surface component-level degradation (e.g., "Maritime degraded · AISstream timeout")
  if (freshness.components) {
    for (const comp of freshness.components) {
      if (comp.state === 'degraded' || comp.state === 'down') {
        const tone: MissionStripAlert['tone'] = comp.state === 'down' ? 'degraded' : 'watch';
        const stateMap: Record<string, string> = {
          degraded: t('strip.degraded'),
          down: t('strip.degraded'),
          stale: t('strip.watch'),
          fresh: t('strip.nominal'),
        };
        const localizedState = stateMap[comp.state] ?? comp.state;
        const label = comp.message
          ? `${comp.label} ${localizedState} · ${comp.message}`
          : `${comp.label} ${localizedState}`;
        alerts.push({ id: `component-${comp.id}`, label, tone });
      }
    }
  }

  // Surface feed-level message (e.g., "fallback active")
  if (freshness.message && (freshness.state === 'degraded' || freshness.state === 'stale')) {
    alerts.push({ id: 'feed-message', label: freshness.message, tone: freshness.state === 'degraded' ? 'degraded' : 'watch' });
  }

  return alerts;
}

function resolveTrustValue(trust: MissionStripTrustContext): string {
  const truth = trust.eventTruth;

  if (truth?.divergenceSeverity === 'material') {
    return t('strip.divergence');
  }
  if (truth?.hasConflictingRevision) {
    return t('strip.conflict');
  }
  if (truth?.confidence === 'low') {
    return t('strip.lowConf');
  }
  if (truth?.confidence) {
    const confMap: Record<string, string> = {
      high: t('strip.confidence.high'),
      medium: t('strip.confidence.medium'),
      low: t('strip.confidence.low'),
    };
    return confMap[truth.confidence] ?? truth.confidence.toUpperCase();
  }

  switch (trust.healthLevel) {
    case 'degraded':
      return t('strip.degraded');
    case 'watch':
      return t('strip.watch');
    default:
      return t('strip.nominal');
  }
}

function resolveTrustTone(trust: MissionStripTrustContext): PresentationTone {
  const truth = trust.eventTruth;

  if (trust.healthLevel === 'degraded') {
    return 'degraded';
  }
  if (
    trust.healthLevel === 'watch'
    || truth?.divergenceSeverity === 'material'
    || truth?.hasConflictingRevision
    || truth?.confidence === 'low'
  ) {
    return 'watch';
  }
  return 'nominal';
}

function createCell(input: {
  id: MissionStripCellId;
  label: string;
  value: string;
  tone: PresentationTone;
}): MissionStripCell {
  return {
    id: input.id,
    label: input.label,
    value: input.value,
    tone: input.tone,
  };
}

export function buildMissionStripModel(input: MissionStripInput): MissionStripModel {
  return {
    regionLabel: formatRegionLabel(input.region),
    headline: input.mode === 'event' ? t('sysbar.eventActive') : t('sysbar.systemCalm'),
    cells: [
      createCell({
        id: 'view',
        label: t('strip.view'),
        value: getOperatorViewPreset(input.activeViewId).label,
        tone: 'nominal',
      }),
      createCell({
        id: 'bundle',
        label: t('strip.bundle'),
        value: getBundleDefinition(input.activeBundleId).label,
        tone: 'nominal',
      }),
      createCell({
        id: 'density',
        label: t('strip.density'),
        value: (() => {
          const densityMap: Record<string, string> = {
            minimal: t('bundle.density.minimal'),
            standard: t('bundle.density.standard'),
            dense: t('bundle.density.dense'),
          };
          return densityMap[input.density] ?? input.density;
        })(),
        tone: 'nominal',
      }),
      createCell({
        id: 'freshness',
        label: t('strip.freshness'),
        value: (() => {
          const sourceMap: Record<string, string> = {
            live: t('freshness.source.live'),
            fallback: t('freshness.source.fallback'),
            cached: t('freshness.source.cached'),
          };
          const stateMap: Record<string, string> = {
            fresh: t('freshness.state.fresh'),
            stale: t('freshness.state.stale'),
            degraded: t('freshness.state.degraded'),
          };
          const src = sourceMap[input.freshness.source] ?? input.freshness.source;
          const st = stateMap[input.freshness.state] ?? input.freshness.state;
          return `${src} ${st}`;
        })(),
        tone: resolveFreshnessTone(input.freshness),
      }),
      createCell({
        id: 'trust',
        label: t('strip.trust'),
        value: resolveTrustValue(input.trust),
        tone: resolveTrustTone(input.trust),
      }),
    ],
    alerts: resolveRealtimeAlerts(input.freshness),
  };
}
