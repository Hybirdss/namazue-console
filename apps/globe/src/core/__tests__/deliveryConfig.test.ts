import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const headersPath = new URL('../../../public/_headers', import.meta.url);
const indexPath = new URL('../../../index.html', import.meta.url);

describe('globe delivery config', () => {
  it('allows WebAssembly for deck.gl while keeping analytics scripts out of CSP', () => {
    const headers = readFileSync(headersPath, 'utf8');

    expect(headers).toContain("'wasm-unsafe-eval'");
    expect(headers).toContain('https://assets.cms.plateau.reearth.io');
    expect(headers).not.toContain('static.cloudflareinsights.com');
    expect(headers).not.toContain('https://cloudflareinsights.com');
  });

  it('does not ship the Cloudflare beacon or mismatched font preload tags', () => {
    const html = readFileSync(indexPath, 'utf8');

    expect(html).not.toContain('cloudflareinsights');
    expect(html).not.toContain('rel="preload" href="https://fonts.googleapis.com');
  });
});
