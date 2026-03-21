/**
 * Check These Now — Right rail priority action queue.
 *
 * THE operational conclusion: ordered list of what to inspect first.
 * Consumes OpsPriority[] from the service engine.
 * Each item shows severity badge, title, and rationale.
 */

import { consoleStore } from '../core/store';
import { t } from '../i18n';
import { localizedSeverityLabel, localizedTrustLabel } from '../utils/severityLabels';
import type { ServiceReadModel } from '../ops/readModelTypes';
import type { OpsPriority, OpsSeverity } from '../ops/types';
import { buildDecisionPriorityRows } from '../presentation/decisionStack';

function severityBadgeClass(sev: OpsSeverity): string {
  switch (sev) {
    case 'critical': return 'critical';
    case 'priority': return 'priority';
    case 'watch': return 'watch';
    default: return 'info';
  }
}

function renderEmpty(message: string): string {
  return `
    <div class="nz-panel" id="nz-check-now">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('panel.checkNow.title')}</span>
      </div>
      <div class="nz-check__empty">${message}</div>
    </div>
  `;
}

export function buildPriorityEmptyMessage(readModel: ServiceReadModel): string {
  return readModel.operationalOverview.impactSummary;
}

function renderPriorities(readModel: ServiceReadModel): string {
  const rows = buildDecisionPriorityRows(readModel);
  const items = rows.map((row) => {
    const badge = severityBadgeClass(row.severity);
    return `
      <div
        class="nz-check__item nz-check__item--${badge}"
        data-asset-id="${row.assetId ?? ''}"
        ${row.assetId ? 'role="button" tabindex="0"' : ''}
      >
        <div class="nz-check__item-header">
          <span class="nz-check__rank">${row.rank}</span>
          <span class="nz-check__severity nz-check__severity--${badge}">${localizedSeverityLabel(row.severity)}</span>
        </div>
        <div class="nz-check__title">${row.action}</div>
        <div class="nz-check__rationale">${row.rationale}</div>
        <div class="nz-check__trust">${t('check.trust')}: ${localizedTrustLabel(row.trust)}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-panel" id="nz-check-now">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('panel.checkNow.title')}</span>
        <span class="nz-check__count">${rows.length}</span>
      </div>
      <div class="nz-check__list">${items}</div>
    </div>
  `;
}

export function selectPriorityQueue(readModel: ServiceReadModel): OpsPriority[] {
  if (readModel.visiblePriorityQueue.length > 0) {
    return readModel.visiblePriorityQueue;
  }

  return readModel.nationalPriorityQueue;
}

export function mountCheckTheseNow(container: HTMLElement): () => void {
  const setHighlight = (assetId: string | null): void => {
    consoleStore.set('highlightedAssetId', assetId);
  };

  function render(): void {
    const readModel = consoleStore.get('readModel');
    const priorities = selectPriorityQueue(readModel);
    if (priorities.length === 0) {
      container.innerHTML = renderEmpty(buildPriorityEmptyMessage(readModel));
    } else {
      container.innerHTML = renderPriorities(readModel);
    }

    // Wire up panel→map highlight on hover, click, and keyboard.
    container.querySelectorAll<HTMLElement>('[data-asset-id]').forEach((el) => {
      const id = el.dataset.assetId || null;
      if (!id) return;

      el.addEventListener('mouseenter', () => setHighlight(id));
      el.addEventListener('focus', () => setHighlight(id));
      el.addEventListener('click', () => setHighlight(id));
      el.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        setHighlight(id);
      });
      el.addEventListener('mouseleave', () => setHighlight(null));
      el.addEventListener('blur', () => setHighlight(null));
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

  return () => { unsub(); };
}
