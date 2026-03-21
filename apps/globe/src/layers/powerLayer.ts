/**
 * Power Layer — Nuclear and major thermal power plants.
 *
 * Nuclear SCRAM inference: When an earthquake is selected, computes
 * GMPE intensity at each nuclear plant site. PGA > 120 gal triggers
 * visual SCRAM indicator.
 *
 * Visual:
 *   Nuclear operating: amber icon
 *   Nuclear shutdown: dim amber
 *   Nuclear SCRAM likely: pulsing red
 *   Thermal: smaller gray icons
 *   In impact zone: red highlight
 */

import { IconLayer, TextLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { Layer } from '@deck.gl/core';
import type { EarthquakeEvent } from '../types';
import { haversine } from '../engine/gmpe';
import { ICON_ATLAS_URL, ICON_MAPPING } from './iconAtlas';
import { pickVisibleLabels, type LabelBounds } from './labelPolicy';
import {
  assessPowerPlant,
  type PowerPlant,
  type ScramLikelihood,
} from '../ops/powerAssessment';
import { POWER_PLANTS } from '../ops/powerCatalog';

type RGBA = [number, number, number, number];

export type { PlantStatus, PlantType, PowerPlant, ScramLikelihood } from '../ops/powerAssessment';

interface PowerDatum extends PowerPlant {
  inZone: boolean;
  scramLikelihood: ScramLikelihood;
  estimatedIntensity: number;
  estimatedPgaGal: number;
}

// Status colors — now handled by ring layers, kept for label reference

// ── SCRAM Inference ─────────────────────────────────────────

/**
 * Approximate PGA (gal) from JMA instrumental intensity.
 *
 * Uses the empirical relationship between JMA intensity and peak ground
 * acceleration. The JMA intensity scale is defined as:
 *   I_JMA = 2 * log10(a_filtered) + 0.94
 * where a_filtered is the vector sum of filtered accelerations (not raw PGA).
 *
 * For approximate PGA estimation, we use the inverse:
 *   PGA_approx ≈ 10^((I - 0.94) / 2)
 *
 * This gives values consistent with Midorikawa et al. (1999) empirical
 * PGA-intensity relationship and JMA published intensity-acceleration tables:
 *   JMA 5- (I=4.5): ~105 gal   (JMA range: 80-110)
 *   JMA 6- (I=5.5): ~190 gal   (JMA range: 180-250)
 *   JMA 6+ (I=6.0): ~338 gal   (JMA range: 250-400)
 *
 * Reference: JMA "計測震度の算出方法" (Method of computing instrumental intensity)
 * https://www.data.jma.go.jp/eqev/data/kyoshin/kaisetsu/calc_sindo.html
 */
/**
 * Estimate SCRAM (automatic reactor shutdown) likelihood from PGA.
 *
 * Japanese nuclear plants have seismic automatic shutdown systems (地震感知器)
 * that trigger reactor trip when observed ground acceleration exceeds a
 * design-specific setpoint.
 *
 * Historical SCRAM trigger levels (NRA 原子力規制委員会):
 *   - Pre-2006 (S1 design basis): ~120 gal horizontal at reactor building base
 *   - Post-2006 (Ss design basis): 450-993 gal depending on plant
 *     (e.g., Sendai: 620 gal, Ohi: 856 gal, Mihama: 993 gal)
 *   - Actual seismic SCRAM setpoints are typically lower than Ss, around
 *     120-200 gal for most plants.
 *
 * Historical events:
 *   - 2007 NCO earthquake: Kashiwazaki-Kariwa, 680 gal observed, all 7 units tripped
 *   - 2011 Tohoku: Onagawa, ~540 gal observed, safe automatic shutdown
 *   - 2016 Kumamoto: Sendai, ~8 gal observed (distant), no SCRAM
 *
 * Reference: NRA "新規制基準の概要" (Overview of New Regulatory Requirements);
 * each plant's "設置変更許可申請書" (Installation Change Permit Application)
 * documents the specific Ss and SCRAM setpoint values.
 *
 * The thresholds below are conservative approximations for the visualization.
 * Actual SCRAM decisions depend on plant-specific setpoints and observed
 * acceleration at the reactor building, not at the free-field surface.
 */
// ── Tooltip ──────────────────────────────────────────────────

const SCRAM_LABELS: Record<ScramLikelihood, { text: string; color: string }> = {
  none: { text: '', color: '' },
  unlikely: { text: 'SCRAM unlikely', color: '#94a3b8' },
  possible: { text: 'SCRAM possible', color: '#fb923c' },
  likely: { text: 'SCRAM LIKELY', color: '#ef4444' },
  certain: { text: 'SCRAM CERTAIN', color: '#ef4444' },
};

export function formatPowerTooltip(p: PowerPlant, event: EarthquakeEvent | null): string {
  const assessment = assessPowerPlant(p, event);
  const inZone = assessment.inImpactZone;
  const { intensity, pgaGal, scram } = assessment;
  const typeLabel = p.type === 'nuclear' ? 'Nuclear' : 'Thermal';
  const statusLabel = p.status === 'operating' ? '● Operating'
    : p.status === 'decommissioning' ? '◌ Decommissioning'
    : '○ Shutdown';
  const statusColor = p.status === 'operating' ? '#6ee7b7'
    : p.status === 'decommissioning' ? '#c8504660'
    : '#94a3b8';

  let scramHtml = '';
  if (scram !== 'none' && p.type === 'nuclear') {
    const label = SCRAM_LABELS[scram];
    scramHtml = `
      <div style="color:${label.color};font-weight:600;margin-top:4px">${label.text}</div>
      <div style="opacity:0.6;font-size:10px">
        Est. intensity ${intensity.toFixed(1)} · PGA ~${Math.round(pgaGal)} gal
      </div>`;
  }

  let zoneHtml = '';
  if (inZone && !scramHtml) {
    zoneHtml = '<div style="color:#ef4444;font-weight:600;margin-top:4px">IN IMPACT ZONE — Verify plant status</div>';
  }

  return `
    <div style="font-weight:600;font-size:12px;margin-bottom:3px">${p.name}</div>
    <div style="opacity:0.7;font-size:11px">${p.nameEn}</div>
    <div style="margin-top:4px;display:flex;gap:12px">
      <span>${typeLabel}</span>
      <span style="color:${statusColor}">${statusLabel}</span>
    </div>
    <div style="opacity:0.6;font-size:10px;margin-top:2px">
      ${p.capacityMw > 0 ? `${p.capacityMw} MW · ` : ''}${p.units} unit${p.units > 1 ? 's' : ''}
    </div>
    ${scramHtml}
    ${zoneHtml}
  `;
}

// ── Layer Factory ────────────────────────────────────────────

export function createPowerLayers(
  selectedEvent: EarthquakeEvent | null,
  zoom: number,
  sWaveRadiusKm: number | null = null,
  bounds?: LabelBounds | null,
): Layer[] {
  const minZoom = 4;
  if (zoom < minZoom) return [];

  const showThermal = zoom >= 5;
  const filtered = showThermal
    ? POWER_PLANTS
    : POWER_PLANTS.filter((p) => p.type === 'nuclear');

  const data: PowerDatum[] = filtered.map((p) => {
    const assessment = assessPowerPlant(p, selectedEvent);
    let inZone = assessment.inImpactZone;
    let scramLikelihood = assessment.scram;

    // S-wave cascade: override to pre-impact state if wave hasn't reached this plant yet
    if (sWaveRadiusKm !== null && selectedEvent) {
      const distKm = haversine(selectedEvent.lat, selectedEvent.lng, p.lat, p.lng);
      if (distKm > sWaveRadiusKm) {
        scramLikelihood = 'none';
        inZone = false;
      }
    }

    return {
      ...p,
      inZone,
      scramLikelihood,
      estimatedIntensity: assessment.intensity,
      estimatedPgaGal: assessment.pgaGal,
    };
  });

  const layers: Layer[] = [];

  // SCRAM glow rings — pulsing red circles behind SCRAM-likely nuclear plants
  const scramPlants = data.filter((d) =>
    d.type === 'nuclear' && (d.scramLikelihood === 'likely' || d.scramLikelihood === 'certain'),
  );
  if (scramPlants.length > 0) {
    layers.push(new ScatterplotLayer<PowerDatum>({
      id: 'power-scram-glow',
      data: scramPlants,
      pickable: false,
      stroked: true,
      filled: true,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 24,
      getFillColor: [239, 68, 68, 25],
      getLineColor: [239, 68, 68, 80],
      getLineWidth: 1.5,
      updateTriggers: { getRadius: [selectedEvent?.id, sWaveRadiusKm] },
    }));
  }

  // Zone rings — for non-SCRAM plants in impact zone
  const zoneNonScram = data.filter(d =>
    d.inZone && d.scramLikelihood !== 'likely' && d.scramLikelihood !== 'certain',
  );
  if (zoneNonScram.length > 0) {
    layers.push(new ScatterplotLayer<PowerDatum>({
      id: 'power-zone-rings',
      data: zoneNonScram,
      pickable: false,
      stroked: true,
      filled: true,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 16,
      getFillColor: [239, 68, 68, 25] as RGBA,
      getLineColor: [239, 68, 68, 120] as RGBA,
      getLineWidth: 1.5,
      updateTriggers: { getRadius: [selectedEvent?.id, sWaveRadiusKm] },
    }));
  }

  // SCRAM possible — orange ring
  const scramPossible = data.filter(d =>
    d.type === 'nuclear' && d.scramLikelihood === 'possible',
  );
  if (scramPossible.length > 0) {
    layers.push(new ScatterplotLayer<PowerDatum>({
      id: 'power-scram-possible-rings',
      data: scramPossible,
      pickable: false,
      stroked: true,
      filled: true,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      getPosition: (d) => [d.lng, d.lat],
      getRadius: 18,
      getFillColor: [251, 146, 60, 20] as RGBA,
      getLineColor: [251, 146, 60, 120] as RGBA,
      getLineWidth: 1.5,
      updateTriggers: { getRadius: [selectedEvent?.id, sWaveRadiusKm] },
    }));
  }

  // Icon markers — colored icons (mask: false), size by importance
  layers.push(new IconLayer<PowerDatum>({
    id: 'power',
    data,
    pickable: true,
    autoHighlight: true,
    highlightColor: [251, 191, 36, 200],
    iconAtlas: ICON_ATLAS_URL,
    iconMapping: ICON_MAPPING,
    getIcon: (d) => d.type === 'nuclear' ? 'nuclear' : 'thermal',
    getPosition: (d) => [d.lng, d.lat],
    getSize: (d) => {
      if (d.scramLikelihood === 'certain' || d.scramLikelihood === 'likely') return 26;
      if (d.scramLikelihood === 'possible') return 22;
      if (d.type === 'nuclear') return d.inZone ? 22 : 20;
      return d.inZone ? 18 : 16;
    },
    sizeUnits: 'pixels',
    sizeMinPixels: 10,
    getColor: [255, 255, 255, 255] as RGBA,
    updateTriggers: {
      getSize: [selectedEvent?.id, sWaveRadiusKm],
    },
  }));

  // Labels for nuclear plants at z6+
  if (zoom >= 6) {
    const nuclear = data.filter((d) => d.type === 'nuclear');
    const labelData = pickVisibleLabels(nuclear, {
      bounds,
      cap: zoom >= 9 ? 8 : 4,
      focus: selectedEvent ? { lat: selectedEvent.lat, lng: selectedEvent.lng } : null,
      getPriority: (datum) => {
        if (datum.scramLikelihood === 'certain' || datum.scramLikelihood === 'likely') return 220;
        if (datum.scramLikelihood === 'possible') return 150;
        if (datum.inZone) return 120;
        return datum.status === 'operating' ? 80 : 20;
      },
    });

    layers.push(new TextLayer<PowerDatum>({
      id: 'power-labels',
      data: labelData,
      pickable: false,
      getPosition: (d) => [d.lng, d.lat],
      getText: (d) => {
        if (d.scramLikelihood === 'certain' || d.scramLikelihood === 'likely') {
          return `⚠ ${d.nameEn} — SCRAM`;
        }
        if (d.scramLikelihood === 'possible') {
          return `⚡ ${d.nameEn}`;
        }
        const prefix = d.status === 'decommissioning' ? '⊘ '
          : d.status === 'operating' ? '⚛ '
          : '';
        return `${prefix}${d.nameEn}`;
      },
      getSize: (d) => {
        if (d.scramLikelihood === 'likely' || d.scramLikelihood === 'certain') return 12;
        return 10;
      },
      getColor: (d) => {
        if (d.scramLikelihood === 'certain' || d.scramLikelihood === 'likely') return [239, 68, 68, 255];
        if (d.scramLikelihood === 'possible') return [251, 146, 60, 240];
        if (d.inZone) return [239, 68, 68, 220];
        return [251, 191, 36, 180];
      },
      getTextAnchor: 'start' as const,
      getAlignmentBaseline: 'center' as const,
      getPixelOffset: [12, 0],
      fontFamily: 'Noto Sans JP, system-ui, sans-serif',
      fontWeight: 500,
      outlineWidth: 2,
      outlineColor: [10, 14, 20, 200],
      updateTriggers: {
        getText: [selectedEvent?.id, sWaveRadiusKm],
        getColor: [selectedEvent?.id, sWaveRadiusKm],
        getSize: [selectedEvent?.id, sWaveRadiusKm],
      },
    }));
  }

  return layers;
}
