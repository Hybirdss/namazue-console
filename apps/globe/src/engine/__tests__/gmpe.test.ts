import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SITE_AMP_FACTOR,
  computePgv600,
  computeGmpe,
  haversine,
  jma05ThresholdKm,
  jmaThresholdDistanceKm,
  pgvSurfaceToJmaIntensity,
  toJmaClass,
} from '../gmpe';
import type { GmpeInput } from '../../types';

describe('haversine', () => {
  it('returns 0 for identical points', () => {
    expect(haversine(35, 135, 35, 135)).toBe(0);
  });

  it('computes Tokyo–Osaka distance (~400 km)', () => {
    const dist = haversine(35.6762, 139.6503, 34.6937, 135.5023);
    expect(dist).toBeGreaterThan(380);
    expect(dist).toBeLessThan(420);
  });
});

describe('computePgv600', () => {
  it('returns a positive PGV for valid input', () => {
    const input: GmpeInput = {
      Mw: 7.0,
      depth_km: 20,
      distance_km: 100,
      faultType: 'crustal',
    };
    expect(computePgv600(input)).toBeGreaterThan(0);
  });

  it('caps Mw at 9.5', () => {
    const base: GmpeInput = {
      Mw: 9.5,
      depth_km: 30,
      distance_km: 50,
      faultType: 'interface',
    };
    const over: GmpeInput = { ...base, Mw: 10.0 };
    expect(computePgv600(over)).toBeCloseTo(computePgv600(base), 5);
  });

  it('M9.0 produces higher PGV than M8.3', () => {
    const m83: GmpeInput = { Mw: 8.3, depth_km: 25, distance_km: 100, faultType: 'interface' };
    const m90: GmpeInput = { ...m83, Mw: 9.0 };
    expect(computePgv600(m90)).toBeGreaterThan(computePgv600(m83));
  });

  it('PGV decreases with distance', () => {
    const near: GmpeInput = { Mw: 6.5, depth_km: 10, distance_km: 20, faultType: 'crustal' };
    const far: GmpeInput = { ...near, distance_km: 200 };
    expect(computePgv600(near)).toBeGreaterThan(computePgv600(far));
  });
});

describe('computeGmpe', () => {
  it('returns all fields for a typical earthquake', () => {
    const result = computeGmpe({
      Mw: 7.0,
      depth_km: 10,
      distance_km: 50,
      faultType: 'crustal',
    });
    expect(result.pgv600).toBeGreaterThan(0);
    expect(result.pgv_surface).toBeCloseTo(result.pgv600 * DEFAULT_SITE_AMP_FACTOR, 3);
    expect(result.jmaIntensity).toBeCloseTo(pgvSurfaceToJmaIntensity(result.pgv_surface), 5);
    expect(result.jmaClass).toBeDefined();
  });
});

describe('toJmaClass', () => {
  it('classifies boundary values correctly', () => {
    expect(toJmaClass(0)).toBe('0');
    expect(toJmaClass(0.5)).toBe('1');
    expect(toJmaClass(4.5)).toBe('5-');
    expect(toJmaClass(5.0)).toBe('5+');
    expect(toJmaClass(6.5)).toBe('7');
  });
});

describe('jmaThresholdDistanceKm', () => {
  it('returns a value in the clamped range [20, 1200]', () => {
    const d = jmaThresholdDistanceKm(5.0, 10, 'crustal');
    expect(d).toBeGreaterThanOrEqual(20);
    expect(d).toBeLessThanOrEqual(1200);
  });

  it('threshold distance increases with magnitude', () => {
    const d50 = jmaThresholdDistanceKm(5.0, 10, 'crustal');
    const d70 = jmaThresholdDistanceKm(7.0, 10, 'crustal');
    expect(d70).toBeGreaterThan(d50);
  });

  it('accounts for depth: deep events have reduced reach due to depth saturation and increased attenuation', () => {
    // With depth correction (effectiveDepth saturation + anelastic attenuation increase),
    // deep intraslab events have LESS reach than shallow events at the same magnitude,
    // consistent with Zhao et al. (2006) and Kanno et al. (2006) observations.
    const dShallow = jmaThresholdDistanceKm(6.0, 5, 'crustal');
    const dDeep    = jmaThresholdDistanceKm(6.0, 200, 'crustal');
    // Deep events have shorter reach due to depth correction
    expect(dDeep).toBeLessThan(dShallow);
    // Both results stay within physically meaningful bounds
    expect(dShallow).toBeGreaterThanOrEqual(20);
    expect(dDeep).toBeGreaterThanOrEqual(20);
  });

  it('verifies JMA intensity at returned threshold is near the target', () => {
    const Mw = 6.5;
    const depth = 15;
    const target = 1.0; // default targetIntensity
    const d = jmaThresholdDistanceKm(Mw, depth, 'crustal', target);
    const X = Math.sqrt(d * d + depth * depth);
    const result = computeGmpe({ Mw, depth_km: depth, distance_km: X, faultType: 'crustal' });
    // Should be within 0.1 JMA units of the target
    expect(Math.abs(result.jmaIntensity - target)).toBeLessThan(0.1);
  });

  it('deprecated jma05ThresholdKm wrapper returns same result as new function with defaults', () => {
    const legacy = jma05ThresholdKm(6.0);
    const modern = jmaThresholdDistanceKm(6.0, 15, 'crustal', 0.5);
    expect(legacy).toBeCloseTo(modern, 1);
  });
});
