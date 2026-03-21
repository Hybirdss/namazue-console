/**
 * Map Legend — Compact infrastructure asset + JMA intensity legend.
 *
 * Positioned bottom-left of the map, to the right of the left rail.
 * Two modes:
 *   1. Collapsed: click "▶ Legend" to expand asset categories
 *   2. JMA intensity bar: auto-shown when intensity grid is active
 *
 * The JMA bar always shows when an earthquake is selected — it's the
 * primary visual key for interpreting the intensity heatmap overlay.
 */

import { consoleStore } from '../core/store';
import type { AssetCategoryVisibility } from '../ops/assetCategoryVisibility';
import { toggleAssetCategoryVisibility } from '../ops/assetCategoryVisibility';
import type { OpsAssetClass } from '../ops/types';
import type { IntensityGrid } from '../types';
import { ICON_CATEGORY_COLORS } from '../layers/iconAtlas';
import { t } from '../i18n';

// ── Asset category definitions ──────────────────────────────

interface AssetCategoryDef {
  id: OpsAssetClass;
  labelKey: string;
  fallbackLabel: string;
}

const ASSET_CATEGORIES: AssetCategoryDef[] = [
  { id: 'nuclear_plant',    labelKey: 'legend.asset.nuclear',    fallbackLabel: 'Nuclear' },
  { id: 'airport',          labelKey: 'legend.asset.airport',    fallbackLabel: 'Airport' },
  { id: 'port',             labelKey: 'legend.asset.port',       fallbackLabel: 'Port' },
  { id: 'hospital',         labelKey: 'legend.asset.hospital',   fallbackLabel: 'Hospital' },
  { id: 'rail_hub',         labelKey: 'legend.asset.rail',       fallbackLabel: 'Rail Hub' },
  { id: 'power_substation', labelKey: 'legend.asset.power',      fallbackLabel: 'Power' },
  { id: 'water_facility',   labelKey: 'legend.asset.water',      fallbackLabel: 'Water' },
  { id: 'dam',              labelKey: 'legend.asset.dam',        fallbackLabel: 'Dam' },
  { id: 'lng_terminal',     labelKey: 'legend.asset.lng',        fallbackLabel: 'LNG' },
  { id: 'government_eoc',   labelKey: 'legend.asset.eoc',       fallbackLabel: 'Gov EOC' },
  { id: 'telecom_hub',      labelKey: 'legend.asset.telecom',   fallbackLabel: 'Telecom' },
  { id: 'evacuation_site',  labelKey: 'legend.asset.evacuation', fallbackLabel: 'Evacuation' },
  { id: 'building_cluster', labelKey: 'legend.asset.building',   fallbackLabel: 'Buildings' },
];

// ── JMA intensity scale ─────────────────────────────────────

const JMA_LEVELS: Array<{ min: number; label: string; color: string }> = [
  { min: 0.5, label: '1',    color: 'rgb(102,153,204)' },
  { min: 1.5, label: '2',    color: 'rgb(51,153,204)' },
  { min: 2.5, label: '3',    color: 'rgb(51,204,102)' },
  { min: 3.5, label: '4',    color: 'rgb(255,255,0)' },
  { min: 4.5, label: '5\u5F31', color: 'rgb(255,153,0)' },
  { min: 5.0, label: '5\u5F37', color: 'rgb(255,102,0)' },
  { min: 5.5, label: '6\u5F31', color: 'rgb(255,51,0)' },
  { min: 6.0, label: '6\u5F37', color: 'rgb(204,0,0)' },
  { min: 6.5, label: '7',    color: 'rgb(153,0,153)' },
];

function detectPresentLevels(grid: IntensityGrid): Set<number> {
  const present = new Set<number>();
  for (let i = 0; i < grid.data.length; i++) {
    const v = grid.data[i];
    if (v < 0.5) continue;
    for (let j = JMA_LEVELS.length - 1; j >= 0; j--) {
      if (v >= JMA_LEVELS[j].min) {
        present.add(j);
        break;
      }
    }
  }
  return present;
}

function rgbaToCSS(rgba: [number, number, number, number]): string {
  return `rgb(${rgba[0]},${rgba[1]},${rgba[2]})`;
}

function safeT(key: string, fallback: string): string {
  const val = t(key);
  return val === key ? fallback : val;
}

// ── Render ──────────────────────────────────────────────────

function renderAssetSection(categoryVisibility: AssetCategoryVisibility): string {
  const rows = ASSET_CATEGORIES.map((cat) => {
    const rgba = ICON_CATEGORY_COLORS[cat.id];
    const color = rgba ? rgbaToCSS(rgba) : '#888';
    const label = safeT(cat.labelKey, cat.fallbackLabel);
    const enabled = categoryVisibility[cat.id] !== false;
    return `<div class="nz-map-legend__row${enabled ? '' : ' nz-map-legend__row--muted'}">
      <span class="nz-map-legend__dot" style="background:${color}"></span>
      <span class="nz-map-legend__label">${label}</span>
      <button
        type="button"
        class="nz-map-legend__toggle${enabled ? ' nz-map-legend__toggle--active' : ''}"
        data-category-toggle="${cat.id}"
        aria-pressed="${enabled ? 'true' : 'false'}"
        aria-label="${label}"
      ></button>
    </div>`;
  }).join('');

  return `<div class="nz-map-legend__section">${rows}</div>`;
}

function renderIntensityBar(grid: IntensityGrid): string {
  const present = detectPresentLevels(grid);
  if (present.size === 0) return '';

  const chips = JMA_LEVELS
    .map((level, idx) => {
      const active = present.has(idx);
      const opacity = active ? '1' : '0.3';
      return `<div class="nz-map-legend__jma-chip" style="opacity:${opacity}">
        <span class="nz-map-legend__jma-swatch" style="background:${level.color}"></span>
        <span class="nz-map-legend__jma-label">${level.label}</span>
      </div>`;
    })
    .join('');

  return `<div class="nz-map-legend__jma-bar">
    <span class="nz-map-legend__jma-title">震度</span>
    ${chips}
  </div>`;
}

// ── Mount ───────────────────────────────────────────────────

export interface MapLegendRenderState {
  intensityGrid: IntensityGrid | null;
  assetsExpanded: boolean;
  categoryVisibility: AssetCategoryVisibility;
}

export function renderMapLegendMarkup(state: MapLegendRenderState): string {
  const { intensityGrid, assetsExpanded, categoryVisibility } = state;
  const hasGrid = intensityGrid !== null && intensityGrid !== undefined;
  const jmaBar = hasGrid ? renderIntensityBar(intensityGrid) : '';
  const headerLabel = safeT('bundle.legend', 'Legend');
  const arrow = assetsExpanded ? '\u25BC' : '\u25B6';

  return `
    ${jmaBar}
    <div class="nz-map-legend__assets-toggle">
      <div class="nz-map-legend__header" role="button" tabindex="0">
        <span class="nz-map-legend__arrow">${arrow}</span>
        <span class="nz-map-legend__title">${headerLabel}</span>
      </div>
      ${assetsExpanded ? renderAssetSection(categoryVisibility) : ''}
    </div>
  `;
}

export function mountMapLegend(container: HTMLElement): () => void {
  container.className = 'nz-map-legend';
  let assetsExpanded = true;

  function render() {
    const grid = consoleStore.get('intensityGrid');
    const categoryVisibility = consoleStore.get('assetCategoryVisibility');

    container.innerHTML = renderMapLegendMarkup({
      intensityGrid: grid,
      assetsExpanded,
      categoryVisibility,
    });

    // Toggle assets on click
    const header = container.querySelector('.nz-map-legend__header');
    if (header) {
      header.addEventListener('click', () => {
        assetsExpanded = !assetsExpanded;
        render();
      });
      header.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
          e.preventDefault();
          assetsExpanded = !assetsExpanded;
          render();
        }
      });
    }

    const categoryButtons = container.querySelectorAll<HTMLButtonElement>('[data-category-toggle]');
    categoryButtons.forEach((button) => {
      const categoryId = button.dataset.categoryToggle as OpsAssetClass | undefined;
      if (!categoryId) return;

      button.addEventListener('click', () => {
        const current = consoleStore.get('assetCategoryVisibility');
        consoleStore.set('assetCategoryVisibility', toggleAssetCategoryVisibility(current, categoryId));
      });
    });
  }

  render();

  const unsubGrid = consoleStore.subscribe('intensityGrid', () => render());
  const unsubVisibility = consoleStore.subscribe('assetCategoryVisibility', () => render());

  return () => {
    unsubGrid();
    unsubVisibility();
    container.remove();
  };
}
