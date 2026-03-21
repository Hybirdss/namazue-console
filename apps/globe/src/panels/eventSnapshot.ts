/**
 * Event Snapshot Panel — Left rail, top position.
 *
 * Shows the current operational situation at a glance:
 * - Event headline (or calm status)
 * - Magnitude + depth + time
 * - Severity indicator
 *
 * HUD style: dense data, no fluff, mono font for numbers.
 */

import { consoleStore } from '../core/store';
import { onLocaleChange, t, tf } from '../i18n';
import { localizedSeverityLabel } from '../utils/severityLabels';
import { escapeHtml } from '../utils/escapeHtml';
import { getLocalizedPlace } from '../utils/japanGeo';
import type { ServiceReadModel } from '../ops/readModelTypes';
import type { EarthquakeEvent, ScenarioDefinition, ScenarioMetric } from '../types';

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return t('time.justNow');
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}${t('time.minAgo')}`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}${t('time.hrAgo')}`;
  const days = Math.floor(diff / 86400_000);
  if (days < 30) return `${days}${t('time.dayAgo')}`;
  if (days < 365) return `${Math.floor(days / 30)}${t('time.monthAgo')}`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (months > 0) return `${years}${t('time.yearAgo')}${months}${t('time.monthAgo')}`;
  return `${years}${t('time.yearAgo')}`;
}

function severityClass(mag: number): string {
  if (mag >= 7.0) return 'critical';
  if (mag >= 5.5) return 'priority';
  if (mag >= 4.5) return 'watch';
  return 'info';
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTruthLabel(readModel: ServiceReadModel): string | null {
  if (!readModel.eventTruth) {
    return null;
  }
  return tf('snapshot.truth', { source: capitalize(readModel.eventTruth.source), confidence: capitalize(readModel.eventTruth.confidence) });
}

function formatRevisionLabel(readModel: ServiceReadModel): string | null {
  if (!readModel.eventTruth) {
    return null;
  }

  const conflictLabel = readModel.eventTruth.divergenceSeverity === 'material'
    ? ` · ${t('snapshot.materialDivergence')}`
    : readModel.eventTruth.hasConflictingRevision
      ? ` · ${t('snapshot.conflictDetected')}`
      : '';
  return `${tf('snapshot.revisions', { n: readModel.eventTruth.revisionCount })}${conflictLabel}`;
}

function formatFreshnessLabel(readModel: ServiceReadModel, now: number): string {
  const freshness = readModel.freshnessStatus;
  if (freshness.updatedAt <= 0) {
    return t('snapshot.dataPending');
  }
  const age = formatTimeAgo(Math.min(freshness.updatedAt, now));
  const label = freshness.state === 'degraded' || freshness.state === 'stale' ? t('snapshot.dataLive') : freshness.state;
  return `Data ${label}${age ? ` · ${age}` : ''}`;
}

function getHealthTone(readModel: ServiceReadModel): 'calm' | 'watch' | 'critical' {
  switch (readModel.systemHealth.level) {
    case 'degraded':
      return 'critical';
    case 'watch':
      return 'watch';
    default:
      return 'calm';
  }
}

function getHealthLabel(readModel: ServiceReadModel): string {
  switch (readModel.systemHealth.level) {
    case 'degraded':
      return t('snapshot.health.degraded');
    case 'watch':
      return t('snapshot.health.watch');
    default:
      return t('snapshot.health.nominal');
  }
}

function renderHealthBlock(readModel: ServiceReadModel): string {
  const health = readModel.systemHealth;
  if (health.level === 'nominal') return '';

  const components = readModel.freshnessStatus.components ?? [];
  const degradedComponents = components.filter((c) => c.state === 'degraded' || c.state === 'down');
  const componentMarkup = degradedComponents.length > 0
    ? `<div class="nz-snap__health-components">${degradedComponents.map((c) =>
        `<div class="nz-snap__health-component"><span class="nz-snap__comp-label">${c.label}</span> <span class="nz-snap__comp-state">${c.state}</span>${c.message ? ` · ${escapeHtml(c.message)}` : ''}</div>`,
      ).join('')}</div>`
    : '';

  return `
    <div class="nz-snap__health nz-snap__health--${getHealthTone(readModel)}">
      <div class="nz-snap__health-headline">${escapeHtml(health.headline)}</div>
      <div class="nz-snap__health-detail">${escapeHtml(health.detail)}</div>
      ${componentMarkup}
    </div>
  `;
}

function renderCalmState(readModel: ServiceReadModel, now: number): string {
  const freshness = formatFreshnessLabel(readModel, now);
  const summary = readModel.operationalOverview.selectionSummary;
  return `
    <div class="nz-panel" id="nz-event-snapshot">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('snapshot.situation')}</span>
        <span class="nz-snap__status nz-snap__status--${getHealthTone(readModel)}">${getHealthLabel(readModel)}</span>
      </div>
      <div class="nz-snap__headline">${summary}</div>
      <div class="nz-snap__meta">
        <span class="nz-snap__metric">${t('snapshot.monitoring')}</span>
        <span class="nz-snap__metric">${freshness}</span>
      </div>
      ${renderHealthBlock(readModel)}
    </div>
  `;
}

function isScenarioEvent(event: EarthquakeEvent): boolean {
  return Boolean(event.scenarioId) || event.id.startsWith('scenario-');
}

function getScenarioDefinition(event: EarthquakeEvent): ScenarioDefinition | null {
  if (!isScenarioEvent(event)) return null;
  const scenarioId = event.scenarioId ?? event.id.replace('scenario-', '');
  const scenarios = consoleStore.get('scenarios');
  return scenarios.find((scenario) => scenario.id === scenarioId) ?? null;
}

function renderScenarioTag(): string {
  return `
    <div class="nz-snap__scenario-tag">
      <span class="nz-snap__scenario-icon">⚠</span>
      <span class="nz-snap__scenario-label">${t('snapshot.simulationLabel')}</span>
    </div>
  `;
}

function formatScenarioMetricValue(metric: ScenarioMetric): string {
  if (metric.value == null) return 'Hidden';
  switch (metric.unit) {
    case 'jma':
      return `JMA ${metric.value}`;
    case 'km2':
      return `${Number(metric.value).toLocaleString()} km²`;
    case 'm':
      return `${metric.value} m`;
    case 'min':
      return `${metric.value} min`;
    default:
      return String(metric.value);
  }
}

function metricLabel(metric: ScenarioMetric): string {
  switch (metric.id) {
    case 'probability30yr':
      return t('snapshot.probability30yr');
    case 'recurrence':
      return t('snapshot.recurrence');
    default:
      return metric.label;
  }
}

function renderScenarioMetrics(scenario: ScenarioDefinition): string {
  const preferredOrder = [
    'probability30yr',
    'recurrence',
    'maxIntensity',
    'landAffectedAreaKm2',
    'tsunamiHeight',
  ];
  const visibleMetrics = preferredOrder
    .map((id) => scenario.metrics[id])
    .filter((metric): metric is ScenarioMetric => Boolean(metric && metric.status === 'ok' && metric.value != null))
    .slice(0, 2);

  if (visibleMetrics.length === 0) {
    if (scenario.event.time) {
      return `<div class="nz-snap__metrics nz-snap__metrics--scenario">
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">${new Date(scenario.event.time).toISOString().slice(0, 10)}</span>
          <span class="nz-snap__metric-label">Scenario date</span>
        </div>
      </div>`;
    }
    return '';
  }

  return `<div class="nz-snap__metrics nz-snap__metrics--scenario">
    ${visibleMetrics.map((metric) => `
      <div class="nz-snap__metric-group">
        <span class="nz-snap__metric-value${metric.id === 'maxIntensity' ? ' nz-snap__metric-value--scenario' : ''}">${formatScenarioMetricValue(metric)}</span>
        <span class="nz-snap__metric-label">${metricLabel(metric)}</span>
      </div>
    `).join('')}
  </div>`;
}

function renderEventState(
  event: EarthquakeEvent,
  readModel: ServiceReadModel,
  now: number,
): string {
  const sev = severityClass(event.magnitude);
  const sevLabel = localizedSeverityLabel(sev);
  const scenario = isScenarioEvent(event);
  const headline = readModel.nationalSnapshot?.headline;
  const scenarioDef = scenario ? getScenarioDefinition(event) : null;

  // Scenario: disclaimer instead of truth/revision/freshness metadata
  let metaMarkup: string;
  if (scenario) {
    metaMarkup = `<div class="nz-snap__meta nz-snap__meta--scenario">
      <div class="nz-snap__metric">${t('snapshot.scenarioDisclaimer')}</div>
      <div class="nz-snap__metric">${t('snapshot.scenarioWarning')}</div>
    </div>`;
  } else {
    const truthLabel = formatTruthLabel(readModel);
    const revisionLabel = formatRevisionLabel(readModel);
    const freshnessLabel = formatFreshnessLabel(readModel, now);
    const metaLines = [truthLabel, revisionLabel, freshnessLabel].filter((value): value is string => Boolean(value));
    metaMarkup = metaLines.length
      ? `<div class="nz-snap__meta">${metaLines.map((line) => `<div class="nz-snap__metric">${line}</div>`).join('')}</div>`
      : '';
  }

  const jstTime = new Date(event.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });

  // Scenario events: show HERP 30yr probability + recurrence instead of elapsed time
  const metricsBlock = scenario && scenarioDef
    ? renderScenarioMetrics(scenarioDef)
    : `<div class="nz-snap__metrics">
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">${formatTimeAgo(event.time)}</span>
          <span class="nz-snap__metric-label">${t('snapshot.elapsed')}</span>
        </div>
        <div class="nz-snap__metric-group">
          <span class="nz-snap__metric-value">${jstTime} <span class="nz-snap__tz">JST</span></span>
          <span class="nz-snap__metric-label">${t('snapshot.localTime')}</span>
        </div>
      </div>`;

  const scenarioSources = scenarioDef
    ? Array.from(new Set(
        Object.values(scenarioDef.metrics)
          .filter((metric) => metric.status === 'ok' && metric.provenance?.citation)
          .map((metric) => metric.provenance!.citation),
      ))
    : [];
  const sourceBlock = scenario && scenarioSources.length > 0
    ? `<div class="nz-snap__source">${escapeHtml(scenarioSources[0]!)}</div>`
    : '';

  return `
    <div class="nz-panel nz-panel--sev-${sev}${scenario ? ' nz-panel--scenario' : ''}" id="nz-event-snapshot">
      ${scenario ? renderScenarioTag() : ''}
      <div class="nz-panel__header">
        <span class="nz-panel__title">${scenario ? t('snapshot.scenario') : t('snapshot.eventTruth')}</span>
        <span class="nz-snap__status nz-snap__status--${sev}">${sevLabel}</span>
        <button class="nz-snap__dismiss" id="nz-snap-dismiss" title="${t('snapshot.deselect')}">×</button>
      </div>
      <div class="nz-snap__mag-hero nz-snap__mag-hero--${sev}">M ${event.magnitude.toFixed(1)}</div>
      <div class="nz-snap__mag-depth">${tf('snapshot.depth', { n: Math.round(event.depth_km) })}</div>
      <div class="nz-snap__sev-bar nz-snap__sev-bar--${sev}"></div>
      <div class="nz-snap__headline">${escapeHtml(getLocalizedPlace(event.lat, event.lng, event.place.text))}</div>
      ${metricsBlock}
      ${headline ? `<div class="nz-snap__metric">${headline}</div>` : ''}
      ${metaMarkup}
      ${renderHealthBlock(readModel)}
      ${sourceBlock}
      <div class="nz-snap__coords">
        ${event.lat.toFixed(3)}°N ${event.lng.toFixed(3)}°E
      </div>
    </div>
  `;
}

export function renderEventSnapshotMarkup(input: {
  mode: 'calm' | 'event';
  selectedEvent: EarthquakeEvent | null;
  readModel: ServiceReadModel;
  now?: number;
}): string {
  const event = input.selectedEvent ?? input.readModel.currentEvent;
  const now = input.now ?? Date.now();

  if (input.mode === 'event' && event) {
    return renderEventState(event, input.readModel, now);
  }

  return renderCalmState(input.readModel, now);
}

// ── Mount / Bind ───────────────────────────────────────────────

export function mountEventSnapshot(
  container: HTMLElement,
  onDeselect?: () => void,
): () => void {
  function render(): void {
    const selected = consoleStore.get('selectedEvent');
    const mode = consoleStore.get('mode');
    const readModel = consoleStore.get('readModel');
    container.innerHTML = renderEventSnapshotMarkup({
      mode,
      selectedEvent: selected,
      readModel,
    });

    // Bind deselect button
    if (onDeselect) {
      const btn = container.querySelector('#nz-snap-dismiss');
      if (btn) btn.addEventListener('click', onDeselect);
    }
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

  const unsub1 = consoleStore.subscribe('selectedEvent', scheduleRender);
  const unsub2 = consoleStore.subscribe('mode', scheduleRender);
  const unsub3 = consoleStore.subscribe('readModel', scheduleRender);
  const unsub4 = consoleStore.subscribe('realtimeStatus', scheduleRender);
  const unsub5 = onLocaleChange(() => scheduleRender());

  // Refresh time labels every 30s
  const timer = setInterval(render, 30_000);

  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
    unsub5();
    clearInterval(timer);
  };
}
