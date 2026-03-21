/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const consoleCss = readFileSync(new URL('../console.css', import.meta.url), 'utf8');

describe('console responsive layout', () => {
  it('keeps responsive adjustments inside the shared console stylesheet', () => {
    expect(consoleCss).toContain('@media (max-width: 768px)');
    expect(consoleCss).toContain('@media (max-width: 480px)');
    expect(consoleCss).toContain('Settings — full bottom sheet');
    expect(consoleCss).toContain('Asset card — bottom sheet');
    expect(consoleCss).not.toContain('.nz-mobile-sheet');
  });
});
