import type { OperatorBundleDomainOverview, OperatorBundleTrust } from '../readModelTypes';
import type { OpsAsset, OpsAssetExposure, OpsPriority } from '../types';
import { getBundleAssetClasses } from '../assetClassRegistry';
import { t } from '../../i18n';
import { buildOverview } from './shared';

export function buildMedicalOverview(input: {
  priorities: OpsPriority[];
  exposures: OpsAssetExposure[];
  assets: OpsAsset[];
  trust: Exclude<OperatorBundleTrust, 'pending'>;
}): OperatorBundleDomainOverview | undefined {
  return buildOverview({
    bundleId: 'medical',
    priorities: input.priorities,
    exposures: input.exposures,
    assets: input.assets,
    classes: getBundleAssetClasses('medical'),
    defaultMetricLabel: t('overview.defaultMetric.medical'),
    counterLabel: t('overview.counterLabel.sites'),
    regionSignalId: 'medical-region',
    trust: input.trust,
  });
}
