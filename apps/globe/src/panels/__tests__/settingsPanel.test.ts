import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDefaultPreferences } from '../../core/preferences';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

async function importSettingsPanel() {
  vi.resetModules();
  return import('../settingsPanel');
}

function restoreNavigator(): void {
  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
    return;
  }

  delete (globalThis as { navigator?: Navigator }).navigator;
}

afterEach(() => {
  restoreNavigator();
});

describe('settings methodology references', () => {
  it('imports safely without navigator and falls back to Ctrl shortcuts', async () => {
    delete (globalThis as { navigator?: Navigator }).navigator;

    const { renderSettingsMarkup } = await importSettingsPanel();
    const markup = renderSettingsMarkup(getDefaultPreferences(), 'general');

    expect(markup).toContain('Ctrl+K');
  });

  it('renders the master reference list inside settings instead of the main console', () => {
    return importSettingsPanel().then(({ renderSettingsMarkup }) => {
      const markup = renderSettingsMarkup(getDefaultPreferences(), 'methodology');

      expect(markup).toContain('Methodology');
      expect(markup).toContain('Namazue Engine is built on the following academic models and public references.');
      expect(markup).toContain('Namazue is still in beta.');
      expect(markup).toContain('verify official releases and primary sources first');
      expect(markup).toContain('Master Reference List');
      expect(markup).toContain('Last audited: 2026-03-07');
      expect(markup).toContain('Si & Midorikawa');
      expect(markup).toContain('Wells & Coppersmith');
    });
  });

  it('renders expanded methodology references as clickable source links', () => {
    return importSettingsPanel().then(({ renderSettingsMarkup }) => {
      const markup = renderSettingsMarkup(getDefaultPreferences(), 'methodology');

      expect(markup).toContain('https://doi.org/10.1785/BSSA0840040974');
      expect(markup).toContain('https://doi.org/10.1126/science.aat4723');
      expect(markup).toContain('https://earthquake.usgs.gov/fdsnws/event/1/');
      expect(markup).toContain('https://www.data.jma.go.jp/eqev/data/bulletin/');
      expect(markup).toContain('https://www.j-shis.bosai.go.jp/');
      expect(markup).toContain('https://www.mlit.go.jp/plateau/en/');
      expect(markup).toContain('https://developer.odpt.org/');
      expect(markup).toContain('nz-settings__reference-link');
    });
  });
});
