import { describe, expect, it } from 'vitest';

import { renderLabView } from '../templates';

describe('renderLabView', () => {
  it('renders only console and lab primary routes', () => {
    const html = renderLabView('calm', 'console');

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/lab"');
    expect(html).not.toContain('href="/legacy"');
    expect(html).toContain('>Console<');
  });
});
