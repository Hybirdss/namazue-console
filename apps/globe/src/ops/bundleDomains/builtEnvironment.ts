import type { OperatorBundleDomainOverview, OperatorBundleTrust } from '../readModelTypes';
import type { OpsAsset, OpsAssetExposure, OpsPriority } from '../types';
import { getBundleAssetClasses } from '../assetClassRegistry';
import { t } from '../../i18n';
import { buildOverview } from './shared';

export function buildBuiltEnvironmentOverview(input: {
  priorities: OpsPriority[];
  exposures: OpsAssetExposure[];
  assets: OpsAsset[];
  trust: Exclude<OperatorBundleTrust, 'pending'>;
}): OperatorBundleDomainOverview | undefined {
  return buildOverview({
    bundleId: 'built-environment',
    priorities: input.priorities,
    exposures: input.exposures,
    assets: input.assets,
    classes: getBundleAssetClasses('built-environment'),
    defaultMetricLabel: t('overview.defaultMetric.builtEnv'),
    counterLabel: t('overview.counterLabel.buildingClusters'),
    regionSignalId: 'built-environment-region',
    trust: input.trust,
  });
}
