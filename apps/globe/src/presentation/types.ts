import type { BundleDensity, OperatorViewId } from '../layers/bundleRegistry';
import type { BundleId } from '../layers/layerRegistry';
import type {
  EventTruth,
  RealtimeComponentStatus,
  RealtimeSource,
  RealtimeState,
  SystemHealthSummary,
} from '../ops/readModelTypes';
import type { OpsRegion, ZoomTier } from '../ops/types';

export type PresentationTone = 'nominal' | 'watch' | 'degraded';
export type MissionStripCellId = 'view' | 'bundle' | 'density' | 'freshness' | 'trust';

export interface MissionStripRegionContext {
  tier: ZoomTier;
  activeRegion: OpsRegion | null;
}

export interface MissionStripFreshnessContext {
  source: RealtimeSource;
  state: RealtimeState;
  message?: string;
  components?: Array<Pick<RealtimeComponentStatus, 'id' | 'label' | 'state' | 'message'>>;
}

export interface MissionStripTrustContext {
  healthLevel: SystemHealthSummary['level'];
  eventTruth: Pick<EventTruth, 'confidence' | 'hasConflictingRevision' | 'divergenceSeverity'> | null;
}

export interface MissionStripCell {
  id: MissionStripCellId;
  label: string;
  value: string;
  tone: PresentationTone;
}

export interface MissionStripAlert {
  id: string;
  label: string;
  tone: Exclude<PresentationTone, 'nominal'>;
}

export interface MissionStripModel {
  regionLabel: string;
  headline: string;
  cells: MissionStripCell[];
  alerts: MissionStripAlert[];
}

export interface MissionStripInput {
  mode: 'calm' | 'event';
  activeViewId: OperatorViewId;
  activeBundleId: BundleId;
  density: BundleDensity;
  region?: MissionStripRegionContext | null;
  freshness: MissionStripFreshnessContext;
  trust: MissionStripTrustContext;
}
