/**
 * Locale-aware asset display name.
 * Returns nameJa when locale is 'ja', falls back to English name.
 */

import { getLocale } from '../i18n';
import type { OpsAsset } from './types';

export function getAssetDisplayName(asset: OpsAsset): string {
  if (getLocale() === 'ja' && asset.nameJa) {
    return asset.nameJa;
  }
  return asset.name;
}
