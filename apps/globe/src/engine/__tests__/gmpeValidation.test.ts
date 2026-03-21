import { describe, expect, it } from 'vitest';

import { validateGmpe } from '../gmpe';

describe('validateGmpe', () => {
  it('does not mark large class misses as passing validation', () => {
    const results = validateGmpe();
    const kumamoto = results.find(
      (result) => result.label === 'Kumamoto 2016 (Mw 7.0)' && result.station === 'Kumamoto city',
    );

    expect(kumamoto).toBeDefined();
    expect(kumamoto?.computedClass).toBe('5+');
    expect(kumamoto?.expectedClass).toBe('7');
    expect(kumamoto?.pass).toBe(false);
  });
});
