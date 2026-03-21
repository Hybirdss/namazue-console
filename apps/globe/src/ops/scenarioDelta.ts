import type { ScenarioDelta } from './readModelTypes';
import type { OpsAssetExposure, OpsPriority, OpsScenarioShift } from './types';

interface BuildScenarioDeltaInput {
  previousExposures: OpsAssetExposure[];
  nextExposures: OpsAssetExposure[];
  previousPriorities: OpsPriority[];
  nextPriorities: OpsPriority[];
  scenarioShift: OpsScenarioShift;
}

const scenarioDeltaCache = new Map<string, ScenarioDelta>();

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function buildChangeSummary(shift: OpsScenarioShift): string[] {
  return [
    `Magnitude ${formatSigned(shift.magnitudeDelta)}`,
    `Depth ${formatSigned(shift.depthDeltaKm)} km`,
    `Latitude shift ${formatSigned(shift.latShiftDeg)}°`,
    `Longitude shift ${formatSigned(shift.lngShiftDeg)}°`,
  ];
}

export function buildScenarioDelta(input: BuildScenarioDeltaInput): ScenarioDelta {
  const previousExposuresById = new Map(input.previousExposures.map((entry) => [entry.assetId, entry]));
  const previousPrioritiesById = new Map(input.previousPriorities.map((entry) => [entry.id, entry]));
  const previousPriorityIndex = new Map(input.previousPriorities.map((entry, index) => [entry.id, index]));

  const exposureChanges = input.nextExposures.flatMap((entry) => {
    const previous = previousExposuresById.get(entry.assetId);
    if (!previous || previous.severity !== entry.severity) {
      return [{
        assetId: entry.assetId,
        from: previous?.severity ?? 'none',
        to: entry.severity,
      }];
    }
    return [];
  });

  const priorityChanges = input.nextPriorities.flatMap((entry, index) => {
    const previousIndex = previousPriorityIndex.get(entry.id);
    const previous = previousPrioritiesById.get(entry.id);
    if (
      previousIndex === undefined ||
      previousIndex !== index ||
      previous?.severity !== entry.severity ||
      previous?.rationale !== entry.rationale
    ) {
      return [{
        id: entry.id,
        from: previousIndex ?? -1,
        to: index,
      }];
    }
    return [];
  });

  const reasons = Array.from(new Set([
    ...input.nextExposures.flatMap((entry) => entry.reasons),
    ...input.nextPriorities.map((entry) => entry.rationale),
  ])).slice(0, 4);

  return {
    changeSummary: buildChangeSummary(input.scenarioShift),
    exposureChanges,
    priorityChanges,
    reasons,
  };
}

function summarizeExposureForCache(entry: OpsAssetExposure): string {
  return `${entry.assetId}:${entry.severity}:${Math.round(entry.score)}:${entry.reasons.join('|')}`;
}

function summarizePriorityForCache(entry: OpsPriority): string {
  return `${entry.id}:${entry.assetId ?? ''}:${entry.severity}:${entry.rationale}`;
}

function buildScenarioDeltaCacheKey(input: BuildScenarioDeltaInput): string {
  return [
    `m:${input.scenarioShift.magnitudeDelta}`,
    `d:${input.scenarioShift.depthDeltaKm}`,
    `la:${input.scenarioShift.latShiftDeg}`,
    `ln:${input.scenarioShift.lngShiftDeg}`,
    `pe:${input.previousExposures.map(summarizeExposureForCache).join(',')}`,
    `ne:${input.nextExposures.map(summarizeExposureForCache).join(',')}`,
    `pp:${input.previousPriorities.map(summarizePriorityForCache).join(',')}`,
    `np:${input.nextPriorities.map(summarizePriorityForCache).join(',')}`,
  ].join(';');
}

export function buildScenarioDeltaCached(input: BuildScenarioDeltaInput): ScenarioDelta {
  const key = buildScenarioDeltaCacheKey(input);
  const cached = scenarioDeltaCache.get(key);
  if (cached) {
    return cached;
  }

  const computed = buildScenarioDelta(input);
  scenarioDeltaCache.set(key, computed);
  return computed;
}

export function invalidateScenarioDeltaCache(): void {
  scenarioDeltaCache.clear();
}
