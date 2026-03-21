import type { BundleId } from '../layers/layerRegistry';

const SHORTCUT_MAP: Record<string, BundleId> = {
  '1': 'seismic',
  '2': 'maritime',
  '3': 'lifelines',
  '4': 'medical',
  '5': 'built-environment',
};

export function getBundleIdForShortcutKey(key: string): BundleId | null {
  return SHORTCUT_MAP[key] ?? null;
}
