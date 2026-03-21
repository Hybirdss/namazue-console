import type {
  ActiveFault,
  EarthquakeEvent,
  FaultType,
  ScenarioDefinition,
  ScenarioMetric,
} from '../types';
import { validateScenarioMetrics } from './metricValidation';

export interface ScenarioCatalog {
  faults: ActiveFault[];
  scenarios: ScenarioDefinition[];
}

function buildCentroid(segments: [number, number][]): { lat: number; lng: number } {
  if (segments.length === 0) {
    return { lat: 35.68, lng: 139.69 };
  }

  let latSum = 0;
  let lngSum = 0;
  for (const [lng, lat] of segments) {
    latSum += lat;
    lngSum += lng;
  }

  return {
    lat: latSum / segments.length,
    lng: lngSum / segments.length,
  };
}

function metric(
  id: string,
  label: string,
  value: string | number | null,
  unit: ScenarioMetric['unit'],
  overrides: Partial<ScenarioMetric> = {},
): ScenarioMetric {
  return {
    id,
    label,
    value,
    unit,
    status: 'ok',
    ...overrides,
  };
}

function finalizeScenario(
  scenario: Omit<ScenarioDefinition, 'warnings'> & { warnings?: string[] },
): ScenarioDefinition {
  const validated = validateScenarioMetrics(scenario.metrics, scenario.kind);
  return {
    ...scenario,
    metrics: validated.metrics,
    warnings: [...(scenario.warnings ?? []), ...validated.warnings],
  };
}

function buildDefaultProbabilisticScenario(fault: ActiveFault): ScenarioDefinition {
  return finalizeScenario({
    id: fault.id,
    faultId: fault.id,
    kind: 'probabilistic_scenario',
    name: fault.name,
    nameEn: fault.nameEn,
    event: {
      magnitude: fault.estimatedMw,
      depthKm: fault.depthKm,
      placeText: `${fault.name} (${fault.nameEn})`,
      time: null,
      tsunami: fault.faultType === 'interface' && fault.estimatedMw >= 8.0,
    },
    metrics: {
      recurrence: metric('recurrence', 'Recurrence interval', fault.interval, 'text', {
        claim: 'catalog',
        provenance: fault.source
          ? { kind: 'catalog', citation: fault.source, sourceLabel: 'HERP' }
          : undefined,
      }),
      probability30yr: metric('probability30yr', '30-year probability', fault.probability30yr, 'text', {
        claim: 'catalog',
        provenance: fault.source
          ? { kind: 'catalog', citation: fault.source, sourceLabel: 'HERP' }
          : undefined,
      }),
    },
  });
}

function buildHistoricalTohokuReplay(fault: ActiveFault): ScenarioDefinition {
  return finalizeScenario({
    id: 'historical-tohoku-2011',
    faultId: fault.id,
    kind: 'historical_replay',
    name: '東日本大震災 (2011)',
    nameEn: 'Great East Japan Earthquake (2011)',
    event: {
      magnitude: 9.0,
      depthKm: 24,
      placeText: 'Off the Pacific coast of Tohoku',
      time: Date.parse('2011-03-11T05:46:00.000Z'),
      tsunami: true,
      observedIntensity: '7',
      location: { lat: 38.322, lng: 142.369 },
    },
    metrics: {
      maxIntensity: metric('maxIntensity', 'Maximum intensity', '7', 'jma', {
        claim: 'official',
        provenance: {
          kind: 'official',
          citation: 'JMA 2011-03-11 Tohoku earthquake observed intensity records',
          sourceLabel: 'JMA',
        },
      }),
      landAffectedAreaKm2: metric('landAffectedAreaKm2', 'Inundated land area', 561, 'km2', {
        claim: 'official',
        provenance: {
          kind: 'official',
          citation: 'Geospatial Information Authority of Japan inundation estimate (2011)',
          sourceLabel: 'GSI',
        },
      }),
      tsunamiHeight: metric('tsunamiHeight', 'Maximum run-up', 40.5, 'm', {
        claim: 'official',
        provenance: {
          kind: 'official',
          citation: 'Cabinet Office tsunami run-up summary (2011)',
          sourceLabel: 'Cabinet Office',
        },
      }),
      recurrence: metric('recurrence', 'Recurrence interval', fault.interval, 'text', {
        claim: 'catalog',
        provenance: fault.source
          ? { kind: 'catalog', citation: fault.source, sourceLabel: 'HERP' }
          : undefined,
      }),
      probability30yr: metric('probability30yr', '30-year probability', fault.probability30yr, 'text', {
        claim: 'catalog',
        provenance: fault.source
          ? { kind: 'catalog', citation: fault.source, sourceLabel: 'HERP' }
          : undefined,
      }),
    },
  });
}

function buildJapanTrenchProbabilisticScenario(fault: ActiveFault): ScenarioDefinition {
  return finalizeScenario({
    id: 'japan-trench-probabilistic',
    faultId: fault.id,
    kind: 'probabilistic_scenario',
    name: `${fault.name} 長期評価`,
    nameEn: `${fault.nameEn} Long-term Scenario`,
    event: {
      magnitude: fault.estimatedMw,
      depthKm: fault.depthKm,
      placeText: `${fault.name} (${fault.nameEn})`,
      time: null,
      tsunami: true,
    },
    metrics: {
      recurrence: metric('recurrence', 'Recurrence interval', fault.interval, 'text', {
        claim: 'catalog',
        provenance: fault.source
          ? { kind: 'catalog', citation: fault.source, sourceLabel: 'HERP' }
          : undefined,
      }),
      probability30yr: metric('probability30yr', '30-year probability', fault.probability30yr, 'text', {
        claim: 'catalog',
        provenance: fault.source
          ? { kind: 'catalog', citation: fault.source, sourceLabel: 'HERP' }
          : undefined,
      }),
    },
  });
}

function buildSyntheticInvalidScenario(fault: ActiveFault): ScenarioDefinition {
  return finalizeScenario({
    id: fault.id,
    faultId: fault.id,
    kind: 'synthetic_scenario',
    name: fault.name,
    nameEn: fault.nameEn,
    event: {
      magnitude: fault.estimatedMw,
      depthKm: fault.depthKm,
      placeText: `${fault.name} (${fault.nameEn})`,
      time: null,
      tsunami: true,
    },
    metrics: {
      maxIntensity: metric('maxIntensity', 'Maximum intensity', '5+', 'jma', {
        claim: 'official',
      }),
      recurrence: metric('recurrence', 'Recurrence interval', fault.interval, 'text', {
        claim: 'catalog',
      }),
      probability30yr: metric('probability30yr', '30-year probability', fault.probability30yr, 'text', {
        claim: 'catalog',
      }),
      tsunamiArrival: metric('tsunamiArrival', 'Tsunami arrival estimate', 27, 'm', {
        claim: 'modeled',
      }),
    },
  });
}

export function buildScenarioCatalog(faults: ActiveFault[]): ScenarioCatalog {
  const scenarios: ScenarioDefinition[] = [];

  for (const fault of faults) {
    if (fault.id === 'japan-trench-tohoku') {
      scenarios.push(buildHistoricalTohokuReplay(fault));
      scenarios.push(buildJapanTrenchProbabilisticScenario(fault));
      continue;
    }

    if (fault.id === 'synthetic-invalid') {
      scenarios.push(buildSyntheticInvalidScenario(fault));
      continue;
    }

    scenarios.push(buildDefaultProbabilisticScenario(fault));
  }

  return {
    faults,
    scenarios,
  };
}

export function scenarioToEvent(
  scenario: ScenarioDefinition,
  fault: ActiveFault,
): EarthquakeEvent {
  const centroid = buildCentroid(fault.segments);
  const location = scenario.event.location ?? centroid;

  return {
    id: `scenario-${scenario.id}`,
    lat: location.lat,
    lng: location.lng,
    depth_km: scenario.event.depthKm,
    magnitude: scenario.event.magnitude,
    time: scenario.event.time ?? Date.now(),
    faultType: fault.faultType as FaultType,
    tsunami: scenario.event.tsunami,
    place: { text: scenario.event.placeText },
    source: scenario.kind === 'historical_replay' ? 'historical' : 'scenario',
    observedIntensity: scenario.event.observedIntensity ?? null,
    scenarioId: scenario.id,
    scenarioFaultId: fault.id,
    scenarioKind: scenario.kind,
  };
}
