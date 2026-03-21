import { getAllBundleDefinitions, getBundleDefinition, getOperatorViewPreset } from '../layers/bundleRegistry';
import type { ConsoleState } from '../core/store';
import type { BundleId } from '../layers/layerRegistry';
import { t } from '../i18n';

export interface CommandDeckControl {
  id: 'timeline' | 'view' | 'bundle' | 'density';
  label: string;
  value: string;
}

export interface CommandDeckBundleChip {
  id: BundleId;
  label: string;
  enabled: boolean;
  active: boolean;
}

export interface CommandDeckModel {
  density: 'minimal' | 'standard' | 'dense';
  viewportFact: string;
  controls: CommandDeckControl[];
  bundleChips: CommandDeckBundleChip[];
}

export function buildCommandDeckModel(state: ConsoleState): CommandDeckModel {
  const activeBundle = getBundleDefinition(state.activeBundleId);
  const activeView = getOperatorViewPreset(state.activeViewId);
  const density = state.bundleSettings[state.activeBundleId].density;

  return {
    density,
    viewportFact: `z${state.viewport.zoom.toFixed(1)} ${state.viewport.tier}`,
    controls: [
      { id: 'timeline', label: t('deck.timeline'), value: state.mode === 'event' ? t('deck.event') : t('deck.live') },
      { id: 'view', label: t('deck.view'), value: activeView.label },
      { id: 'bundle', label: t('deck.bundle'), value: activeBundle.label },
      { id: 'density', label: t('deck.density'), value: (() => {
        const densityMap: Record<string, string> = {
          minimal: t('bundle.density.minimal'),
          standard: t('bundle.density.standard'),
          dense: t('bundle.density.dense'),
        };
        return densityMap[density] ?? density;
      })() },
    ],
    bundleChips: getAllBundleDefinitions().map((bundle) => {
      const id = bundle.id;
      return {
        id,
        label: bundle.label,
        enabled: state.bundleSettings[id].enabled,
        active: state.activeBundleId === id,
      };
    }),
  };
}
