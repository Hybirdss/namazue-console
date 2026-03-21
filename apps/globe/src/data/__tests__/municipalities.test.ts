import { describe, expect, it } from 'vitest';

import {
  CATALOGED_POPULATION,
  COVERAGE_RATIO,
  JAPAN_TOTAL_POPULATION,
  MUNICIPALITIES,
} from '../municipalities';

describe('municipalities dataset', () => {
  it('uses the full official 2025-01-01 resident registry population', () => {
    expect(JAPAN_TOTAL_POPULATION).toBe(124_330_690);
    expect(CATALOGED_POPULATION).toBe(124_330_690);
    expect(COVERAGE_RATIO).toBe(1);
    expect(MUNICIPALITIES).toHaveLength(1_898);
    expect(MUNICIPALITIES.some((municipality) => municipality.name === '札幌市')).toBe(false);
    expect(MUNICIPALITIES.some((municipality) => municipality.name === '札幌市中央区')).toBe(true);
  });
});
