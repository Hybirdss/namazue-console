import { describe, expect, it } from 'vitest';

import { LAB_TAB_IDS, resolveAppRoute, resolveLabTab } from '../routeModel';

describe('resolveAppRoute', () => {
  it('maps root to the live console shell', () => {
    expect(resolveAppRoute('/')).toBe('console');
    expect(resolveAppRoute('')).toBe('console');
  });

  it('maps /lab paths to the workbench', () => {
    expect(resolveAppRoute('/lab')).toBe('lab');
    expect(resolveAppRoute('/lab/')).toBe('lab');
  });

  it('treats /legacy paths as the default console after legacy removal', () => {
    expect(resolveAppRoute('/legacy')).toBe('console');
    expect(resolveAppRoute('/legacy/')).toBe('console');
    expect(resolveAppRoute('/legacy/archive')).toBe('console');
  });
});

describe('LAB_TAB_IDS', () => {
  it('keeps the approved workbench tab order stable', () => {
    expect(LAB_TAB_IDS).toEqual([
      'console',
      'design',
      'states',
      'components',
      'architecture',
      'voice',
    ]);
  });
});

describe('resolveLabTab', () => {
  it('defaults to console when no explicit lab tab is present', () => {
    expect(resolveLabTab('/lab')).toBe('console');
    expect(resolveLabTab('/lab/')).toBe('console');
  });

  it('resolves direct lab subpaths to the matching tab id', () => {
    expect(resolveLabTab('/lab/states')).toBe('states');
    expect(resolveLabTab('/lab/components')).toBe('components');
    expect(resolveLabTab('/lab/architecture')).toBe('architecture');
    expect(resolveLabTab('/lab/voice')).toBe('voice');
  });

  it('falls back to console for unknown lab subpaths', () => {
    expect(resolveLabTab('/lab/unknown')).toBe('console');
  });
});
