/**
 * Maritime Exposure Panel — Left rail, below asset exposure.
 *
 * During event mode: shows vessel count in impact zone,
 * broken down by type with operational priority indicators.
 * Calm mode: shows total tracked vessel count.
 */

import { consoleStore } from '../core/store';
import { t, tf } from '../i18n';
import {
  computeMaritimeExposure,
} from '../layers/aisLayer';
import { buildMaritimeOverview } from '../ops/maritimeTelemetry';
import { buildSectorStressModel } from '../presentation/sectorStress';

function renderCalm(summary: string, vesselCount: number): string {
  if (vesselCount === 0) return '';
  return `
    <div class="nz-panel" id="nz-maritime">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('panel.sectorStress.maritime')}</span>
        <span class="nz-maritime__count">${vesselCount} ${t('panel.sectorStress.tracked')}</span>
      </div>
      <div class="nz-maritime__summary">${summary}</div>
    </div>
  `;
}

function renderExposure(input: {
  totalInZone: number;
  passengerCount: number;
  tankerCount: number;
  cargoCount: number;
  fishingCount: number;
  summary: string;
  vesselCount: number;
}): string {
  const rows: string[] = [];

  if (input.passengerCount > 0) {
    rows.push(`
      <div class="nz-maritime__row nz-maritime__row--critical">
        <span class="nz-maritime__type-dot" style="background:#7dd3fc"></span>
        <span class="nz-maritime__type-label">${t('exposure.shipType.passenger')}</span>
        <span class="nz-maritime__type-count">${input.passengerCount}</span>
        <span class="nz-maritime__type-sev">${t('maritime.highPriority')}</span>
      </div>
    `);
  }
  if (input.tankerCount > 0) {
    rows.push(`
      <div class="nz-maritime__row nz-maritime__row--priority">
        <span class="nz-maritime__type-dot" style="background:#fbbf24"></span>
        <span class="nz-maritime__type-label">${t('exposure.shipType.tanker')}</span>
        <span class="nz-maritime__type-count">${input.tankerCount}</span>
        <span class="nz-maritime__type-sev">${t('maritime.hazmat')}</span>
      </div>
    `);
  }
  if (input.cargoCount > 0) {
    rows.push(`
      <div class="nz-maritime__row">
        <span class="nz-maritime__type-dot" style="background:#94a3b8"></span>
        <span class="nz-maritime__type-label">${t('exposure.shipType.cargo')}</span>
        <span class="nz-maritime__type-count">${input.cargoCount}</span>
      </div>
    `);
  }
  if (input.fishingCount > 0) {
    rows.push(`
      <div class="nz-maritime__row">
        <span class="nz-maritime__type-dot" style="background:#6ee7b7"></span>
        <span class="nz-maritime__type-label">${t('exposure.shipType.fishing')}</span>
        <span class="nz-maritime__type-count">${input.fishingCount}</span>
      </div>
    `);
  }

  return `
    <div class="nz-panel" id="nz-maritime">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('maritime.exposureTitle')}</span>
        <span class="nz-maritime__count nz-maritime__count--alert">${input.totalInZone} ${t('panel.sectorStress.inZone')}</span>
      </div>
      <div class="nz-maritime__summary">${input.summary}</div>
      <div class="nz-maritime__breakdown">${rows.join('')}</div>
      <div class="nz-maritime__total">${tf('maritime.totalTracked', { n: input.vesselCount })}</div>
    </div>
  `;
}

export function mountMaritimeExposure(container: HTMLElement): () => void {
  function render(): void {
    const vessels = consoleStore.get('vessels');
    const selectedEvent = consoleStore.get('selectedEvent');

    if (vessels.length === 0) {
      container.innerHTML = '';
      return;
    }

    const overview = buildMaritimeOverview(vessels);
    const exposure = computeMaritimeExposure(vessels, selectedEvent);
    const model = buildSectorStressModel({
      exposures: consoleStore.get('exposures'),
      maritimeExposure: exposure,
      maritimeOverview: overview,
    });

    if (exposure.totalInZone > 0) {
      container.innerHTML = renderExposure({
        totalInZone: model.maritime.inImpactZone,
        passengerCount: exposure.passengerCount,
        tankerCount: exposure.tankerCount,
        cargoCount: exposure.cargoCount,
        fishingCount: exposure.fishingCount,
        summary: model.maritime.summary,
        vesselCount: model.maritime.totalTracked,
      });
    } else {
      container.innerHTML = renderCalm(model.maritime.summary, model.maritime.totalTracked);
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
  const unsub1 = consoleStore.subscribe('vessels', scheduleRender);
  const unsub2 = consoleStore.subscribe('selectedEvent', scheduleRender);

  return () => {
    unsub1();
    unsub2();
  };
}
