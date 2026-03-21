import { t, tf } from '../i18n';
import type { ImpactIntelligence } from '../ops/impactIntelligence';
import type { ServiceReadModel } from '../ops/readModelTypes';
import type { OpsSeverity } from '../ops/types';
import {
  formatMinutesShort,
  formatPopulationCoverage,
  formatPopulationShort,
} from '../utils/metricFormat';

export type DecisionTrust = 'confirmed' | 'review' | 'degraded';

export interface DecisionPriorityRow {
  rank: number;
  assetId: string | null;
  severity: OpsSeverity;
  action: string;
  rationale: string;
  trust: DecisionTrust;
}

export interface DecisionMatrixCard {
  id: 'peak-intensity' | 'population' | 'infrastructure' | 'tsunami';
  label: string;
  value: string;
  detail: string;
  severity: OpsSeverity;
}

export interface DecisionStackModel {
  priorityRows: DecisionPriorityRow[];
  matrixCards: DecisionMatrixCard[];
}

export interface DecisionStackInput {
  readModel: ServiceReadModel;
  impactIntelligence: ImpactIntelligence;
}

function severityFromJmaClass(jmaClass: string): OpsSeverity {
  if (jmaClass === '7' || jmaClass === '6+' || jmaClass === '6-') {
    return 'critical';
  }
  if (jmaClass === '5+' || jmaClass === '5-') {
    return 'priority';
  }
  if (jmaClass === '4' || jmaClass === '3') {
    return 'watch';
  }
  return 'clear';
}

function resolvePriorityTrust(readModel: ServiceReadModel): DecisionTrust {
  if (readModel.systemHealth.level === 'degraded') {
    return 'degraded';
  }

  const truth = readModel.eventTruth;
  if (
    readModel.systemHealth.level === 'watch'
    || truth?.hasConflictingRevision
    || truth?.divergenceSeverity === 'material'
    || truth?.confidence === 'low'
  ) {
    return 'review';
  }

  return 'confirmed';
}

function buildMatrixCards(intel: ImpactIntelligence): DecisionMatrixCard[] {
  const cards: DecisionMatrixCard[] = [];

  // Use land peak if available (more operationally relevant than epicentral peak)
  const effectivePeak = intel.landPeakIntensity ?? intel.peakIntensity;
  if (effectivePeak) {
    cards.push({
      id: 'peak-intensity',
      label: t('matrix.peakIntensity'),
      value: `JMA ${effectivePeak.jmaClass}`,
      detail: tf('matrix.instrumentalDetail', { n: effectivePeak.value.toFixed(1) }),
      severity: severityFromJmaClass(effectivePeak.jmaClass),
    });
  }

  const population = intel.populationExposure;
  if (population && population.jma3plus > 0) {
    cards.push({
      id: 'population',
      label: t('matrix.population'),
      value: formatPopulationShort(population.jma5minus),
      detail: formatPopulationCoverage(
        population.coverage?.catalogedPopulation ?? population.catalogedPopulation,
        population.coverage?.totalPopulation ?? population.totalPopulation,
      ),
      severity: population.jma6minus > 0 ? 'critical' : 'priority',
    });
  }

  if (intel.infraSummary) {
    const severeInfraCount = (
      intel.infraSummary.hospitalsCompromised
      + intel.infraSummary.railLinesSuspended
      + intel.infraSummary.nuclearScramLikely
      + intel.infraSummary.vesselsHighPriority
    );
    cards.push({
      id: 'infrastructure',
      label: t('matrix.infrastructure'),
      value: String(severeInfraCount),
      detail: tf('matrix.hospitalRail', { hospitals: intel.infraSummary.hospitalsCompromised, rail: intel.infraSummary.railLinesSuspended }),
      severity: severeInfraCount > 0 ? 'critical' : 'watch',
    });
  }

  const tsunamiArrivals = intel.tsunamiSummary?.arrivalEstimatesMin ?? intel.tsunamiETAs;
  if (tsunamiArrivals.length > 0) {
    const firstEta = [...tsunamiArrivals]
      .sort((left, right) => left.estimatedMinutes - right.estimatedMinutes)[0];
    cards.push({
      id: 'tsunami',
      label: t('matrix.tsunamiETA'),
      value: formatMinutesShort(firstEta.estimatedMinutes),
      detail: firstEta.portNameJa,
      severity: firstEta.estimatedMinutes <= 30 ? 'critical' : 'priority',
    });
  }

  return cards;
}

export function buildDecisionStackModel(input: DecisionStackInput): DecisionStackModel {
  return {
    priorityRows: buildDecisionPriorityRows(input.readModel),
    matrixCards: buildMatrixCards(input.impactIntelligence),
  };
}

export function buildDecisionPriorityRows(readModel: ServiceReadModel): DecisionPriorityRow[] {
  const priorities = readModel.visiblePriorityQueue.length > 0
    ? readModel.visiblePriorityQueue
    : readModel.nationalPriorityQueue;
  const trust = resolvePriorityTrust(readModel);

  return priorities.map((item, index) => ({
    rank: index + 1,
    assetId: item.assetId,
    severity: item.severity,
    action: item.title,
    rationale: item.rationale,
    trust,
  }));
}
