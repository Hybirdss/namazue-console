import type { ScenarioKind, ScenarioMetric } from '../types';

interface MetricValidationResult {
  metric: ScenarioMetric;
  warnings: string[];
}

const ARRIVAL_LABEL_RE = /(arrival|eta|到達|도달)/i;
const HEIGHT_LABEL_RE = /(height|wave|津波高|높이)/i;

function hideMetric(metric: ScenarioMetric): ScenarioMetric {
  return {
    ...metric,
    status: 'hidden',
  };
}

export function validateScenarioMetric(
  metric: ScenarioMetric,
  scenarioKind: ScenarioKind,
): MetricValidationResult {
  const warnings: string[] = [];
  let nextMetric = metric;

  if (scenarioKind === 'historical_replay' && (metric.id === 'recurrence' || metric.id === 'probability30yr')) {
    warnings.push(`metric:${metric.id}:incompatible-scenario-kind`);
    nextMetric = hideMetric(nextMetric);
  }

  if (metric.claim === 'official' && !metric.provenance) {
    warnings.push(`metric:${metric.id}:missing-provenance`);
    nextMetric = hideMetric(nextMetric);
  }

  if (ARRIVAL_LABEL_RE.test(metric.label) && metric.unit === 'm') {
    warnings.push(`metric:${metric.id}:unit-label-mismatch`);
    nextMetric = hideMetric(nextMetric);
  }

  if (HEIGHT_LABEL_RE.test(metric.label) && metric.unit === 'min') {
    warnings.push(`metric:${metric.id}:unit-label-mismatch`);
    nextMetric = hideMetric(nextMetric);
  }

  return {
    metric: nextMetric,
    warnings,
  };
}

export function validateScenarioMetrics(
  metrics: Record<string, ScenarioMetric>,
  scenarioKind: ScenarioKind,
): { metrics: Record<string, ScenarioMetric>; warnings: string[] } {
  const nextMetrics: Record<string, ScenarioMetric> = {};
  const warnings: string[] = [];

  for (const [key, metric] of Object.entries(metrics)) {
    const result = validateScenarioMetric(metric, scenarioKind);
    nextMetrics[key] = result.metric;
    warnings.push(...result.warnings);
  }

  return {
    metrics: nextMetrics,
    warnings,
  };
}
