export type ProjectionSectionState = 'live' | 'stale' | 'degraded' | 'down';

export type ProjectionSeverity = 'clear' | 'watch' | 'priority' | 'critical';
export type ProjectionBundleTrust = 'confirmed' | 'review' | 'degraded' | 'pending';
export type ProjectionBundleAvailability = 'live' | 'modeled' | 'planned';
export type ProjectionBundleId =
  | 'seismic'
  | 'maritime'
  | 'lifelines'
  | 'medical'
  | 'built-environment';

export interface ProjectionBundleCounter {
  id: string;
  label: string;
  value: number;
  tone: ProjectionSeverity;
}

export interface ProjectionBundleSignal {
  id: string;
  label: string;
  value: string;
  tone: ProjectionSeverity;
}

export interface ProjectionBundleDomain {
  id: string;
  label: string;
  metric: string;
  detail: string;
  eventId?: string | null;
  severity: ProjectionSeverity;
  availability: ProjectionBundleAvailability;
  trust: ProjectionBundleTrust;
  counters: ProjectionBundleCounter[];
  signals: ProjectionBundleSignal[];
}

export type ProjectionBundleDomainOverrides = Partial<Record<ProjectionBundleId, ProjectionBundleDomain[]>>;

export interface ProjectionSection<T> {
  state: ProjectionSectionState;
  source: string;
  updated_at: number;
  last_success_at: number;
  stale_after_ms: number;
  last_error: string | null;
  data: T;
}

export interface OperatorProjectionSections {
  events: ProjectionSection<unknown[]>;
  governor: ProjectionSection<unknown>;
  maritime: ProjectionSection<unknown>;
  rail: ProjectionSection<unknown>;
}

export interface OperatorProjection {
  version: string;
  generated_at: number;
  sections: OperatorProjectionSections;
  domain_overrides: ProjectionBundleDomainOverrides;
  events: unknown[];
  count: number;
  governor: unknown;
  maritime: unknown;
  rail: unknown;
  source_updated: {
    events: number;
    maritime: number;
    rail: number;
  };
}

export interface ProjectionSectionUpdate<T> {
  source: string;
  stale_after_ms: number;
  data?: T;
  error?: string;
  fallbackData?: T;
}

export interface ProjectionBuildInput {
  previous: OperatorProjection | null;
  now: number;
  updates: {
    events?: ProjectionSectionUpdate<unknown[]>;
    governor?: ProjectionSectionUpdate<unknown>;
    maritime?: ProjectionSectionUpdate<unknown>;
    rail?: ProjectionSectionUpdate<unknown>;
  };
}
