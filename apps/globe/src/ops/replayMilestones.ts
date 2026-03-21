import type { ReplayMilestone } from './readModelTypes';
import { t } from '../i18n';

interface ReplayMilestoneInput {
  eventSelectedAt: number | null;
  impactReadyAt: number | null;
  tsunamiReadyAt: number | null;
  exposuresReadyAt: number | null;
  prioritiesReadyAt: number | null;
}

const replayMilestoneCache = new Map<string, ReplayMilestone[]>();

const MILESTONE_ORDER: Array<{
  kind: ReplayMilestone['kind'];
  labelKey: string;
  pick: (input: ReplayMilestoneInput) => number | null;
}> = [
  {
    kind: 'event_locked',
    labelKey: 'milestone.eventLocked',
    pick: (input) => input.eventSelectedAt,
  },
  {
    kind: 'impact_ready',
    labelKey: 'milestone.impactReady',
    pick: (input) => input.impactReadyAt,
  },
  {
    kind: 'tsunami_ready',
    labelKey: 'milestone.tsunamiReady',
    pick: (input) => input.tsunamiReadyAt,
  },
  {
    kind: 'exposure_ready',
    labelKey: 'milestone.exposureReady',
    pick: (input) => input.exposuresReadyAt,
  },
  {
    kind: 'priorities_published',
    labelKey: 'milestone.prioritiesPublished',
    pick: (input) => input.prioritiesReadyAt,
  },
];

export function buildReplayMilestones(input: ReplayMilestoneInput): ReplayMilestone[] {
  return MILESTONE_ORDER.flatMap((definition) => {
    const at = definition.pick(input);
    if (at === null) {
      return [];
    }

    return [{
      kind: definition.kind,
      at,
      label: t(definition.labelKey),
    }];
  });
}

function buildReplayMilestoneCacheKey(input: ReplayMilestoneInput): string {
  return [
    input.eventSelectedAt ?? -1,
    input.impactReadyAt ?? -1,
    input.tsunamiReadyAt ?? -1,
    input.exposuresReadyAt ?? -1,
    input.prioritiesReadyAt ?? -1,
  ].join(':');
}

export function buildReplayMilestonesCached(input: ReplayMilestoneInput): ReplayMilestone[] {
  const key = buildReplayMilestoneCacheKey(input);
  const cached = replayMilestoneCache.get(key);
  if (cached) {
    return cached;
  }

  const computed = buildReplayMilestones(input);
  replayMilestoneCache.set(key, computed);
  return computed;
}

export function invalidateReplayMilestonesCache(): void {
  replayMilestoneCache.clear();
}
