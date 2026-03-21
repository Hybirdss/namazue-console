/**
 * Asset Card — Floating detail card for selected infrastructure asset.
 *
 * Appears when clicking an asset icon on the map.
 * Shows: name, class, region, tags, coordinates, exposure status.
 * Positioned bottom-right, above the bottom bar.
 * Dismissed by clicking empty space or pressing Escape.
 */

import { consoleStore } from '../core/store';
import { OPS_ASSETS } from '../ops/assetCatalog';
import { ICON_CATEGORY_COLORS } from '../layers/iconAtlas';
import { t } from '../i18n';
import { getAssetDisplayName } from '../ops/assetDisplayName';
import type { OpsAsset, OpsAssetExposure, OpsSeverity, ActionUrgency } from '../ops/types';

// ── Asset lookup (lazy — rebuilt when OPS_ASSETS changes after loadOpsAssets) ──

let _assetMap: Map<string, OpsAsset> | null = null;
function getAssetMap(): Map<string, OpsAsset> {
  if (!_assetMap || _assetMap.size !== OPS_ASSETS.length) {
    _assetMap = new Map(OPS_ASSETS.map((a) => [a.id, a]));
  }
  return _assetMap;
}

// ── Severity badge ──────────────────────────────────────────

function severityLabel(s: OpsSeverity): string {
  return t(`severity.${s}`);
}

const SEVERITY_CSS: Record<OpsSeverity, string> = {
  clear: 'background:rgba(110,231,183,0.15);color:#6ee7b7;border:1px solid rgba(110,231,183,0.3)',
  watch: 'background:rgba(96,165,250,0.15);color:#60a5fa;border:1px solid rgba(96,165,250,0.3)',
  priority: 'background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.3)',
  critical: 'background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3)',
};

// ── i18n helpers ────────────────────────────────────────────

function classLabel(cls: string): string {
  const key = `legend.asset.${cls.replace('_plant', '').replace('_substation', '').replace('_facility', '').replace('_hub', '').replace('_cluster', '').replace('_terminal', '').replace('_site', '').replace('_eoc', 'eoc')}`;
  const val = t(key);
  return val === key ? cls.replace(/_/g, ' ') : val;
}

function regionLabel(region: string): string {
  const key = `region.${region}`;
  const val = t(key);
  return val === key ? region.charAt(0).toUpperCase() + region.slice(1) : val;
}

// ── Domain intelligence rendering ───────────────────────────

const URGENCY_BORDER: Record<ActionUrgency, string> = {
  immediate: 'border-left:3px solid #ef4444',
  within_1h: 'border-left:3px solid #f59e0b',
  within_6h: 'border-left:3px solid #3b82f6',
  monitor: 'border-left:3px solid #6b7280',
};

function bearingLabel(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
  const idx = Math.round(deg / 45) % 8;
  return t(`domain.bearing.${dirs[idx]}`);
}

function renderDomainIntel(exposure: OpsAssetExposure): string {
  const intel = exposure.domainIntel;
  if (!intel) return '';

  const sections: string[] = [];

  // Actions
  if (intel.actions.length > 0) {
    const items = intel.actions.map((a) =>
      `<div class="nz-asset-card__action" style="${URGENCY_BORDER[a.urgency]}">${t(a.action)}</div>`
    ).join('');
    sections.push(`<div class="nz-asset-card__domain-section">${items}</div>`);
  }

  // Nearest alternative
  if (intel.nearestAlternative) {
    const alt = intel.nearestAlternative;
    const dir = bearingLabel(alt.bearing);
    const badge = `<span class="nz-asset-card__alt-badge" style="${SEVERITY_CSS[alt.severity]}">${severityLabel(alt.severity)}</span>`;
    sections.push(`
      <div class="nz-asset-card__alt" data-alt-id="${alt.assetId}">
        <span class="nz-asset-card__alt-label">${t('domain.nearestAlt')}</span>
        <span class="nz-asset-card__alt-name">${alt.name}</span>
        <span class="nz-asset-card__alt-dist">${alt.distanceKm}km ${dir}</span>
        ${badge}
      </div>
    `);
  }

  // Metrics
  const metricKeys = Object.keys(intel.metrics);
  if (metricKeys.length > 0) {
    const rows = metricKeys.map((key) => {
      const label = t(`domain.metric.${key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`);
      const raw = intel.metrics[key];
      const val = typeof raw === 'number' ? String(raw) : t(`domain.value.${raw}`) || raw;
      return `<div class="nz-asset-card__metric"><span>${label}</span><span>${val}</span></div>`;
    }).join('');
    sections.push(`<div class="nz-asset-card__metrics">${rows}</div>`);
  }

  return sections.join('');
}

// ── Render ──────────────────────────────────────────────────

function rgbaToCSS(rgba: [number, number, number, number]): string {
  return `rgb(${rgba[0]},${rgba[1]},${rgba[2]})`;
}

function renderCard(asset: OpsAsset, exposure: OpsAssetExposure | null): string {
  const rgba = ICON_CATEGORY_COLORS[asset.class];
  const catColor = rgba ? rgbaToCSS(rgba) : '#888';
  const severity = exposure?.severity ?? 'clear';

  // Tags
  const tags = asset.tags
    .map((tag) => `<span class="nz-asset-card__tag">${tag}</span>`)
    .join('');

  // Domain intelligence (above generic exposure)
  const domainHtml = exposure && exposure.severity !== 'clear'
    ? renderDomainIntel(exposure)
    : '';

  // Exposure details (damage probs — below domain intel)
  let exposureHtml = '';
  if (exposure && exposure.severity !== 'clear') {
    exposureHtml = `
      <div class="nz-asset-card__exposure">
        ${exposure.damageProbs ? `
          <div class="nz-asset-card__probs">
            <span>${t('exposure.prob.disruption')}: ${(exposure.damageProbs.pDisruption * 100).toFixed(0)}%</span>
            <span>${t('exposure.prob.damage')}: ${(exposure.damageProbs.pDamage * 100).toFixed(0)}%</span>
            <span>${t('exposure.prob.collapse')}: ${(exposure.damageProbs.pCollapse * 100).toFixed(0)}%</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="nz-asset-card__header">
      <span class="nz-asset-card__icon" style="background:${catColor}"></span>
      <div class="nz-asset-card__title-group">
        <div class="nz-asset-card__name">${getAssetDisplayName(asset)}</div>
        <div class="nz-asset-card__meta">${classLabel(asset.class)} \u00B7 ${regionLabel(asset.region)}</div>
      </div>
      <button class="nz-asset-card__close" aria-label="Close">\u00D7</button>
    </div>
    <div class="nz-asset-card__badge" style="${SEVERITY_CSS[severity]}">${severityLabel(severity)}</div>
    ${domainHtml}
    <div class="nz-asset-card__coords">
      <span>${asset.lat.toFixed(4)}\u00B0N</span>
      <span>${asset.lng.toFixed(4)}\u00B0E</span>
    </div>
    ${tags ? `<div class="nz-asset-card__tags">${tags}</div>` : ''}
    ${exposureHtml}
  `;
}

// ── Mount ───────────────────────────────────────────────────

export function mountAssetCard(container: HTMLElement): () => void {
  container.className = 'nz-asset-card';
  container.setAttribute('hidden', '');

  function update() {
    const assetId = consoleStore.get('selectedAssetId');
    if (!assetId) {
      container.setAttribute('hidden', '');
      return;
    }

    const asset = getAssetMap().get(assetId);
    if (!asset) {
      container.setAttribute('hidden', '');
      return;
    }

    const exposures = consoleStore.get('exposures');
    const exposure = exposures.find((e) => e.assetId === assetId) ?? null;

    container.innerHTML = renderCard(asset, exposure);
    container.removeAttribute('hidden');

    // Close button
    const closeBtn = container.querySelector('.nz-asset-card__close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        consoleStore.set('selectedAssetId', null);
        consoleStore.set('highlightedAssetId', null);
      });
    }

    // Nearest alternative click → fly-to + select
    const altEl = container.querySelector<HTMLElement>('.nz-asset-card__alt');
    if (altEl) {
      altEl.style.cursor = 'pointer';
      altEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const altId = altEl.dataset.altId;
        if (altId) {
          consoleStore.set('selectedAssetId', altId);
          consoleStore.set('highlightedAssetId', altId);
        }
      });
    }
  }

  update();

  const unsub1 = consoleStore.subscribe('selectedAssetId', update);
  const unsub2 = consoleStore.subscribe('exposures', () => {
    if (consoleStore.get('selectedAssetId')) update();
  });

  // Escape key dismisses
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && consoleStore.get('selectedAssetId')) {
      consoleStore.set('selectedAssetId', null);
      consoleStore.set('highlightedAssetId', null);
    }
  }
  window.addEventListener('keydown', onKeyDown);

  return () => {
    unsub1();
    unsub2();
    window.removeEventListener('keydown', onKeyDown);
    container.remove();
  };
}
