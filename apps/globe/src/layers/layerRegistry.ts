import { t } from '../i18n';

export type BundleId =
  | 'seismic'
  | 'maritime'
  | 'lifelines'
  | 'medical'
  | 'built-environment';

export type LayerId =
  | 'earthquakes'
  | 'seismic-depth'
  | 'intensity'
  | 'heatmap'
  | 'faults'
  | 'ais'
  | 'rail'
  | 'airports'
  | 'transport'
  | 'power'
  | 'water'
  | 'telecom'
  | 'hospitals'
  | 'buildings';

export interface LegendEntry {
  color: string; // CSS color
  label: string;
}

export interface LayerDefinition {
  id: LayerId;
  label: string;
  bundle: BundleId;
  category: 'hazard' | 'realtime' | 'infrastructure' | 'built-environment';
  availability: 'live' | 'planned';
  defaultVisible: boolean;
  legend?: LegendEntry[];
}

function buildLayerDefinitions(): Record<LayerId, LayerDefinition> {
  return {
    earthquakes: {
      id: 'earthquakes',
      label: t('layer.name.earthquakes'),
      bundle: 'seismic',
      category: 'hazard',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: '#7dd3fc', label: t('layer.legend.magBelow45') },
        { color: '#60a5fa', label: t('layer.legend.mag4550') },
        { color: '#fbbf24', label: t('layer.legend.mag5570') },
        { color: '#ef4444', label: t('layer.legend.mag70plus') },
      ],
    },
    'seismic-depth': {
      id: 'seismic-depth',
      label: t('layer.name.seismicDepth'),
      bundle: 'seismic',
      category: 'hazard',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: '#ff2828', label: t('layer.legend.depthShallow') },
        { color: '#ffc81e', label: t('layer.legend.depth3070') },
        { color: '#50dc50', label: t('layer.legend.depth70150') },
        { color: '#28c8dc', label: t('layer.legend.depth150300') },
        { color: '#3c64f0', label: t('layer.legend.depth300500') },
        { color: '#a03cdc', label: t('layer.legend.depthDeep') },
      ],
    },
    intensity: {
      id: 'intensity',
      label: t('layer.name.intensity'),
      bundle: 'seismic',
      category: 'hazard',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: 'rgb(60, 130, 200)', label: 'JMA 2' },
        { color: 'rgb(80, 200, 100)', label: 'JMA 3' },
        { color: 'rgb(255, 220, 0)', label: 'JMA 4' },
        { color: 'rgb(255, 160, 0)', label: 'JMA 5-' },
        { color: 'rgb(255, 100, 0)', label: 'JMA 5+' },
        { color: 'rgb(239, 50, 0)', label: 'JMA 6-' },
        { color: 'rgb(200, 0, 0)', label: 'JMA 6+' },
        { color: 'rgb(150, 0, 80)', label: 'JMA 7' },
      ],
    },
    heatmap: {
      id: 'heatmap',
      label: t('layer.name.heatmap'),
      bundle: 'seismic',
      category: 'hazard',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: 'rgb(30, 60, 120)', label: t('layer.legend.heatLow') },
        { color: 'rgb(120, 180, 240)', label: t('layer.legend.heatModerate') },
        { color: 'rgb(255, 255, 255)', label: t('layer.legend.heatHigh') },
      ],
    },
    faults: {
      id: 'faults',
      label: t('layer.name.faults'),
      bundle: 'seismic',
      category: 'hazard',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: '#ef4444', label: t('layer.legend.activeFaultTrace') },
      ],
    },
    ais: {
      id: 'ais',
      label: t('layer.name.ais'),
      bundle: 'maritime',
      category: 'realtime',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: '#22d3ee', label: t('layer.legend.vessel') },
        { color: '#fbbf24', label: t('layer.legend.inImpactZone') },
      ],
    },
    rail: {
      id: 'rail',
      label: t('layer.name.rail'),
      bundle: 'lifelines',
      category: 'infrastructure',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: '#6ee7b7', label: t('layer.legend.railLine') },
        { color: '#fbbf24', label: t('layer.legend.inShakeZone') },
      ],
    },
    airports: {
      id: 'airports',
      label: t('layer.name.airports'),
      bundle: 'lifelines',
      category: 'infrastructure',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: '#22d3ee', label: t('layer.legend.operational') },
        { color: '#fbbf24', label: t('layer.legend.inspectionPosture') },
        { color: '#ef4444', label: t('layer.legend.closurePosture') },
      ],
    },
    transport: {
      id: 'transport',
      label: t('layer.name.transport'),
      bundle: 'lifelines',
      category: 'infrastructure',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: '#7dd3fc', label: t('layer.legend.shinkansenHubs') },
        { color: '#fbbf24', label: t('layer.legend.urbanTransferStress') },
      ],
    },
    power: {
      id: 'power',
      label: t('layer.name.power'),
      bundle: 'lifelines',
      category: 'infrastructure',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: '#facc15', label: t('layer.legend.powerFacility') },
        { color: '#ef4444', label: t('layer.legend.highExposure') },
      ],
    },
    water: {
      id: 'water',
      label: t('layer.name.water'),
      bundle: 'lifelines',
      category: 'infrastructure',
      availability: 'planned',
      defaultVisible: false,
    },
    telecom: {
      id: 'telecom',
      label: t('layer.name.telecom'),
      bundle: 'lifelines',
      category: 'infrastructure',
      availability: 'planned',
      defaultVisible: false,
    },
    hospitals: {
      id: 'hospitals',
      label: t('layer.name.hospitals'),
      bundle: 'medical',
      category: 'infrastructure',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: '#a78bfa', label: t('layer.legend.hospital') },
        { color: '#ef4444', label: t('layer.legend.highExposure') },
      ],
    },
    buildings: {
      id: 'buildings',
      label: t('layer.name.buildings'),
      bundle: 'built-environment',
      category: 'built-environment',
      availability: 'live',
      defaultVisible: true,
      legend: [
        { color: 'rgb(35, 45, 55)', label: t('layer.legend.buildingNeutral') ?? 'Building' },
        { color: 'rgb(255, 200, 30)', label: 'JMA 5-' },
        { color: 'rgb(255, 80, 20)', label: 'JMA 6-' },
        { color: 'rgb(153, 0, 153)', label: 'JMA 7' },
      ],
    },
  };
}

let _cache: Record<LayerId, LayerDefinition> | null = null;

function getDefs(): Record<LayerId, LayerDefinition> {
  if (!_cache) _cache = buildLayerDefinitions();
  return _cache;
}

export function getLayerDefinition(id: LayerId): LayerDefinition {
  return getDefs()[id];
}

export function getAllLayerDefinitions(): LayerDefinition[] {
  return Object.values(getDefs());
}

/** Invalidate cache on locale change — called by i18n bootstrap */
export function invalidateLayerDefinitionCache(): void {
  _cache = null;
}
