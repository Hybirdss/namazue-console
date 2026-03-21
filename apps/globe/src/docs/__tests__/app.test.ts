// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { buildDocsContent } from '../content';
import { syncDocsHead } from '../app';

describe('syncDocsHead', () => {
  it('sets locale-aware title and canonical path for public docs routes', () => {
    document.head.innerHTML = `
      <title></title>
      <link rel="canonical" href="/" />
      <meta name="description" content="" />
      <meta property="og:title" content="" />
      <meta property="og:description" content="" />
      <meta property="og:url" content="" />
    `;

    syncDocsHead({
      locale: 'en',
      surface: 'public',
      path: '/en/docs',
      content: buildDocsContent('en'),
    });

    expect(document.title).toContain('Namazue');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://namazue.dev/en/docs');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      buildDocsContent('en').meta.description,
    );
    expect(document.querySelector('link[rel="alternate"][hreflang="ja"]')?.getAttribute('href')).toBe(
      'https://namazue.dev/ja/docs',
    );
  });
});
