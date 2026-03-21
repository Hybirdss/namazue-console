/**
 * Asset Exposure Panel — Left rail, below recent feed.
 *
 * Shows severity status of nearby infrastructure assets.
 * Each asset displays: severity badge, name, class icon, brief summary.
 * Only shows assets that are NOT "clear" (to save space).
 */

import { consoleStore } from '../core/store';
import type { ServiceReadModel } from '../ops/readModelTypes';
import type { OpsAssetExposure } from '../ops/types';
import { computeMaritimeExposure, type MaritimeExposure } from '../layers/aisLayer';
import { buildMaritimeOverview, type MaritimeOverview } from '../ops/maritimeTelemetry';
import { buildSectorStressModel } from '../presentation/sectorStress';
import { buildDecisionPriorityRows } from '../presentation/decisionStack';
import { onLocaleChange, t } from '../i18n';
import { localizedSeverityLabel } from '../utils/severityLabels';

function renderEmpty(message: string): string {
  return `
    <div class="nz-panel nz-panel--collapsed" id="nz-asset-exposure">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('panel.sectorStress.title')}</span>
      </div>
      <div class="nz-expo__clear">${message}</div>
    </div>
  `;
}

export function buildExposureEmptyMessage(readModel: ServiceReadModel): string {
  return readModel.operationalOverview.impactSummary;
}

function renderMaritimeRow(
  label: string,
  count: number,
  tone: 'critical' | 'priority' | 'watch',
  dotColor: string,
): string {
  return `
    <div class="nz-expo__maritime-row nz-expo__maritime-row--${tone}">
      <span class="nz-expo__maritime-dot" style="background:${dotColor}"></span>
      <span class="nz-expo__maritime-type">${label}</span>
      <span class="nz-expo__maritime-row-count">${count}</span>
    </div>
  `;
}

function renderMaritimeRows(exposure: MaritimeExposure): string {
  const rows: string[] = [];
  if (exposure.passengerCount > 0) {
    rows.push(renderMaritimeRow(t('exposure.shipType.passenger'), exposure.passengerCount, 'critical', '#7dd3fc'));
  }
  if (exposure.tankerCount > 0) {
    rows.push(renderMaritimeRow(t('exposure.shipType.tanker'), exposure.tankerCount, 'priority', '#fbbf24'));
  }
  if (exposure.cargoCount > 0) {
    rows.push(renderMaritimeRow(t('exposure.shipType.cargo'), exposure.cargoCount, 'watch', '#94a3b8'));
  }
  if (exposure.fishingCount > 0) {
    rows.push(renderMaritimeRow(t('exposure.shipType.fishing'), exposure.fishingCount, 'watch', '#6ee7b7'));
  }
  return rows.join('');
}

export function renderAssetExposureMarkup(input: {
  exposures: OpsAssetExposure[];
  maritimeExposure: MaritimeExposure;
  maritimeOverview: MaritimeOverview;
}): string {
  const { exposures, maritimeExposure, maritimeOverview } = input;
  const affected = exposures.filter((entry) => entry.severity !== 'clear');
  const model = buildSectorStressModel({
    exposures,
    maritimeExposure,
    maritimeOverview,
  });

  if (affected.length === 0 && model.maritime.inImpactZone === 0) {
    return renderEmpty(t('panel.sectorStress.allClear'));
  }

  const maritimeRows = renderMaritimeRows(maritimeExposure);
  const maritimeStateClass = model.maritime.inImpactZone > 0 ? 'nz-expo__maritime--alert' : '';

  // Build severity pills for each sector
  function sevPills(g: typeof model.infrastructure.groups[0]): string {
    const pills: string[] = [];
    if (g.critical > 0) pills.push(`<span class="nz-expo__pill nz-expo__pill--critical">${g.critical} ${t('exposure.critical')}</span>`);
    if (g.priority > 0) pills.push(`<span class="nz-expo__pill nz-expo__pill--priority">${g.priority} ${t('exposure.priority')}</span>`);
    if (g.watch > 0) pills.push(`<span class="nz-expo__pill nz-expo__pill--watch">${g.watch} ${t('exposure.watch')}</span>`);
    return pills.join('');
  }

  function topSev(g: typeof model.infrastructure.groups[0]): 'critical' | 'priority' | 'watch' {
    if (g.critical > 0) return 'critical';
    if (g.priority > 0) return 'priority';
    return 'watch';
  }

  return `
    <div class="nz-panel" id="nz-asset-exposure">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('panel.sectorStress.title')}</span>
        <span class="nz-expo__count">${affected.length} ${t('panel.sectorStress.affected')}</span>
      </div>
      <div class="nz-expo__list">
        ${model.infrastructure.groups.map((group) => {
    const sev = topSev(group);
    return `
          <div
            class="nz-expo__sector nz-expo__sector--${sev}"
            ${group.topAsset ? `data-asset-id="${group.topAsset.assetId}"` : ''}
          >
            <div class="nz-expo__sector-head">
              <span class="nz-expo__icon-well nz-expo__icon-well--${sev}">${group.icon}</span>
              <div class="nz-expo__sector-info">
                <span class="nz-expo__sector-label">${group.label}</span>
                <span class="nz-expo__sector-pills">${sevPills(group)}</span>
              </div>
              <span class="nz-expo__sector-count">${group.total}</span>
            </div>
            ${group.topAsset ? `<div class="nz-expo__sector-detail">${group.topAsset.assetName} · ${group.topAsset.summary}</div>` : ''}
            ${group.topAsset?.damageProbs ? `
              <div class="nz-expo__probs">
                <span class="nz-expo__prob" title="${t('exposure.prob.disruption')}">${Math.round(group.topAsset.damageProbs.pDisruption * 100)}%</span>
                <span class="nz-expo__prob-bar" style="--prob: ${group.topAsset.damageProbs.pDisruption}"></span>
                <span class="nz-expo__prob" title="${t('exposure.prob.damage')}">${Math.round(group.topAsset.damageProbs.pDamage * 100)}%</span>
                <span class="nz-expo__prob-bar nz-expo__prob-bar--damage" style="--prob: ${group.topAsset.damageProbs.pDamage}"></span>
                ${group.topAsset.damageProbs.pCollapse >= 0.01 ? `
                  <span class="nz-expo__prob" title="${t('exposure.prob.collapse')}">${Math.round(group.topAsset.damageProbs.pCollapse * 100)}%</span>
                  <span class="nz-expo__prob-bar nz-expo__prob-bar--collapse" style="--prob: ${group.topAsset.damageProbs.pCollapse}"></span>
                ` : ''}
              </div>
            ` : ''}
          </div>`;
  }).join('')}
      </div>
      <div class="nz-expo__maritime ${maritimeStateClass}">
        <div class="nz-expo__maritime-head">
          <span class="nz-expo__maritime-label">${t('panel.sectorStress.maritime')}</span>
          <span class="nz-expo__maritime-count">
            ${model.maritime.inImpactZone > 0
      ? `${model.maritime.inImpactZone} ${t('panel.sectorStress.inZone')}`
      : t('panel.sectorStress.stable')}
          </span>
        </div>
        <div class="nz-expo__maritime-summary">${model.maritime.summary}</div>
        ${maritimeRows ? `<div class="nz-expo__maritime-breakdown">${maritimeRows}</div>` : ''}
        <div class="nz-expo__maritime-foot">
          ${model.maritime.totalTracked} ${t('panel.sectorStress.tracked')}
        </div>
      </div>
    </div>
  `;
}

function renderPriorityActions(): string {
  const readModel = consoleStore.get('readModel');
  const rows = buildDecisionPriorityRows(readModel);
  if (rows.length === 0) return '';

  const items = rows.map((row) => {
    const badge = row.severity === 'critical' ? 'critical' : row.severity === 'priority' ? 'priority' : row.severity === 'watch' ? 'watch' : 'info';
    return `
      <div class="nz-check__item nz-check__item--${badge}" data-asset-id="${row.assetId ?? ''}">
        <div class="nz-check__item-header">
          <span class="nz-check__rank">${row.rank}</span>
          <span class="nz-check__severity nz-check__severity--${badge}">${localizedSeverityLabel(row.severity)}</span>
        </div>
        <div class="nz-check__title">${row.action}</div>
        <div class="nz-check__rationale">${row.rationale}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-expo__actions" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--nz-separator, rgba(30,37,48,0.6))">
      <div class="nz-panel__header" style="margin-bottom:6px">
        <span class="nz-panel__title">${t('panel.checkNow.title')}</span>
        <span class="nz-check__count">${rows.length}</span>
      </div>
      <div class="nz-check__list">${items}</div>
    </div>
  `;
}

function renderExposures(exposures: OpsAssetExposure[]): string {
  const vessels = consoleStore.get('vessels');
  const selectedEvent = consoleStore.get('selectedEvent');
  const markup = renderAssetExposureMarkup({
    exposures,
    maritimeExposure: computeMaritimeExposure(vessels, selectedEvent),
    maritimeOverview: buildMaritimeOverview(vessels),
  });
  const actions = renderPriorityActions();
  if (!actions) return markup;
  // Append priority actions inside the panel's root div using a sentinel marker
  const closeTag = '</div>';
  const lastIdx = markup.lastIndexOf(closeTag);
  if (lastIdx === -1) return markup + actions;
  return markup.slice(0, lastIdx) + actions + markup.slice(lastIdx);
}

export function selectExposureSummary(readModel: ServiceReadModel): OpsAssetExposure[] {
  if (readModel.visibleExposureSummary.length > 0) {
    return readModel.visibleExposureSummary;
  }

  return readModel.nationalExposureSummary;
}

export function mountAssetExposure(container: HTMLElement): () => void {
  function render(): void {
    const readModel = consoleStore.get('readModel');
    const exposures = selectExposureSummary(readModel);
    if (exposures.every((entry) => entry.severity === 'clear')) {
      container.innerHTML = renderEmpty(buildExposureEmptyMessage(readModel));
      return;
    }

    container.innerHTML = renderExposures(exposures);

    // Wire up panel→map highlight on hover
    container.querySelectorAll<HTMLElement>('[data-asset-id]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        const id = el.dataset.assetId;
        if (id) consoleStore.set('highlightedAssetId', id);
      });
      el.addEventListener('mouseleave', () => {
        consoleStore.set('highlightedAssetId', null);
      });
    });
  }

  let renderScheduled = false;
  const scheduleRender = (): void => {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
      renderScheduled = false;
      render();
    });
  };

  render();
  const unsub = consoleStore.subscribe('readModel', scheduleRender);
  const unsubVessels = consoleStore.subscribe('vessels', scheduleRender);
  const unsubSelected = consoleStore.subscribe('selectedEvent', scheduleRender);
  const unsubLocale = onLocaleChange(() => scheduleRender());
  return () => {
    unsub();
    unsubVessels();
    unsubSelected();
    unsubLocale();
  };
}
