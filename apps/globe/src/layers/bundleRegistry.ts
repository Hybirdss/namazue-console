import {
  getAllLayerDefinitions,
  getLayerDefinition,
  type BundleId,
  type LayerId,
} from './layerRegistry';
import { t } from '../i18n';

export type BundleDensity = 'minimal' | 'standard' | 'dense';
export type OperatorViewId =
  | 'national-impact'
  | 'coastal-operations'
  | 'rail-stress'
  | 'medical-access'
  | 'built-environment';

export interface BundleSetting {
  enabled: boolean;
  density: BundleDensity;
}

export type BundleSettings = Record<BundleId, BundleSetting>;

export interface BundleDefinition {
  id: BundleId;
  label: string;
  description: string;
  layerIds: LayerId[];
}

export interface OperatorViewPreset {
  id: OperatorViewId;
  label: string;
  primaryBundle: BundleId;
  activeBundles: BundleId[];
}

function buildBundleDefinitions(): Record<BundleId, BundleDefinition> {
  return {
    seismic: {
      id: 'seismic',
      label: t('panel.operatorPulse.bundle.seismic'),
      description: t('bundle.desc.seismic'),
      layerIds: ['earthquakes', 'seismic-depth', 'intensity', 'heatmap', 'faults'],
    },
    maritime: {
      id: 'maritime',
      label: t('panel.operatorPulse.bundle.maritime'),
      description: t('bundle.desc.maritime'),
      layerIds: ['ais'],
    },
    lifelines: {
      id: 'lifelines',
      label: t('panel.operatorPulse.bundle.lifelines'),
      description: t('bundle.desc.lifelines'),
      layerIds: ['rail', 'airports', 'transport', 'power', 'water', 'telecom'],
    },
    medical: {
      id: 'medical',
      label: t('panel.operatorPulse.bundle.medical'),
      description: t('bundle.desc.medical'),
      layerIds: ['hospitals'],
    },
    'built-environment': {
      id: 'built-environment',
      label: t('panel.operatorPulse.bundle.builtEnvironment'),
      description: t('bundle.desc.builtEnv'),
      layerIds: ['buildings'],
    },
  };
}

function buildOperatorViewPresets(): Record<OperatorViewId, OperatorViewPreset> {
  return {
    'national-impact': {
      id: 'national-impact',
      label: t('view.nationalImpact'),
      primaryBundle: 'seismic',
      activeBundles: ['seismic', 'maritime'],
    },
    'coastal-operations': {
      id: 'coastal-operations',
      label: t('view.coastalOperations'),
      primaryBundle: 'maritime',
      activeBundles: ['seismic', 'maritime', 'lifelines'],
    },
    'rail-stress': {
      id: 'rail-stress',
      label: t('view.railStress'),
      primaryBundle: 'lifelines',
      activeBundles: ['seismic', 'lifelines'],
    },
    'medical-access': {
      id: 'medical-access',
      label: t('view.medicalAccess'),
      primaryBundle: 'medical',
      activeBundles: ['seismic', 'medical', 'lifelines'],
    },
    'built-environment': {
      id: 'built-environment',
      label: t('view.builtEnvironment'),
      primaryBundle: 'built-environment',
      activeBundles: ['seismic', 'built-environment'],
    },
  };
}

let _bundleDefinitions: Record<BundleId, BundleDefinition> | null = null;
let _viewPresets: Record<OperatorViewId, OperatorViewPreset> | null = null;

function getBundleDefs(): Record<BundleId, BundleDefinition> {
  if (!_bundleDefinitions) _bundleDefinitions = buildBundleDefinitions();
  return _bundleDefinitions;
}

function getViewPresets(): Record<OperatorViewId, OperatorViewPreset> {
  if (!_viewPresets) _viewPresets = buildOperatorViewPresets();
  return _viewPresets;
}

export function createDefaultBundleSettings(): BundleSettings {
  return {
    seismic: { enabled: true, density: 'standard' },
    maritime: { enabled: true, density: 'standard' },
    lifelines: { enabled: true, density: 'standard' },
    medical: { enabled: true, density: 'standard' },
    'built-environment': { enabled: false, density: 'minimal' },
  };
}

export function getBundleDefinition(id: BundleId): BundleDefinition {
  return getBundleDefs()[id];
}

export function getAllBundleDefinitions(): BundleDefinition[] {
  return Object.values(getBundleDefs());
}

export function getOperatorViewPreset(id: OperatorViewId): OperatorViewPreset {
  return getViewPresets()[id];
}

export function getAllOperatorViewPresets(): OperatorViewPreset[] {
  return Object.values(getViewPresets());
}

export function applyOperatorViewPreset(
  id: OperatorViewId,
  current: BundleSettings,
): BundleSettings {
  const preset = getOperatorViewPreset(id);
  const next = { ...current };

  for (const bundleId of Object.keys(getBundleDefs()) as BundleId[]) {
    next[bundleId] = {
      ...current[bundleId],
      enabled: preset.activeBundles.includes(bundleId),
    };
  }

  return next;
}

export function isLayerEffectivelyVisible(
  layerId: LayerId,
  layerVisible: boolean,
  bundleSettings: BundleSettings,
): boolean {
  if (!layerVisible) return false;
  const bundleId = getLayerDefinition(layerId).bundle;
  return bundleSettings[bundleId].enabled;
}

export function createDefaultLayerVisibility(): Record<LayerId, boolean> {
  return getAllLayerDefinitions().reduce<Record<LayerId, boolean>>((acc, definition) => {
    acc[definition.id] = definition.defaultVisible;
    return acc;
  }, {} as Record<LayerId, boolean>);
}

export function getBundleLayerLabels(bundleId: BundleId): string[] {
  return getBundleDefinition(bundleId).layerIds.map((layerId) => getLayerDefinition(layerId).label);
}
