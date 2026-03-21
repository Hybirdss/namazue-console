/**
 * Fault Catalog Panel — Scenario mode HERP fault selector.
 *
 * In scenario mode (S key): Shows ALL 22 HERP-evaluated faults as a selectable
 * list, like the recent feed. Click a fault → run scenario.
 *
 * In normal mode: hidden by bootstrap (display:none on container).
 */

import { consoleStore } from '../core/store';
import { t } from '../i18n';
import type { ScenarioDefinition, ScenarioMetric } from '../types';

type ScenarioClickHandler = (scenario: ScenarioDefinition) => void;

function riskClass(mw: number): string {
  if (mw >= 8.0) return 'critical';
  if (mw >= 7.0) return 'priority';
  if (mw >= 6.5) return 'watch';
  return 'info';
}

function probColor(prob: string): string {
  if (prob.includes('70') || prob.includes('80') || prob.includes('90')) return 'nz-fault__prob--high';
  if (prob.includes('14') || prob.includes('30') || prob.includes('16')) return 'nz-fault__prob--mid';
  if (prob.includes('未評価') || prob.includes('不明')) return 'nz-fault__prob--unknown';
  return '';
}

function formatMetric(metric: ScenarioMetric | undefined): string | null {
  if (!metric || metric.status !== 'ok' || metric.value == null) return null;
  return String(metric.value);
}

function scenarioKindTag(scenario: ScenarioDefinition): string {
  switch (scenario.kind) {
    case 'historical_replay':
      return 'Historical Replay';
    case 'synthetic_scenario':
      return 'Synthetic';
    default:
      return 'Probabilistic';
  }
}

function renderScenarioList(
  scenarios: ScenarioDefinition[],
  selectedEventId: string | null,
): string {
  const sorted = [...scenarios].sort((a, b) => {
    if (a.kind === 'historical_replay' && b.kind !== 'historical_replay') return -1;
    if (b.kind === 'historical_replay' && a.kind !== 'historical_replay') return 1;
    return b.event.magnitude - a.event.magnitude;
  });

  const items = sorted.map((scenario) => {
    const risk = riskClass(scenario.event.magnitude);
    const isSelected = selectedEventId === `scenario-${scenario.id}`;
    const activeClass = isSelected ? ' nz-fault__item--active' : '';
    const probability = formatMetric(scenario.metrics.probability30yr);
    const recurrence = formatMetric(scenario.metrics.recurrence);
    const intensity = formatMetric(scenario.metrics.maxIntensity);
    const secondary = scenario.kind === 'historical_replay'
      ? [intensity ? `JMA ${intensity}` : null, scenario.event.time ? new Date(scenario.event.time).toISOString().slice(0, 10) : null]
      : [probability, recurrence];

    return `
      <div class="nz-fault__item nz-fault__item--clickable${activeClass}" data-scenario-id="${scenario.id}">
        <div class="nz-fault__item-top">
          <span class="nz-fault__dot nz-fault__dot--${risk}"></span>
          <span class="nz-fault__mw nz-fault__mw--${risk}">M${scenario.event.magnitude.toFixed(1)}</span>
          <span class="nz-fault__name">${scenario.name}</span>
        </div>
        <div class="nz-fault__item-bottom">
          <span class="nz-fault__type-tag">${scenarioKindTag(scenario)}</span>
          ${secondary[0] ? `<span class="nz-fault__prob-value ${probColor(secondary[0])}">${secondary[0]}</span>` : ''}
          ${secondary[1] ? `<span class="nz-fault__interval">${secondary[1]}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-panel nz-panel--scenario-faults" id="nz-fault-catalog">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('fault.title')}</span>
        <span class="nz-fault__count">${scenarios.length}</span>
      </div>
      <div class="nz-fault__hint">${t('fault.hint')}</div>
      <div class="nz-fault__list nz-fault__list--scenario">${items}</div>
    </div>
  `;
}

export function mountFaultCatalog(
  container: HTMLElement,
  onScenarioClick: ScenarioClickHandler,
): () => void {
  function render(): void {
    const scenarios = consoleStore.get('scenarios');
    const selectedEventId = consoleStore.get('selectedEvent')?.id ?? null;
    const scenarioMode = consoleStore.get('scenarioMode');

    if (!scenarioMode) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = renderScenarioList(scenarios, selectedEventId);
    container.querySelectorAll<HTMLElement>('.nz-fault__item').forEach((el) => {
      el.addEventListener('click', () => {
        const scenarioId = el.dataset.scenarioId;
        const scenario = scenarios.find((entry) => entry.id === scenarioId);
        if (scenario) onScenarioClick(scenario);
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
  const unsub1 = consoleStore.subscribe('scenarios', scheduleRender);
  const unsub2 = consoleStore.subscribe('selectedEvent', scheduleRender);
  const unsub3 = consoleStore.subscribe('scenarioMode', scheduleRender);

  return () => {
    unsub1();
    unsub2();
    unsub3();
  };
}
