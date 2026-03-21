import { describe, expect, it } from 'vitest';

import { buildDocsContent } from '../content';

describe('buildDocsContent', () => {
  it('returns the same section ids for all supported locales', () => {
    const ja = buildDocsContent('ja');
    const ko = buildDocsContent('ko');
    const en = buildDocsContent('en');

    expect(ja.sections.map((section) => section.id)).toEqual(
      ko.sections.map((section) => section.id),
    );
    expect(ja.sections.map((section) => section.id)).toEqual(
      en.sections.map((section) => section.id),
    );
  });

  it('keeps capability ids stable while allowing locale-specific copy', () => {
    const ja = buildDocsContent('ja');
    const en = buildDocsContent('en');

    expect(ja.capabilities.map((capability) => capability.id)).toEqual(
      en.capabilities.map((capability) => capability.id),
    );
    expect(ja.capabilities[0]?.title).not.toBe(en.capabilities[0]?.title);
  });
});
