/**
 * Impact Intelligence Panel — Right rail, between Check These Now and Fault Catalog.
 *
 * Displays the critical intelligence data that helps operators make
 * life-safety decisions: peak intensity, infrastructure impact,
 * intensity area coverage, tsunami ETAs, and response timeline.
 *
 * Consumes computeImpactIntelligence() from ops/impactIntelligence.
 * Only renders when an event is selected; otherwise shows collapsed state.
 */

import { consoleStore } from '../core/store';
import { onLocaleChange, t, tf } from '../i18n';
import { JMA_COLORS } from '../types';
import type { JmaClass, EarthquakeEvent } from '../types';
import type { OpsAssetExposure } from '../ops/types';
import type {
  ImpactIntelligence,
  PeakIntensity,
  LandPeakIntensity,
  PopulationExposure,
  IntensityAreaStats,
  InfraImpactSummary,
  TsunamiETA,
  ResponseMilestone,
} from '../ops/impactIntelligence';
import { computeImpactIntelligence } from '../ops/impactIntelligence';
import { buildDecisionStackModel } from '../presentation/decisionStack';
import type { ServiceReadModel } from '../ops/readModelTypes';
import {
  formatAreaKm2,
  formatDistanceKm,
  formatMinutesShort,
  formatPopulationCoverage,
  formatPopulationShort,
} from '../utils/metricFormat';

// ── Helpers ──────────────────────────────────────────────────

function severityFromJma(jmaClass: JmaClass | null): string {
  if (!jmaClass) return 'info';
  switch (jmaClass) {
    case '7':
    case '6+':
    case '6-':
      return 'critical';
    case '5+':
    case '5-':
      return 'priority';
    case '4':
      return 'watch';
    default:
      return 'info';
  }
}

// ── Peak Intensity Section ───────────────────────────────────

function renderPeakIntensity(
  peak: PeakIntensity,
  landPeak: LandPeakIntensity | null,
  event?: EarthquakeEvent,
): string {
  const observed = event?.observedIntensity;

  if (observed) {
    // JMA observed value available — show it as primary
    const obsColor = JMA_COLORS[observed as JmaClass] || '#94a3b8';
    const gmpeColor = JMA_COLORS[peak.jmaClass] || '#94a3b8';
    return `
      <div class="nz-intel__peak">
        <div class="nz-intel__peak-value" style="color:${obsColor}">${t('impact.jmaPrefix')}${observed}</div>
        <div class="nz-intel__peak-label">${t('panel.impactIntel.peakIntensity')}</div>
        <div class="nz-intel__peak-source">${t('intel.source.jmaObserved')}</div>
        <div class="nz-intel__peak-gmpe">${t('intel.source.gmpeLabel')} <span style="color:${gmpeColor}">${peak.jmaClass}</span></div>
      </div>
    `;
  }

  // Land peak available and different from grid peak — show land as primary
  if (landPeak && landPeak.jmaClass !== peak.jmaClass) {
    const landColor = JMA_COLORS[landPeak.jmaClass] || '#94a3b8';
    const epicentralColor = JMA_COLORS[peak.jmaClass] || '#94a3b8';
    return `
      <div class="nz-intel__peak">
        <div class="nz-intel__peak-value" style="color:${landColor}">${t('impact.jmaPrefix')}${landPeak.jmaClass}</div>
        <div class="nz-intel__peak-label">${t('panel.impactIntel.peakIntensityLand')}</div>
        <div class="nz-intel__peak-source">${t('intel.source.gmpeEstimateFull')}</div>
        <div class="nz-intel__peak-city">${landPeak.cityName}</div>
        <div class="nz-intel__peak-epicentral" style="color:var(--nz-text-muted)">
          ${t('panel.impactIntel.epicentral')} <span style="color:${epicentralColor};opacity:0.6">${t('impact.jmaPrefix')}${peak.jmaClass}</span>
        </div>
      </div>
    `;
  }

  // No land/grid difference — show grid peak as before
  const color = JMA_COLORS[peak.jmaClass] || '#94a3b8';
  return `
    <div class="nz-intel__peak">
      <div class="nz-intel__peak-value" style="color:${color}">${t('impact.jmaPrefix')}${peak.jmaClass}</div>
      <div class="nz-intel__peak-label">${t('panel.impactIntel.peakIntensity')}</div>
      <div class="nz-intel__peak-source">${t('intel.source.gmpeEstimateFull')}</div>
    </div>
  `;
}

// ── Infrastructure Impact Section ────────────────────────────

interface InfraRow {
  icon: string;
  count: number;
  label: string;
  colorClass: string;
}

function buildInfraRows(infra: InfraImpactSummary): InfraRow[] {
  const rows: InfraRow[] = [];

  if (infra.hospitalsCompromised > 0) {
    rows.push({ icon: '\uD83C\uDFE5', count: infra.hospitalsCompromised, label: t('panel.impactIntel.hospitalsCompromised'), colorClass: 'critical' });
  }
  if (infra.hospitalsDisrupted > 0) {
    rows.push({ icon: '\uD83C\uDFE5', count: infra.hospitalsDisrupted, label: t('panel.impactIntel.hospitalsDisrupted'), colorClass: 'priority' });
  }
  if (infra.dmatBasesDeployable > 0) {
    rows.push({ icon: '\u2795', count: infra.dmatBasesDeployable, label: t('panel.impactIntel.dmatDeployable'), colorClass: 'calm' });
  }
  if (infra.nuclearScramLikely > 0) {
    rows.push({ icon: '\u2622\uFE0F', count: infra.nuclearScramLikely, label: t('panel.impactIntel.nuclearScramLikely'), colorClass: 'critical' });
  }
  if (infra.nuclearScramPossible > 0) {
    rows.push({ icon: '\u2622\uFE0F', count: infra.nuclearScramPossible, label: t('panel.impactIntel.nuclearScramPossible'), colorClass: 'priority' });
  }
  if (infra.railLinesSuspended > 0) {
    rows.push({ icon: '\uD83D\uDE84', count: infra.railLinesSuspended, label: t('panel.impactIntel.railSuspended'), colorClass: 'critical' });
  }
  if (infra.railLinesAffected > 0) {
    rows.push({ icon: '\uD83D\uDE84', count: infra.railLinesAffected, label: t('panel.impactIntel.railAffected'), colorClass: 'priority' });
  }
  if (infra.vesselsHighPriority > 0) {
    rows.push({ icon: '\uD83D\uDEA2', count: infra.vesselsHighPriority, label: t('panel.impactIntel.vesselsHigh'), colorClass: 'critical' });
  }
  if (infra.vesselsInZone > 0) {
    rows.push({ icon: '\uD83D\uDEA2', count: infra.vesselsInZone, label: t('panel.impactIntel.vesselsInZone'), colorClass: 'priority' });
  }

  return rows;
}

function renderInfraSection(infra: InfraImpactSummary): string {
  const rows = buildInfraRows(infra);
  if (rows.length === 0) return '';

  const html = rows.map((r) => `
    <div class="nz-intel__infra-row">
      <span class="nz-intel__infra-icon">${r.icon}</span>
      <span class="nz-intel__infra-count nz-intel__infra-count--${r.colorClass}">${r.count}</span>
      <span class="nz-intel__infra-label">${r.label}</span>
    </div>
  `).join('');

  return `<div class="nz-intel__infra">${html}</div>`;
}

interface PopEntry {
  label: string;
  value: number;
  color: string;
}

function renderPopulationSection(pop: PopulationExposure): string {
  // Build cumulative entries (each is "X or higher")
  const entries: PopEntry[] = [
    { label: '7', value: pop.jma7, color: JMA_COLORS['7'] },
    { label: '6+', value: pop.jma6plus, color: JMA_COLORS['6+'] },
    { label: '6-', value: pop.jma6minus, color: JMA_COLORS['6-'] },
    { label: '5+', value: pop.jma5plus, color: JMA_COLORS['5+'] },
    { label: '5-', value: pop.jma5minus, color: JMA_COLORS['5-'] },
    { label: '4+', value: pop.jma4plus, color: JMA_COLORS['4'] },
    { label: '3+', value: pop.jma3plus, color: JMA_COLORS['3'] },
  ];

  const nonZero = entries.filter((e) => e.value > 0);
  if (nonZero.length === 0) return '';

  const maxVal = Math.max(...nonZero.map((e) => e.value));

  // Hero number: highest severity with affected population
  const heroEntry = nonZero[0];
  const heroLabel = `${t('impact.jmaPrefix')}${heroEntry.label}${t('impact.above')}`;
  const cityBucket = pop.topMunicipalitiesByThreshold?.[heroEntry.label as keyof NonNullable<typeof pop.topMunicipalitiesByThreshold>]
    ?? pop.topAffected;

  // Bar chart
  const bars = nonZero.map((e) => {
    const pct = maxVal > 0 ? Math.max(2, (e.value / maxVal) * 100) : 2;
    return `
      <div class="nz-intel__pop-row">
        <span class="nz-intel__pop-class">${e.label}</span>
        <span class="nz-intel__pop-bar" style="width:${pct}%;background:${e.color}"></span>
        <span class="nz-intel__pop-value">${formatPopulationShort(e.value)}</span>
      </div>
    `;
  }).join('');

  // Top affected cities
  const cityRows = cityBucket.slice(0, 5).map((c) => {
    const color = JMA_COLORS[c.jmaClass] || '#94a3b8';
    const displayedPopulation = c.exposedPopulation ?? c.population;
    return `
      <div class="nz-intel__pop-city">
        <span class="nz-intel__pop-city-class" style="color:${color}">${c.jmaClass}</span>
        <span class="nz-intel__pop-city-name">${c.name}</span>
        <span class="nz-intel__pop-city-pop">${formatPopulationShort(displayedPopulation)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-intel__population">
      <div class="nz-intel__pop-header">${t('panel.impactIntel.populationExposure')}</div>
      <div class="nz-intel__pop-hero">
        <span class="nz-intel__pop-hero-value" style="color:${heroEntry.color}">${formatPopulationShort(heroEntry.value)}</span>
        <span class="nz-intel__pop-hero-label">${heroLabel}</span>
      </div>
      ${bars}
      ${cityRows ? `<div class="nz-intel__pop-cities">${cityRows}</div>` : ''}
      <div class="nz-intel__pop-source">${tf('impact.dataSource', { n: pop.assessedUnits ?? pop.topAffected.length })} · ${formatPopulationCoverage(pop.coverage?.catalogedPopulation ?? pop.catalogedPopulation, pop.coverage?.totalPopulation ?? pop.totalPopulation)}</div>
    </div>
  `;
}

// ── Intensity Area Coverage Section ──────────────────────────

interface AreaEntry {
  label: string;
  value: number;
  color: string;
}

function renderAreaSection(stats: IntensityAreaStats): string {
  if (stats.coverageKind === 'modeled_field') {
    return `
      <div class="nz-intel__area">
        <div class="nz-intel__area-header">${t('panel.impactIntel.intensityCoverage')}</div>
        <div class="nz-intel__disclaimer">Modeled field area withheld until land-only coverage is available.</div>
      </div>
    `;
  }

  const entries: AreaEntry[] = [
    { label: '7', value: stats.jma7, color: JMA_COLORS['7'] },
    { label: '6+', value: stats.jma6plus, color: JMA_COLORS['6+'] },
    { label: '6-', value: stats.jma6minus, color: JMA_COLORS['6-'] },
    { label: '5+', value: stats.jma5plus, color: JMA_COLORS['5+'] },
    { label: '5-', value: stats.jma5minus, color: JMA_COLORS['5-'] },
    { label: '4+', value: stats.jma4plus, color: JMA_COLORS['4'] },
  ];

  // Only show entries with non-zero values
  const nonZero = entries.filter((e) => e.value > 0);
  if (nonZero.length === 0) return '';

  const maxVal = Math.max(...nonZero.map((e) => e.value));

  const rows = nonZero.map((e) => {
    const pct = maxVal > 0 ? Math.max(2, (e.value / maxVal) * 100) : 2;
    return `
      <div class="nz-intel__area-row">
        <span class="nz-intel__area-class">${e.label}</span>
        <span class="nz-intel__area-bar" style="width:${pct}%;background:${e.color}"></span>
        <span class="nz-intel__area-value">${formatAreaKm2(e.value)}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-intel__area">
      <div class="nz-intel__area-header">${t('panel.impactIntel.intensityCoverage')}</div>
      ${rows}
    </div>
  `;
}

// ── Tsunami ETA Section ──────────────────────────────────────

function renderTsunamiSection(etas: TsunamiETA[]): string {
  if (etas.length === 0) return '';

  const sorted = [...etas].sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);
  const top5 = sorted.slice(0, 5);

  const rows = top5.map((eta) => `
    <div class="nz-intel__eta-row">
      <span class="nz-intel__eta-port">${eta.portNameJa}</span>
      <span class="nz-intel__eta-time">${formatMinutesShort(eta.estimatedMinutes)}</span>
      <span class="nz-intel__eta-dist">${formatDistanceKm(eta.distanceKm)}</span>
    </div>
  `).join('');

  return `
    <div class="nz-intel__tsunami">
      <div class="nz-intel__tsunami-header">${t('panel.impactIntel.tsunamiETA')}</div>
      ${rows}
    </div>
  `;
}

function renderConsequenceMatrix(intel: ImpactIntelligence, readModel?: ServiceReadModel): string {
  const fallbackReadModel: ServiceReadModel = readModel ?? {
    currentEvent: null,
    eventTruth: null,
    viewport: null,
    nationalSnapshot: null,
    systemHealth: {
      level: 'nominal',
      headline: 'Nominal',
      detail: 'All sources healthy.',
      flags: [],
    },
    operationalOverview: {
      selectionReason: null,
      selectionSummary: 'Operational focus active',
      impactSummary: 'No elevated posture',
      visibleAffectedAssetCount: 0,
      nationalAffectedAssetCount: 0,
      topRegion: null,
      topSeverity: 'clear',
    },
    bundleSummaries: {},
    nationalExposureSummary: [],
    visibleExposureSummary: [],
    nationalPriorityQueue: [],
    visiblePriorityQueue: [],
    freshnessStatus: {
      source: 'server',
      state: 'fresh',
      updatedAt: 0,
      staleAfterMs: 60_000,
    },
  };
  const cards = buildDecisionStackModel({
    readModel: fallbackReadModel,
    impactIntelligence: intel,
  }).matrixCards;

  if (cards.length === 0) return '';

  return `
    <div class="nz-intel__matrix">
      <div class="nz-intel__matrix-header">${t('panel.impactIntel.consequenceMatrix')}</div>
      <div class="nz-intel__matrix-grid">
        ${cards.map((card) => `
          <div class="nz-intel__matrix-card nz-intel__matrix-card--${card.severity}">
            <div class="nz-intel__matrix-label">${card.label}</div>
            <div class="nz-intel__matrix-value">${card.value}</div>
            <div class="nz-intel__matrix-detail">${card.detail}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ── Response Timeline Section ────────────────────────────────

function renderTimelineSection(milestones: ResponseMilestone[], event: EarthquakeEvent): string {
  if (milestones.length === 0) return '';

  const now = Date.now();

  const items = milestones.map((m) => {
    const threshold = event.time + m.minutesAfter * 60_000;
    const elapsed = now >= threshold;
    const triggered = m.triggered;

    let itemClass = 'nz-intel__timeline-item';
    let indicator: string;

    if (triggered && elapsed) {
      // Past and triggered: green check
      itemClass += ' nz-intel__timeline-item--triggered nz-intel__timeline-item--elapsed';
      indicator = '<span class="nz-intel__timeline-check">\u2713</span>';
    } else if (triggered) {
      // Triggered but future: active
      itemClass += ' nz-intel__timeline-item--triggered';
      indicator = '<span class="nz-intel__timeline-pending">\u25CB</span>';
    } else {
      // Not triggered: dim
      indicator = '<span class="nz-intel__timeline-pending">\u2014</span>';
    }

    const timeLabel = m.minutesAfter === 0 ? 'T+0' : `T+${m.minutesAfter}m`;

    return `
      <div class="${itemClass}">
        <span class="nz-intel__timeline-time">${timeLabel}</span>
        ${indicator}
        <div>
          <span class="nz-intel__timeline-label">${m.labelJa || m.label}</span>
          <div class="nz-intel__timeline-desc">${m.description}</div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-intel__timeline">
      <div class="nz-intel__timeline-header">${t('panel.impactIntel.responseProtocol')}</div>
      ${items}
    </div>
  `;
}

// ── Domain Action Summary ────────────────────────────────────

/** Class icons matching assetClassRegistry */
const CLASS_ICONS: Record<string, string> = {
  hospital: '\u271A',
  nuclear_plant: '\u2622\uFE0F',
  dam: '\u{1F30A}',
  power_substation: '\u26A1',
  rail_hub: '\u{1F689}',
  airport: '\u2708\uFE0F',
  port: '\u2693',
  water_facility: '\u{1F4A7}',
  telecom_hub: '\u{1F4F6}',
  government_eoc: '\u{1F3DB}\uFE0F',
  evacuation_site: '\u{1F6A9}',
  lng_terminal: '\u{1F525}',
  building_cluster: '\u{1F3E2}',
};

/**
 * Aggregate domain actions across all non-clear exposures.
 * Groups "immediate" actions by asset class for operator awareness.
 */
function renderDomainActionSummary(exposures: OpsAssetExposure[]): string {
  // Count immediate actions per class
  const classImmediateCount = new Map<string, number>();
  const classTopAction = new Map<string, string>();

  for (const exp of exposures) {
    if (!exp.domainIntel || exp.severity === 'clear') continue;
    const immediateActions = exp.domainIntel.actions.filter(
      (a) => a.urgency === 'immediate',
    );
    if (immediateActions.length === 0) continue;

    // Look up asset class from the first action key pattern: domain.<class>.<action>
    const actionKey = immediateActions[0].action;
    const match = actionKey.match(/^domain\.(\w+)\./);
    if (!match) continue;
    const cls = match[1];

    // Map short class names to full OpsAssetClass
    const classMap: Record<string, string> = {
      hospital: 'hospital',
      nuclear: 'nuclear_plant',
      dam: 'dam',
      power: 'power_substation',
      rail: 'rail_hub',
      airport: 'airport',
      port: 'port',
      water: 'water_facility',
      telecom: 'telecom_hub',
      eoc: 'government_eoc',
      evac: 'evacuation_site',
      lng: 'lng_terminal',
      building: 'building_cluster',
    };
    const fullClass = classMap[cls] ?? cls;
    classImmediateCount.set(fullClass, (classImmediateCount.get(fullClass) ?? 0) + 1);
    if (!classTopAction.has(fullClass)) {
      classTopAction.set(fullClass, actionKey);
    }
  }

  if (classImmediateCount.size === 0) return '';

  // Sort by count descending
  const sorted = [...classImmediateCount.entries()].sort((a, b) => b[1] - a[1]);

  const rows = sorted.map(([cls, count]) => {
    const icon = CLASS_ICONS[cls] ?? '\u26A0';
    const actionKey = classTopAction.get(cls) ?? '';
    const actionLabel = t(actionKey);
    return `
      <div class="nz-intel__domain-row">
        <span class="nz-intel__domain-icon">${icon}</span>
        <span class="nz-intel__domain-count">${count}</span>
        <span class="nz-intel__domain-action">${actionLabel}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="nz-intel__domain-summary">
      <div class="nz-intel__section-label">${t('panel.impactIntel.domainActions')}</div>
      ${rows}
    </div>
  `;
}

// ── Empty State ──────────────────────────────────────────────

function renderEmpty(): string {
  return `
    <div class="nz-panel nz-panel--collapsed" id="nz-impact-intel">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('panel.impactIntel.title')}</span>
      </div>
      <div class="nz-intel__empty">${t('panel.impactIntel.selectEvent')}</div>
    </div>
  `;
}

// ── Full Panel ───────────────────────────────────────────────

export function renderImpactIntelligenceMarkup(
  intel: ImpactIntelligence,
  event: EarthquakeEvent,
  readModel?: ServiceReadModel,
): string {
  // Use land peak for panel severity styling (more accurate for ops decisions)
  const effectiveJma = intel.landPeakIntensity?.jmaClass ?? intel.peakIntensity?.jmaClass ?? null;
  const severity = severityFromJma(effectiveJma);

  const sections: string[] = [];

  // Section 1: Peak intensity
  if (intel.peakIntensity) {
    sections.push(renderPeakIntensity(intel.peakIntensity, intel.landPeakIntensity, event));
  }
  sections.push(renderConsequenceMatrix(intel, readModel));

  // Section 2: Population exposure
  if (intel.populationExposure && intel.populationExposure.jma3plus > 0) {
    sections.push(renderPopulationSection(intel.populationExposure));
  }

  // Section 3: Infrastructure impact
  if (intel.infraSummary) {
    sections.push(renderInfraSection(intel.infraSummary));
  }

  // Section 3b: Domain action summary (aggregated from exposure pipeline)
  const exposures = consoleStore.get('exposures');
  const domainSummary = renderDomainActionSummary(exposures);
  if (domainSummary) {
    sections.push(domainSummary);
  }

  // Section 4: Intensity area coverage
  if (intel.areaStats) {
    sections.push(renderAreaSection(intel.areaStats));
  }

  // Section 4: Tsunami ETA
  sections.push(renderTsunamiSection(intel.tsunamiSummary?.arrivalEstimatesMin ?? intel.tsunamiETAs));

  // Section 5: Response timeline
  sections.push(renderTimelineSection(intel.responseTimeline, event));

  // Filter empty strings
  const content = sections.filter((s) => s.length > 0).join('');

  return `
    <div class="nz-panel nz-panel--sev-${severity}" id="nz-impact-intel">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('panel.impactIntel.title')}</span>
      </div>
      ${content}
      <div class="nz-intel__disclaimer">${t('disclaimer.beta.short')}</div>
    </div>
  `;
}

// ── Mount ────────────────────────────────────────────────────

export function mountImpactIntelligence(container: HTMLElement): () => void {
  function render(): void {
    const event = consoleStore.get('selectedEvent');
    if (!event) {
      container.innerHTML = renderEmpty();
      return;
    }

    const grid = consoleStore.get('intensityGrid');
    const vessels = consoleStore.get('vessels');

    const intel = computeImpactIntelligence({ event, grid, vessels });
    container.innerHTML = renderImpactIntelligenceMarkup(intel, event, consoleStore.get('readModel'));
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
  const unsub2 = consoleStore.subscribe('intensityGrid', scheduleRender);
  const unsub3 = consoleStore.subscribe('vessels', scheduleRender);
  const unsub4 = consoleStore.subscribe('readModel', scheduleRender);
  const unsub5 = onLocaleChange(() => scheduleRender());

  return () => {
    unsub1();
    unsub2();
    unsub3();
    unsub4();
    unsub5();
  };
}
