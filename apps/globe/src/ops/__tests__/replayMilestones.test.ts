import { afterEach, describe, expect, it } from 'vitest';

import {
  buildReplayMilestones,
  buildReplayMilestonesCached,
  invalidateReplayMilestonesCache,
} from '../replayMilestones';

afterEach(() => {
  invalidateReplayMilestonesCache();
});

describe('buildReplayMilestones', () => {
  it('creates milestone entries for backend-known state changes', () => {
    const milestones = buildReplayMilestones({
      eventSelectedAt: 1_700_000_001_000,
      impactReadyAt: 1_700_000_003_000,
      tsunamiReadyAt: 1_700_000_003_500,
      exposuresReadyAt: 1_700_000_005_000,
      prioritiesReadyAt: 1_700_000_005_500,
    });

    expect(milestones.map((entry) => entry.kind)).toEqual([
      'event_locked',
      'impact_ready',
      'tsunami_ready',
      'exposure_ready',
      'priorities_published',
    ]);
  });

  it('omits missing milestones without breaking order', () => {
    const milestones = buildReplayMilestones({
      eventSelectedAt: 1_700_000_001_000,
      impactReadyAt: null,
      tsunamiReadyAt: 1_700_000_003_500,
      exposuresReadyAt: null,
      prioritiesReadyAt: null,
    });

    expect(milestones.map((entry) => entry.kind)).toEqual([
      'event_locked',
      'tsunami_ready',
    ]);
  });

  it('reuses cached milestone arrays until cache invalidation is requested', () => {
    const input = {
      eventSelectedAt: 1_700_000_001_000,
      impactReadyAt: 1_700_000_003_000,
      tsunamiReadyAt: 1_700_000_003_500,
      exposuresReadyAt: 1_700_000_005_000,
      prioritiesReadyAt: 1_700_000_005_500,
    } as const;

    const first = buildReplayMilestonesCached(input);
    const second = buildReplayMilestonesCached(input);
    expect(second).toBe(first);

    invalidateReplayMilestonesCache();
    const third = buildReplayMilestonesCached(input);
    expect(third).not.toBe(first);
    expect(third).toEqual(buildReplayMilestones(input));
  });
});
