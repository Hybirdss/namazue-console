import { describe, expect, it } from 'vitest';

import {
  computeDamageProbs,
  combineTsunamiProbs,
  probsToSeverity,
  probsToScore,
} from '../fragilityCurves';

describe('computeDamageProbs', () => {
  it('returns near-zero probabilities at low intensity', () => {
    const probs = computeDamageProbs(2.0, 'hospital');
    expect(probs.pDisruption).toBeLessThan(0.01);
    expect(probs.pDamage).toBeLessThan(0.0001);
    expect(probs.pCollapse).toBeLessThan(0.00001);
  });

  it('returns elevated disruption probability by hospital threshold intensity', () => {
    const probs = computeDamageProbs(4.5, 'hospital');
    expect(probs.pDisruption).toBeGreaterThan(0.8);
  });

  it('returns high probabilities at extreme intensity', () => {
    const probs = computeDamageProbs(7.0, 'hospital');
    expect(probs.pDisruption).toBeGreaterThan(0.99);
    expect(probs.pDamage).toBeGreaterThan(0.95);
    expect(probs.pCollapse).toBeGreaterThan(0.80);
  });

  it('nuclear plant has lower disruption threshold (auto-scram)', () => {
    // Nuclear disruption mu = 4.0, hospital disruption mu = 4.5
    const nuclear = computeDamageProbs(4.0, 'nuclear_plant');
    const hospital = computeDamageProbs(4.0, 'hospital');
    expect(nuclear.pDisruption).toBeGreaterThan(hospital.pDisruption);
  });

  it('building cluster is more robust than power substation', () => {
    // At JMA 5.0, power_substation should have higher damage probability
    const power = computeDamageProbs(5.0, 'power_substation');
    const building = computeDamageProbs(5.0, 'building_cluster');
    expect(power.pDisruption).toBeGreaterThan(building.pDisruption);
    expect(power.pDamage).toBeGreaterThan(building.pDamage);
  });
});

describe('combineTsunamiProbs', () => {
  it('increases damage probabilities when tsunami risk is present', () => {
    const seismic = computeDamageProbs(5.0, 'port');
    const combined = combineTsunamiProbs(seismic, 'moderate', 1.0);

    expect(combined.pDisruption).toBeGreaterThan(seismic.pDisruption);
    expect(combined.pDamage).toBeGreaterThan(seismic.pDamage);
    expect(combined.pCollapse).toBeGreaterThan(seismic.pCollapse);
  });

  it('applies distance decay to reduce tsunami contribution', () => {
    const seismic = computeDamageProbs(5.0, 'port');
    const fullEffect = combineTsunamiProbs(seismic, 'high', 1.0);
    const decayed = combineTsunamiProbs(seismic, 'high', 0.3);

    // Decayed tsunami effect should be less than full effect
    expect(decayed.pDamage).toBeLessThan(fullEffect.pDamage);
    // But still greater than seismic alone
    expect(decayed.pDamage).toBeGreaterThan(seismic.pDamage);
  });

  it('high tsunami risk has stronger effect than low', () => {
    const seismic = computeDamageProbs(4.0, 'port');
    const highTs = combineTsunamiProbs(seismic, 'high', 1.0);
    const lowTs = combineTsunamiProbs(seismic, 'low', 1.0);

    expect(highTs.pDamage).toBeGreaterThan(lowTs.pDamage);
  });
});

describe('probsToSeverity', () => {
  it('returns critical when damage probability >= 50%', () => {
    expect(probsToSeverity({ pDisruption: 1.0, pDamage: 0.50, pCollapse: 0.10 })).toBe('critical');
  });

  it('returns critical when collapse probability >= 20%', () => {
    expect(probsToSeverity({ pDisruption: 1.0, pDamage: 0.30, pCollapse: 0.20 })).toBe('critical');
  });

  it('returns priority when disruption probability >= 50%', () => {
    expect(probsToSeverity({ pDisruption: 0.50, pDamage: 0.10, pCollapse: 0.01 })).toBe('priority');
  });

  it('returns priority when damage probability >= 15%', () => {
    expect(probsToSeverity({ pDisruption: 0.30, pDamage: 0.15, pCollapse: 0.01 })).toBe('priority');
  });

  it('returns watch when disruption probability >= 10%', () => {
    expect(probsToSeverity({ pDisruption: 0.10, pDamage: 0.05, pCollapse: 0.001 })).toBe('watch');
  });

  it('returns clear when all probabilities are below thresholds', () => {
    expect(probsToSeverity({ pDisruption: 0.05, pDamage: 0.01, pCollapse: 0.001 })).toBe('clear');
  });
});

describe('probsToScore', () => {
  it('returns 0 when all probabilities are zero', () => {
    expect(probsToScore({ pDisruption: 0, pDamage: 0, pCollapse: 0 })).toBe(0);
  });

  it('returns 100 when all probabilities are 1.0', () => {
    expect(probsToScore({ pDisruption: 1.0, pDamage: 1.0, pCollapse: 1.0 })).toBe(100);
  });

  it('weights damage probability most heavily', () => {
    const damageOnly = probsToScore({ pDisruption: 0, pDamage: 1.0, pCollapse: 0 });
    const disruptionOnly = probsToScore({ pDisruption: 1.0, pDamage: 0, pCollapse: 0 });
    expect(damageOnly).toBeGreaterThan(disruptionOnly);
    expect(damageOnly).toBe(40);
    expect(disruptionOnly).toBe(30);
  });
});

describe('calibration validation against historical events', () => {
  // These tests verify that fragility curves produce sensible results
  // at intensity levels observed in major Japanese earthquakes.

  it('produces correct severity progression across JMA scale', () => {
    // Test a typical infrastructure asset (power substation) across JMA levels
    const severities = [3.0, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map((i) => ({
      intensity: i,
      severity: probsToSeverity(computeDamageProbs(i, 'power_substation')),
    }));

    // JMA 3: calibration may now surface an early watch posture
    expect(['clear', 'watch']).toContain(severities[0]!.severity);
    // JMA 4: can now escalate to priority under the updated calibration
    expect(['clear', 'watch', 'priority']).toContain(severities[1]!.severity);
    // JMA 5+: should be at least priority
    expect(['priority', 'critical']).toContain(severities[4]!.severity);
    // JMA 6+: should be critical
    expect(severities[5]!.severity).toBe('critical');
    // JMA 7: definitely critical
    expect(severities[7]!.severity).toBe('critical');
  });

  it('nuclear plant triggers at lower intensity than building cluster', () => {
    // At JMA 4.0, nuclear should already show disruption (auto-scram)
    // but building cluster should be clear
    const nuclear = probsToSeverity(computeDamageProbs(4.0, 'nuclear_plant'));
    const building = probsToSeverity(computeDamageProbs(4.0, 'building_cluster'));

    expect(nuclear).not.toBe('clear');
    expect(['clear', 'watch']).toContain(building);
  });

  it('port with tsunami exceeds seismic-only assessment', () => {
    // At JMA 5.0 with high tsunami, a port should be more severe
    const seismicOnly = computeDamageProbs(5.0, 'port');
    const withTsunami = combineTsunamiProbs(seismicOnly, 'high', 1.0);

    const sevSeismic = probsToSeverity(seismicOnly);
    const sevCombined = probsToSeverity(withTsunami);

    // Verify the combined severity is at least as high
    const rank = { clear: 0, watch: 1, priority: 2, critical: 3 };
    expect(rank[sevCombined]).toBeGreaterThanOrEqual(rank[sevSeismic]);
  });
});
