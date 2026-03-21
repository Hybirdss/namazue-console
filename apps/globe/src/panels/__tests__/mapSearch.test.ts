import { describe, expect, it } from 'vitest';

import { renderMapSearchResultsMarkup, searchMunicipalities } from '../mapSearch';

describe('searchMunicipalities', () => {
  it('ranks curated city aliases ahead of raw municipality matches', () => {
    const results = searchMunicipalities('sendai', 5);

    expect(results[0]?.name).toBe('仙台市');
    expect(results[0]?.nameEn).toBe('Sendai');
  });

  it('supports Korean aliases for common cities', () => {
    const results = searchMunicipalities('도쿄', 5);

    expect(results[0]?.nameEn).toBe('Tokyo');
  });

  it('returns an empty list for blank queries', () => {
    expect(searchMunicipalities('   ', 5)).toEqual([]);
  });

  it('renders ranked results with both native and English labels', () => {
    const markup = renderMapSearchResultsMarkup(searchMunicipalities('sendai', 3));

    expect(markup).toContain('data-map-search-result="city-sendai"');
    expect(markup).toContain('仙台市');
    expect(markup).toContain('Sendai');
  });
});
