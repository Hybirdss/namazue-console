import type {
  OperatorProjection,
  ProjectionBuildInput,
  ProjectionSection,
  ProjectionSectionUpdate,
} from './projectionContracts.ts';
import { buildProjectionDomainOverrides } from './railDomainOverrides.ts';
import type { OpsAsset } from '../../../globe/src/ops/types.ts';

const EVENTS_STALE_AFTER_MS = 90_000;
const GOVERNOR_STALE_AFTER_MS = 90_000;
const MARITIME_STALE_AFTER_MS = 300_000;
const RAIL_STALE_AFTER_MS = 300_000;

const DEFAULT_MARITIME = { source: 'none', generated_at: 0, vessels: [] };
const DEFAULT_RAIL = { source: 'fallback', updatedAt: 0, lines: [] };

export type { OperatorProjection } from './projectionContracts.ts';

interface ProjectionReferenceData {
  assets?: OpsAsset[];
}

export function buildOperatorProjection(
  input: ProjectionBuildInput,
  referenceData: ProjectionReferenceData = {},
): OperatorProjection {
  const events = resolveSection(
    input.updates.events,
    input.previous?.sections.events as ProjectionSection<unknown[]> | undefined,
    input.now,
    [],
    EVENTS_STALE_AFTER_MS,
  );
  const governor = resolveSection(
    input.updates.governor,
    input.previous?.sections.governor as ProjectionSection<unknown> | undefined,
    input.now,
    null,
    GOVERNOR_STALE_AFTER_MS,
  );
  const maritime = resolveSection(
    input.updates.maritime,
    input.previous?.sections.maritime as ProjectionSection<unknown> | undefined,
    input.now,
    DEFAULT_MARITIME,
    MARITIME_STALE_AFTER_MS,
  );
  const rail = resolveSection(
    input.updates.rail,
    input.previous?.sections.rail as ProjectionSection<unknown> | undefined,
    input.now,
    DEFAULT_RAIL,
    RAIL_STALE_AFTER_MS,
  );

  const eventRows = Array.isArray(events.data) ? events.data : [];

  return {
    version: `projection-${input.now}`,
    generated_at: input.now,
    sections: {
      events,
      governor,
      maritime,
      rail,
    },
    domain_overrides: buildProjectionDomainOverrides({
      now: input.now,
      events,
      rail,
      assets: referenceData.assets ?? [],
    }),
    events: eventRows,
    count: eventRows.length,
    governor: governor.data,
    maritime: maritime.data,
    rail: rail.data,
    source_updated: {
      events: events.updated_at,
      maritime: maritime.updated_at,
      rail: rail.updated_at,
    },
  };
}

function resolveSection<T>(
  update: ProjectionSectionUpdate<T> | undefined,
  previous: ProjectionSection<T> | undefined,
  now: number,
  fallbackData: T,
  defaultStaleAfterMs: number,
): ProjectionSection<T> {
  if (update?.data !== undefined) {
    return {
      state: 'live',
      source: update.source,
      updated_at: now,
      last_success_at: now,
      stale_after_ms: update.stale_after_ms,
      last_error: null,
      data: update.data,
    };
  }

  if (update?.error) {
    if (previous) {
      return {
        ...previous,
        state: 'degraded',
        source: update.source,
        stale_after_ms: update.stale_after_ms,
        last_error: update.error,
      };
    }

    return {
      state: 'down',
      source: update.source,
      updated_at: 0,
      last_success_at: 0,
      stale_after_ms: update.stale_after_ms,
      last_error: update.error,
      data: update.fallbackData ?? fallbackData,
    };
  }

  if (previous) {
    return previous;
  }

  return {
    state: 'down',
    source: 'uninitialized',
    updated_at: 0,
    last_success_at: 0,
    stale_after_ms: defaultStaleAfterMs,
    last_error: 'projection section has not been published yet',
    data: fallbackData,
  };
}
