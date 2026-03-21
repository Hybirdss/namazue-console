/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const consoleCss = readFileSync(new URL('../console.css', import.meta.url), 'utf8');

function getRootBlock(css: string): string {
  const match = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (!match) {
    throw new Error('Could not find :root block in console.css');
  }

  return match[1];
}

function getVariable(name: string): string {
  const match = getRootBlock(consoleCss).match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`Could not find ${name} in console.css`);
  }

  return match[1].trim();
}

function getRuleBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = consoleCss.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  if (!match) {
    throw new Error(`Could not find selector ${selector} in console.css`);
  }

  return match[1];
}

function parseHex(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    throw new Error(`Unsupported hex color: ${hex}`);
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

function parseRgb(token: string): [number, number, number] {
  const match = token.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) {
    throw new Error(`Unsupported rgb token: ${token}`);
  }

  return [
    Number.parseInt(match[1], 10),
    Number.parseInt(match[2], 10),
    Number.parseInt(match[3], 10),
  ];
}

function resolveColorToken(
  token: string,
  background?: [number, number, number],
): [number, number, number] {
  if (token.startsWith('#')) {
    return parseHex(token);
  }

  if (token.startsWith('rgb(')) {
    return parseRgb(token);
  }

  if (token.startsWith('rgba(')) {
    const color = parseRgba(token);
    if (!background) {
      throw new Error(`Background is required to resolve alpha color token: ${token}`);
    }
    return blend(color.rgb, background, color.alpha);
  }

  throw new Error(`Unsupported color token: ${token}`);
}

function parseRgba(token: string): { rgb: [number, number, number]; alpha: number } {
  const match = token.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([0-9.]+)\)/);
  if (!match) {
    throw new Error(`Unsupported rgba token: ${token}`);
  }

  return {
    rgb: [
      Number.parseInt(match[1], 10),
      Number.parseInt(match[2], 10),
      Number.parseInt(match[3], 10),
    ],
    alpha: Number.parseFloat(match[4]),
  };
}

function blend(
  foreground: [number, number, number],
  background: [number, number, number],
  alpha: number,
): [number, number, number] {
  return foreground.map((channel, index) =>
    Math.round(channel * alpha + background[index] * (1 - alpha)),
  ) as [number, number, number];
}

function toLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

function getOpacity(selector: string): number {
  const match = getRuleBlock(selector).match(/opacity:\s*([0-9.]+);/);
  if (!match) {
    throw new Error(`Could not find opacity for selector ${selector}`);
  }

  return Number.parseFloat(match[1]);
}

describe('console text contrast', () => {
  const baseBackground = resolveColorToken(getVariable('--nz-bg-base'));
  const panelBackgroundToken = parseRgba(getVariable('--nz-panel-bg'));
  const panelBackground = blend(panelBackgroundToken.rgb, baseBackground, panelBackgroundToken.alpha);

  it('keeps text tokens readable against the panel surface', () => {
    expect(contrast(resolveColorToken(getVariable('--nz-text-primary'), panelBackground), panelBackground)).toBeGreaterThanOrEqual(12);
    expect(contrast(resolveColorToken(getVariable('--nz-text-secondary'), panelBackground), panelBackground)).toBeGreaterThanOrEqual(7);
    expect(contrast(resolveColorToken(getVariable('--nz-text-muted'), panelBackground), panelBackground)).toBeGreaterThanOrEqual(4.5);
  });

  it('does not fade important metadata text below readable opacity', () => {
    const textSelectors = [
      '.nz-snap__source',
      '.nz-settings__hint',
      '.nz-settings__shortcut-group-title',
      '.nz-settings__audit',
      '.nz-freshness__age',
      '.nz-intel__pop-source',
      '.nz-intel__source',
      '.nz-intel__timeline-item',
    ];

    for (const selector of textSelectors) {
      expect(getOpacity(selector), selector).toBeGreaterThanOrEqual(0.85);
    }
  });
});
