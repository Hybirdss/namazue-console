import type { RealtimeStatus, ServiceReadModel } from '../ops/readModelTypes';
import { t, tf } from '../i18n';
import type { BundleDensity, OperatorViewId } from '../layers/bundleRegistry';
import type { BundleId } from '../layers/layerRegistry';
import type { PerformanceStatus } from './store';
import type {
  MissionStripFreshnessContext,
  MissionStripRegionContext,
  MissionStripTrustContext,
} from '../presentation/types';
import { buildMissionStripModel } from '../presentation/missionStrip';

export interface SystemBarState {
  regionLabel: string;
  statusText: string;
  statusMode: 'calm' | 'event';
  statusTone: 'nominal' | 'watch' | 'degraded';
}

function toMissionStripRegionContext(
  viewport: ServiceReadModel['viewport'],
): MissionStripRegionContext | null {
  if (!viewport) {
    return null;
  }
  return {
    tier: viewport.tier,
    activeRegion: viewport.activeRegion,
  };
}

function toMissionStripFreshnessContext(
  realtimeStatus: RealtimeStatus,
): MissionStripFreshnessContext {
  return {
    source: realtimeStatus.source,
    state: realtimeStatus.state,
    message: realtimeStatus.message,
    components: realtimeStatus.components?.map((component) => ({
      id: component.id,
      label: component.label,
      state: component.state,
      message: component.message,
    })),
  };
}

function toMissionStripTrustContext(readModel: ServiceReadModel): MissionStripTrustContext {
  return {
    healthLevel: readModel.systemHealth.level,
    eventTruth: readModel.eventTruth
      ? {
          confidence: readModel.eventTruth.confidence,
          hasConflictingRevision: readModel.eventTruth.hasConflictingRevision,
          divergenceSeverity: readModel.eventTruth.divergenceSeverity,
        }
      : null,
  };
}

export function buildSystemBarState(input: {
  mode: 'calm' | 'event';
  eventCount: number;
  readModel: ServiceReadModel;
  realtimeStatus: RealtimeStatus;
  activeViewId?: OperatorViewId;
  activeBundleId?: BundleId;
  density?: BundleDensity;
  region?: MissionStripRegionContext | null;
  performanceStatus?: PerformanceStatus;
}): SystemBarState {
  const trust = toMissionStripTrustContext(input.readModel);
  const freshness = toMissionStripFreshnessContext(input.realtimeStatus);
  const missionStrip = buildMissionStripModel({
    mode: input.mode,
    activeViewId: input.activeViewId ?? 'national-impact',
    activeBundleId: input.activeBundleId ?? 'seismic',
    density: input.density ?? 'standard',
    region: input.region ?? toMissionStripRegionContext(input.readModel.viewport),
    freshness,
    trust,
  });
  const parts = [missionStrip.headline];

  if (input.eventCount > 0) {
    parts.push(tf('sysbar.events', { n: input.eventCount }));
  }

  // Freshness cell (e.g., "server fresh", "usgs degraded")
  const freshnessCell = missionStrip.cells.find((cell) => cell.id === 'freshness');
  if (freshnessCell) {
    parts.push(freshnessCell.value);
  }

  // System health level
  const healthLevel = input.readModel.systemHealth.level;
  if (healthLevel !== 'nominal') {
    parts.push(tf('sysbar.healthStatus', { level: healthLevel }));
  }

  // Event truth state — conflict and divergence
  const eventTruth = input.readModel.eventTruth;
  if (eventTruth) {
    if (eventTruth.divergenceSeverity === 'material') {
      parts.push(t('sysbar.divergence'));
    } else if (eventTruth.hasConflictingRevision) {
      parts.push(t('sysbar.conflict'));
    }
  }

  // Operational latency — only show for recent pipeline delays (< 5 min).
  // Beyond that, it's just "old data" and redundant with the stale/degraded status.
  const latency = input.readModel.operationalLatency;
  if (latency && latency.ingestLagSeconds > 5 && latency.ingestLagSeconds < 300) {
    parts.push(tf('sysbar.lag', { n: latency.ingestLagSeconds }));
  }

  // Component-level degradation from alerts
  for (const alert of missionStrip.alerts) {
    parts.push(alert.label);
  }

  // Performance status
  if (input.performanceStatus && input.performanceStatus.tone === 'degraded') {
    parts.push(tf('sysbar.fps', { n: Math.round(input.performanceStatus.fps) }));
  }

  // Derive tone from realtime health + performance
  let statusTone: SystemBarState['statusTone'] = 'nominal';
  if (input.realtimeStatus.state === 'degraded') {
    statusTone = 'degraded';
  } else if (input.realtimeStatus.state === 'stale' || input.performanceStatus?.tone === 'degraded') {
    statusTone = 'watch';
  }

  return {
    regionLabel: missionStrip.regionLabel,
    statusText: parts.join(' · '),
    statusMode: input.mode,
    statusTone,
  };
}
