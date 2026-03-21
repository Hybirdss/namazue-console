import { GOVERNOR_STATES, type GovernorState } from './types.ts';
import { GOVERNED_SOURCES, getSourcePolicy, type GovernedSource } from './policies.ts';

export const PROJECTION_SECTION_SOURCE_ALLOWLIST = {
  events: ['events-db', 'legacy-snapshot'],
  governor: ['governor-db', 'legacy-snapshot'],
  maritime: ['maritime-hub', 'legacy-snapshot'],
  rail: ['odpt', 'legacy-snapshot'],
} as const;

export type ProjectionSectionKey = keyof typeof PROJECTION_SECTION_SOURCE_ALLOWLIST;

export interface ProjectionSectionSourceCompliance {
  expected_sources: readonly string[];
  observed_source: string | null;
  compliant: boolean;
}

export interface ProjectionSourceComplianceReport {
  status: 'ok' | 'drift';
  sections: Record<ProjectionSectionKey, ProjectionSectionSourceCompliance>;
}

interface RuntimeGovernedSourceDescriptor {
  source_class: string;
  cadence_mode: 'poll' | 'event-driven';
  refresh_ms: number | null;
}

export function buildGovernedSourcePolicyTable(
  state: GovernorState,
): Record<GovernedSource, RuntimeGovernedSourceDescriptor> {
  return GOVERNED_SOURCES.reduce<Record<GovernedSource, RuntimeGovernedSourceDescriptor>>((acc, source) => {
    const policy = getSourcePolicy(source, state);
    acc[source] = {
      source_class: policy.sourceClass,
      cadence_mode: policy.cadenceMode,
      refresh_ms: policy.refreshMs,
    };
    return acc;
  }, {} as Record<GovernedSource, RuntimeGovernedSourceDescriptor>);
}

export function isGovernorState(value: string): value is GovernorState {
  return (GOVERNOR_STATES as readonly string[]).includes(value);
}

export function buildRuntimeSourcesPayload(state: GovernorState) {
  return {
    state,
    states: [...GOVERNOR_STATES],
    governed_sources: buildGovernedSourcePolicyTable(state),
    projection_section_sources: PROJECTION_SECTION_SOURCE_ALLOWLIST,
  };
}

export function evaluateProjectionSectionSourceCompliance(input: {
  events?: string | null;
  governor?: string | null;
  maritime?: string | null;
  rail?: string | null;
}): ProjectionSourceComplianceReport {
  const sections = {
    events: buildProjectionSectionCompliance('events', input.events),
    governor: buildProjectionSectionCompliance('governor', input.governor),
    maritime: buildProjectionSectionCompliance('maritime', input.maritime),
    rail: buildProjectionSectionCompliance('rail', input.rail),
  };

  const status = Object.values(sections).some((entry) => !entry.compliant) ? 'drift' : 'ok';
  return { status, sections };
}

function buildProjectionSectionCompliance(
  key: ProjectionSectionKey,
  observedSource: string | null | undefined,
): ProjectionSectionSourceCompliance {
  const expectedSources: readonly string[] = PROJECTION_SECTION_SOURCE_ALLOWLIST[key];
  const normalizedObserved = normalizeSource(observedSource);
  const compliant = normalizedObserved === null || expectedSources.includes(normalizedObserved);

  return {
    expected_sources: expectedSources,
    observed_source: normalizedObserved,
    compliant,
  };
}

function normalizeSource(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
