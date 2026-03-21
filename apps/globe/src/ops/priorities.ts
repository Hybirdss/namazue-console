import type { OpsAsset, OpsAssetExposure, OpsPriority } from './types';
import { getOpsAssetClassDefinition } from './assetClassRegistry';
import { t, tf } from '../i18n';
import { severityRank } from './severityUtils';

function titleForAsset(asset: OpsAsset): string {
  return getOpsAssetClassDefinition(asset.class).priorityTitle(asset);
}

function rationaleFor(asset: OpsAsset, exposure: OpsAssetExposure): string {
  // Prefer domain-specific smart rationale when available
  if (exposure.domainIntel?.smartRationale) {
    return exposure.domainIntel.smartRationale;
  }
  // Fallback to generic template
  const definition = getOpsAssetClassDefinition(asset.class);
  return tf('priority.rationale', {
    region: t(`region.${asset.region}`),
    classLabel: definition.label,
    severity: t(`severity.${exposure.severity}`),
    reasons: exposure.reasons.join(', '),
  });
}

export function buildOpsPriorities(input: {
  assets: OpsAsset[];
  exposures: OpsAssetExposure[];
}): OpsPriority[] {
  const assetById = new Map(input.assets.map((asset) => [asset.id, asset]));
  const priorities: OpsPriority[] = [];

  // Sort by severity descending so top-3 picks are the most critical
  const sorted = [...input.exposures]
    .filter((e) => e.severity !== 'clear')
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  for (const exposure of sorted) {

    const asset = assetById.get(exposure.assetId);
    if (!asset) {
      continue;
    }

    priorities.push({
      id: `priority-${asset.id}`,
      assetId: asset.id,
      severity: exposure.severity,
      title: titleForAsset(asset),
      rationale: rationaleFor(asset, exposure),
    });

    if (priorities.length === 3) {
      break;
    }
  }

  return priorities;
}
