import type { DamageProbs } from './fragilityCurves';

export type LaunchMetro = 'tokyo' | 'osaka';
export type OpsRegion =
  | 'hokkaido'
  | 'tohoku'
  | 'kanto'
  | 'chubu'
  | 'kansai'
  | 'chugoku'
  | 'shikoku'
  | 'kyushu';
export type OpsAssetClass =
  | 'port'
  | 'rail_hub'
  | 'hospital'
  | 'power_substation'
  | 'water_facility'
  | 'telecom_hub'
  | 'building_cluster'
  | 'nuclear_plant'
  | 'airport'
  | 'dam'
  | 'lng_terminal'
  | 'government_eoc'
  | 'evacuation_site';
export type OpsSeverity = 'clear' | 'watch' | 'priority' | 'critical';
export type ZoomTier = 'national' | 'regional' | 'city' | 'district';

export interface ViewportState {
  center: { lat: number; lng: number };
  zoom: number;
  bounds: [west: number, south: number, east: number, north: number];
  tier: ZoomTier;
  activeRegion: OpsRegion | null;
  pitch?: number;
  bearing?: number;
}

export interface OpsAsset {
  id: string;
  metro?: LaunchMetro;
  region: OpsRegion;
  class: OpsAssetClass;
  name: string;
  nameJa?: string;
  lat: number;
  lng: number;
  tags: string[];
  minZoomTier: ZoomTier;
}

export type OpsFocus =
  | { type: 'calm' }
  | { type: 'event'; earthquakeId: string }
  | { type: 'asset'; assetId: string }
  | { type: 'scenario'; earthquakeId: string };

// ── Domain Intelligence Types ─────────────────────────────────────

export type ActionUrgency = 'immediate' | 'within_1h' | 'within_6h' | 'monitor';

export interface DomainAction {
  urgency: ActionUrgency;
  action: string; // i18n key
}

export interface NearestAlternative {
  assetId: string;
  name: string;
  distanceKm: number;
  bearing: number; // degrees (0=N, 90=E, 180=S, 270=W)
  severity: OpsSeverity;
}

export interface DomainIntelligence {
  actions: DomainAction[];
  nearestAlternative: NearestAlternative | null;
  metrics: Record<string, string | number>;
  smartRationale: string;
}

// ── Asset Exposure ────────────────────────────────────────────────

export interface OpsAssetExposure {
  assetId: string;
  severity: OpsSeverity;
  score: number;
  summary: string;
  reasons: string[];
  damageProbs?: DamageProbs;
  intensity?: number;
  domainIntel?: DomainIntelligence;
}

export interface OpsPriority {
  id: string;
  assetId: string | null;
  severity: OpsSeverity;
  title: string;
  rationale: string;
}

export interface OpsScenarioShift {
  magnitudeDelta: number;
  depthDeltaKm: number;
  latShiftDeg: number;
  lngShiftDeg: number;
}

export interface OpsState {
  metro: LaunchMetro;
  focus: OpsFocus;
  assets: OpsAsset[];
  exposures: OpsAssetExposure[];
  priorities: OpsPriority[];
  scenarioShift: OpsScenarioShift | null;
}
