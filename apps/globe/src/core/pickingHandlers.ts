/**
 * Picking Handlers — Tooltip and click callbacks for all pickable Deck.gl layers.
 *
 * Extracted from bootstrap.ts so the picking logic can be tested and reused
 * independently of the full console boot sequence.
 */

import type { EarthquakeEvent, ActiveFault } from '../types';
import { consoleStore } from './store';
import { formatVesselTooltip } from '../layers/aisLayer';
import { formatFaultTooltip } from '../layers/faultLayer';
import { formatHospitalTooltip, type Hospital } from '../layers/hospitalLayer';
import { formatRailTooltip, type RailRoute } from '../layers/railLayer';
import { formatPowerTooltip, type PowerPlant } from '../layers/powerLayer';
import type { Vessel } from '../data/aisManager';
import { t } from '../i18n';

// ── Public Interfaces ────────────────────────────────────────

export interface PickingDeps {
  selectEvent: (event: EarthquakeEvent) => void;
  deselectEvent: () => void;
  toScenarioEvent: (scenario: import('../types').ScenarioDefinition) => EarthquakeEvent | null;
}

// ── Tooltip Handler ──────────────────────────────────────────

/**
 * Returns an HTML tooltip string for the hovered Deck.gl feature, or null
 * when no tooltip should be shown.
 */
export function createTooltipHandler(): (info: any) => { html: string } | null {
  return (info) => {
    if (info.layer?.id === 'ais-vessels' && info.object) {
      const vessel = info.object as Vessel;
      const selected = consoleStore.get('selectedEvent');
      return { html: formatVesselTooltip(vessel, selected) };
    }
    if (info.layer?.id === 'hospitals' && info.object) {
      const hospital = info.object as Hospital;
      const selected = consoleStore.get('selectedEvent');
      return { html: formatHospitalTooltip(hospital, selected) };
    }
    if (info.layer?.id === 'rail' && info.object) {
      const route = info.object as RailRoute;
      const selected = consoleStore.get('selectedEvent');
      return { html: formatRailTooltip(route, selected, consoleStore.get('railStatuses')) };
    }
    if (info.layer?.id === 'power' && info.object) {
      const plant = info.object as PowerPlant;
      const selected = consoleStore.get('selectedEvent');
      return { html: formatPowerTooltip(plant, selected) };
    }
    if (info.layer?.id === 'active-faults' && info.object) {
      const fault = info.object as ActiveFault;
      const scenario = consoleStore.get('scenarioMode');
      const hint = scenario
        ? `<div style="color:#fbbf24;font-size:10px;margin-top:4px">${t('fault.hint')}</div>`
        : '';
      return { html: formatFaultTooltip(fault) + hint };
    }
    if (info.layer?.id === 'asset-markers' && info.object) {
      const asset = info.object as import('../ops/types').OpsAsset;
      return {
        html: `<div style="font-family:var(--nz-font-ui);font-size:12px;font-weight:600">${asset.name}</div><div style="font-size:10px;color:#a1afc2;margin-top:2px">${asset.class.replace(/_/g, ' ')} \u00B7 ${asset.region}</div>`,
      };
    }
    return null;
  };
}

// ── Click Handler ────────────────────────────────────────────

/**
 * Handles click events on pickable Deck.gl features:
 *   - Earthquake dot  → select event
 *   - Active fault    → select corresponding scenario event (scenario mode only)
 *   - Asset marker    → highlight asset
 *   - Empty space     → deselect everything
 */
export function createClickHandler(deps: PickingDeps): (info: any) => void {
  const { selectEvent, deselectEvent, toScenarioEvent } = deps;
  return (info) => {
    if (info.layer?.id === 'earthquakes' && info.object) {
      selectEvent(info.object as EarthquakeEvent);
    } else if (info.layer?.id === 'active-faults' && info.object && consoleStore.get('scenarioMode')) {
      const fault = info.object as ActiveFault;
      const scenario = consoleStore.get('scenarios').find((entry) => entry.faultId === fault.id);
      const event = scenario ? toScenarioEvent(scenario) : null;
      if (event) {
        selectEvent(event);
      }
    } else if (info.layer?.id === 'asset-markers' && info.object) {
      const asset = info.object as import('../ops/types').OpsAsset;
      consoleStore.set('selectedAssetId', asset.id);
      consoleStore.set('highlightedAssetId', asset.id);
    } else if (!info.object) {
      deselectEvent();
      consoleStore.set('selectedAssetId', null);
      consoleStore.set('highlightedAssetId', null);
    }
  };
}
