import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildTransform } from '../depthCrossSection';
import * as depthCrossSectionModule from '../depthCrossSection';

// Helper to create a default slice for testing (bearing=0, centered on Japan)
function testSlice() {
  const DEG_TO_RAD = Math.PI / 180;
  const azRad = 90 * DEG_TO_RAD; // bearing=0 → sliceAz=90°
  return {
    centerLat: 37,
    centerLng: 137,
    bearing: 0,
    sliceAzRad: azRad,
    sinAz: Math.sin(azRad),
    cosAz: Math.cos(azRad),
    cosLat: Math.cos(37 * DEG_TO_RAD),
  };
}

describe('buildTransform', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { devicePixelRatio: 1 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clamps hidden zero-sized canvases to a non-negative plot area', () => {
    const tf = buildTransform(0, 0, testSlice(), -1000, 1000);

    expect(tf.plotW).toBeGreaterThan(0);
    expect(tf.plotH).toBeGreaterThan(0);
    expect(Number.isFinite(tf.xToDist(52))).toBe(true);
    expect(Number.isFinite(tf.yToDepth(28))).toBe(true);
  });

  it('preserves the normal plot area for visible canvases', () => {
    const tf = buildTransform(640, 320, testSlice(), -1000, 1000);

    expect(tf.plotW).toBe(524);
    expect(tf.plotH).toBe(262);
  });

  it('projects events correctly at bearing=0 (E-W slice)', () => {
    const slice = testSlice();
    const tf = buildTransform(640, 320, slice, -1000, 1000);

    // Event at center should project to center of plot
    const centerX = tf.posToX(37, 137);
    const expectedCenter = 52 + tf.plotW / 2; // MARGIN.left + plotW/2
    expect(Math.abs(centerX - expectedCenter)).toBeLessThan(1);
  });
});

describe('magToRadius', () => {
  it('scales cross-section circles down for medium and large magnitudes', () => {
    const magToRadius = (depthCrossSectionModule as Record<string, unknown>).magToRadius;

    expect(typeof magToRadius).toBe('function');
    expect((magToRadius as (mag: number) => number)(4)).toBeCloseTo(2.0, 1);
    expect((magToRadius as (mag: number) => number)(6)).toBeCloseTo(6.05, 2);
    expect((magToRadius as (mag: number) => number)(8)).toBeCloseTo(19.13, 2);
  });
});
