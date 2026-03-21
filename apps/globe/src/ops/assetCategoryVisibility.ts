import type { OpsAssetClass } from './types';

export type AssetCategoryVisibility = Record<OpsAssetClass, boolean>;

export const ASSET_CATEGORY_IDS: OpsAssetClass[] = [
  'nuclear_plant',
  'airport',
  'port',
  'hospital',
  'rail_hub',
  'power_substation',
  'water_facility',
  'dam',
  'lng_terminal',
  'government_eoc',
  'telecom_hub',
  'evacuation_site',
  'building_cluster',
];

export function buildAssetCategoryVisibility(
  overrides: Partial<AssetCategoryVisibility> = {},
): AssetCategoryVisibility {
  const visibility = {} as AssetCategoryVisibility;

  for (const id of ASSET_CATEGORY_IDS) {
    visibility[id] = overrides[id] ?? true;
  }

  return visibility;
}

export function toggleAssetCategoryVisibility(
  visibility: AssetCategoryVisibility,
  assetClass: OpsAssetClass,
): AssetCategoryVisibility {
  return {
    ...visibility,
    [assetClass]: !visibility[assetClass],
  };
}

export function isAssetCategoryVisible(
  visibility: AssetCategoryVisibility,
  assetClass: OpsAssetClass,
): boolean {
  return visibility[assetClass] !== false;
}
