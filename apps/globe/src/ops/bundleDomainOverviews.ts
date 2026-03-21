import type {
  OperatorBundleDomainOverrides,
  OperatorBundleDomainOverviews,
  OperatorBundleId,
  OperatorBundleTrust,
  RealtimeComponentStatus,
} from './readModelTypes';
import type { OpsAsset, OpsAssetExposure, OpsPriority } from './types';
import type { EarthquakeEvent, RailLineStatus } from '../types';
import {
  BUNDLE_OVERVIEW_DEFINITIONS,
  buildOverrideOverview,
  buildOverview,
  withAuthoritativeLifelineDomain,
} from './bundleDomains/shared';
import { withPowerDomain, withRailDomain, withWaterDomain } from './bundleDomains/lifelines';

export { filterScopedDomainOverrides } from './bundleDomains/shared';

export function buildDefaultBundleDomainOverviews(input: {
  priorities: OpsPriority[];
  exposures: OpsAssetExposure[];
  assets: OpsAsset[];
  trustLevel: Exclude<OperatorBundleTrust, 'pending'>;
  selectedEvent?: EarthquakeEvent | null;
  railStatuses?: RailLineStatus[];
  railComponent?: RealtimeComponentStatus;
  includeMedicalOverview?: boolean;
  includeRailDomain?: boolean;
  includePowerDomain?: boolean;
  includeWaterDomain?: boolean;
}): OperatorBundleDomainOverviews {
  const overviews = BUNDLE_OVERVIEW_DEFINITIONS.reduce<OperatorBundleDomainOverviews>((acc, definition) => {
    acc[definition.bundleId] = buildOverview({
      bundleId: definition.bundleId,
      priorities: input.priorities,
      exposures: input.exposures,
      assets: input.assets,
      classes: definition.classes,
      defaultMetricLabel: definition.defaultMetricLabel,
      counterLabel: definition.counterLabel,
      regionSignalId: definition.regionSignalId,
      trust: input.trustLevel,
    });
    return acc;
  }, {});

  if (input.includeMedicalOverview === false) {
    delete overviews.medical;
  }

  if (input.includeRailDomain !== false) {
    overviews.lifelines = withRailDomain(
      overviews.lifelines,
      input.railStatuses,
      input.trustLevel,
      input.railComponent,
    );
  }
  if (input.includeWaterDomain !== false) {
    overviews.lifelines = withWaterDomain({
      baseOverview: overviews.lifelines,
      selectedEvent: input.selectedEvent,
      priorities: input.priorities,
      exposures: input.exposures,
      assets: input.assets,
      trust: input.trustLevel,
    });
  }
  if (input.includePowerDomain !== false) {
    overviews.lifelines = withPowerDomain({
      baseOverview: overviews.lifelines,
      selectedEvent: input.selectedEvent,
      priorities: input.priorities,
      exposures: input.exposures,
      assets: input.assets,
      trust: input.trustLevel,
    });
  }

  return overviews;
}

export function mergeBundleDomainOverrides(input: {
  overviews: OperatorBundleDomainOverviews;
  domainOverrides?: OperatorBundleDomainOverrides;
  trust: Exclude<OperatorBundleTrust, 'pending'>;
}): OperatorBundleDomainOverviews {
  const next = { ...input.overviews };
  const lifelineDomains = input.domainOverrides?.lifelines ?? [];

  if (lifelineDomains.length > 0) {
    let lifelines = next.lifelines;
    for (const domain of lifelineDomains) {
      lifelines = withAuthoritativeLifelineDomain({
        baseOverview: lifelines,
        overrideDomain: domain,
        trust: input.trust,
        summarySignal: domain.signals[0],
      });
    }

    if (lifelines) {
      next.lifelines = lifelines;
    }
  }

  for (const bundleId of Object.keys(input.domainOverrides ?? {}) as OperatorBundleId[]) {
    if (bundleId === 'lifelines') {
      continue;
    }

    const domains = input.domainOverrides?.[bundleId];
    const overview = buildOverrideOverview(domains);
    if (overview) {
      next[bundleId] = overview;
    }
  }

  return next;
}
