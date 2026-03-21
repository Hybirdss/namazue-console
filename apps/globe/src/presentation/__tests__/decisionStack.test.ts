import { describe, expect, it } from 'vitest';

import type { ImpactIntelligence } from '../../ops/impactIntelligence';
import type { ServiceReadModel } from '../../ops/readModelTypes';
import { buildDecisionStackModel } from '../decisionStack';

function createReadModel(): ServiceReadModel {
  return {
    currentEvent: null,
    eventTruth: {
      source: 'server',
      revision: 'r2',
      issuedAt: Date.parse('2026-03-08T10:00:00.000Z'),
      receivedAt: Date.parse('2026-03-08T10:00:05.000Z'),
      observedAt: Date.parse('2026-03-08T10:00:00.000Z'),
      supersedes: 'r1',
      confidence: 'high',
      revisionCount: 2,
      sources: ['server'],
      hasConflictingRevision: false,
      divergenceSeverity: 'none',
      magnitudeSpread: 0,
      depthSpreadKm: 0,
      locationSpreadKm: 0,
      tsunamiMismatch: false,
      faultTypeMismatch: false,
    },
    viewport: null,
    nationalSnapshot: null,
    systemHealth: {
      level: 'nominal',
      headline: 'Nominal',
      detail: 'All sources healthy.',
      flags: [],
    },
    operationalOverview: {
      selectionReason: null,
      selectionSummary: 'Operational focus active',
      impactSummary: '1 assets in elevated posture',
      visibleAffectedAssetCount: 1,
      nationalAffectedAssetCount: 1,
      topRegion: 'kanto',
      topSeverity: 'critical',
    },
    bundleSummaries: {},
    nationalExposureSummary: [],
    visibleExposureSummary: [],
    nationalPriorityQueue: [],
    visiblePriorityQueue: [
      {
        id: 'priority-1',
        assetId: 'tokyo-port',
        severity: 'critical',
        title: 'Verify Port of Tokyo access',
        rationale: 'Strong shaking and coastal posture suggest immediate verification.',
      },
    ],
    freshnessStatus: {
      source: 'server',
      state: 'fresh',
      updatedAt: Date.parse('2026-03-08T10:00:00.000Z'),
      staleAfterMs: 60_000,
    },
  };
}

function createIntelligence(): ImpactIntelligence {
  return {
    peakIntensity: {
      value: 5.8,
      jmaClass: '6-',
      location: { lat: 35.6, lng: 139.7 },
    },
    landPeakIntensity: {
      value: 5.8,
      jmaClass: '6-',
      cityName: 'Tokyo',
      cityNameEn: 'Tokyo',
      population: 1_420_000,
    },
    areaStats: {
      jma7: 0,
      jma6plus: 240,
      jma6minus: 780,
      jma5plus: 1_540,
      jma5minus: 3_200,
      jma4plus: 8_800,
    },
    populationExposure: {
      jma7: 0,
      jma6plus: 182_000,
      jma6minus: 624_000,
      jma5plus: 1_320_000,
      jma5minus: 2_880_000,
      jma4plus: 4_200_000,
      jma3plus: 8_500_000,
      assessedUnits: 1_898,
      catalogedPopulation: 12_300_000,
      totalPopulation: 124_330_690,
      topAffected: [
        { name: 'Tokyo', nameEn: 'Tokyo', population: 1_420_000, intensity: 5.8, jmaClass: '6-' },
      ],
    },
    infraSummary: {
      hospitalsCompromised: 2,
      hospitalsDisrupted: 5,
      hospitalsOperational: 12,
      dmatBasesDeployable: 3,
      nuclearScramLikely: 0,
      nuclearScramPossible: 1,
      railLinesSuspended: 4,
      railLinesAffected: 8,
      vesselsHighPriority: 7,
      vesselsInZone: 19,
    },
    tsunamiETAs: [],
    responseTimeline: [],
  };
}

describe('buildDecisionStackModel', () => {
  it('emits ranked priority rows and matrix cards from read-model truth', () => {
    const model = buildDecisionStackModel({
      readModel: createReadModel(),
      impactIntelligence: createIntelligence(),
    });

    expect(model.priorityRows[0]?.rank).toBe(1);
    expect(model.priorityRows[0]?.trust).toBe('confirmed');
    expect(model.matrixCards.map((card) => card.id)).toEqual(
      expect.arrayContaining(['peak-intensity', 'population', 'infrastructure']),
    );
  });

  it('keeps the population matrix card semantic to totals and provenance, not a mixed city detail', () => {
    const model = buildDecisionStackModel({
      readModel: createReadModel(),
      impactIntelligence: createIntelligence(),
    });

    const populationCard = model.matrixCards.find((card) => card.id === 'population');
    expect(populationCard).toBeDefined();
    expect(populationCard?.detail).not.toContain('Tokyo');
    expect(populationCard?.detail.toLowerCase()).toContain('coverage');
  });
});
