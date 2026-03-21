import { AFTERSHOCK_CASCADE_MIN_MAGNITUDE, supportsAftershockCascadeMagnitude } from './aftershockCascadeLayer';
import type { EventSequenceState } from './eventSequenceState';
import { getAllLayerDefinitions, type LayerId } from './layerRegistry';

export type SyntheticLayerGateId = 'aftershock-cascade';
export type LayerGateLayerId = LayerId | SyntheticLayerGateId;

export const INFRASTRUCTURE_LAYER_GATE_IDS = [
  'rail',
  'airports',
  'transport',
  'power',
  'water',
  'telecom',
  'hospitals',
] as const satisfies readonly LayerId[];

export type InfrastructureLayerGateId = (typeof INFRASTRUCTURE_LAYER_GATE_IDS)[number];

export type LayerGateCode =
  | 'requires-m5'
  | 'requires-city-zoom'
  | 'requires-intensity-grid'
  | 'unsupported-city'
  | 'waiting-sequence'
  | 'waiting-handoff';

export interface LayerGateStatus {
  layerId: LayerGateLayerId;
  code: LayerGateCode;
  blocking: boolean;
}

export type LayerGateStatusMap = Record<LayerGateLayerId, LayerGateStatus | null>;

const SYNTHETIC_GATEABLE_LAYER_IDS = [
  'aftershock-cascade',
] as const satisfies readonly SyntheticLayerGateId[];

const BLOCKING_LAYER_GATE_CODES = new Set<LayerGateCode>([
  'requires-m5',
  'requires-city-zoom',
  'requires-intensity-grid',
  'unsupported-city',
]);

export function createLayerGateStatus(
  layerId: LayerGateLayerId,
  code: LayerGateCode,
): LayerGateStatus {
  return {
    layerId,
    code,
    blocking: BLOCKING_LAYER_GATE_CODES.has(code),
  };
}

export function getGateableLayerIds(): LayerGateLayerId[] {
  return [
    ...getAllLayerDefinitions().map((definition) => definition.id),
    ...SYNTHETIC_GATEABLE_LAYER_IDS,
  ];
}

export function getInfrastructureLayerGateIds(): InfrastructureLayerGateId[] {
  return [...INFRASTRUCTURE_LAYER_GATE_IDS];
}

export function createDefaultLayerGateStatuses(): LayerGateStatusMap {
  return Object.fromEntries(
    getGateableLayerIds().map((layerId) => [layerId, null]),
  ) as LayerGateStatusMap;
}

export function getAftershockLayerGateStatus(magnitude: number | null | undefined): LayerGateStatus | null {
  if (magnitude == null || supportsAftershockCascadeMagnitude(magnitude)) return null;
  return createLayerGateStatus('aftershock-cascade', 'requires-m5');
}

export function getBuildingLayerGateStatus(input: {
  zoom: number;
  minimumZoom: number;
  hasSupportedCity: boolean;
  requiresIntensityGrid?: boolean;
}): LayerGateStatus | null {
  if (input.zoom < input.minimumZoom) {
    return createLayerGateStatus('buildings', 'requires-city-zoom');
  }

  if (!input.hasSupportedCity) {
    return createLayerGateStatus('buildings', 'unsupported-city');
  }

  if (input.requiresIntensityGrid) {
    return createLayerGateStatus('buildings', 'requires-intensity-grid');
  }

  return null;
}

export function getInfrastructureLayerGateStatus(input: {
  layerId: InfrastructureLayerGateId;
  waitFor: 'sequence' | 'handoff' | null;
}): LayerGateStatus | null {
  if (input.waitFor === 'sequence') {
    return createLayerGateStatus(input.layerId, 'waiting-sequence');
  }

  if (input.waitFor === 'handoff') {
    return createLayerGateStatus(input.layerId, 'waiting-handoff');
  }

  return null;
}

function getInfrastructureSequenceWaitFor(sequence: EventSequenceState): 'sequence' | 'handoff' | null {
  if (!sequence.active) return null;

  if (sequence.phase === 'infrastructure-handoff') {
    return 'handoff';
  }

  if (
    sequence.phase === 'epicenter-flash'
    || sequence.phase === 'p-wave'
    || sequence.phase === 's-wave'
    || sequence.phase === 'intensity-reveal'
  ) {
    return 'sequence';
  }

  return null;
}

function shouldWaitForAftershockCascade(sequence: EventSequenceState): boolean {
  return (
    sequence.phase === 'epicenter-flash'
    || sequence.phase === 'p-wave'
    || sequence.phase === 's-wave'
    || sequence.phase === 'intensity-reveal'
    || sequence.phase === 'infrastructure-handoff'
  );
}

export interface LayerGateCalculatorState {
  selectedEvent: {
    magnitude: number;
  } | null;
  intensityGrid: object | null;
  viewport: {
    zoom: number;
  };
  buildingSupport: BuildingLayerSupportFacts;
}

export interface BuildingLayerSupportFacts {
  minimumZoom: number;
  hasSupportedCity: boolean;
}

export function buildLayerGateStatuses(input: {
  state: LayerGateCalculatorState;
  sequence: EventSequenceState;
}): LayerGateStatusMap {
  const statuses = createDefaultLayerGateStatuses();
  const {
    selectedEvent,
    intensityGrid,
    viewport,
    buildingSupport,
  } = input.state;

  statuses.buildings = getBuildingLayerGateStatus({
    zoom: viewport.zoom,
    minimumZoom: buildingSupport.minimumZoom,
    hasSupportedCity: buildingSupport.hasSupportedCity,
    requiresIntensityGrid: selectedEvent !== null && intensityGrid === null,
  });

  const infrastructureWaitFor = getInfrastructureSequenceWaitFor(input.sequence);
  for (const layerId of getInfrastructureLayerGateIds()) {
    statuses[layerId] = getInfrastructureLayerGateStatus({
      layerId,
      waitFor: infrastructureWaitFor,
    });
  }

  if (!selectedEvent) {
    statuses['aftershock-cascade'] = null;
    return statuses;
  }

  statuses['aftershock-cascade'] = getAftershockLayerGateStatus(selectedEvent.magnitude);
  if (
    statuses['aftershock-cascade'] === null
    && shouldWaitForAftershockCascade(input.sequence)
    && selectedEvent.magnitude >= AFTERSHOCK_CASCADE_MIN_MAGNITUDE
  ) {
    statuses['aftershock-cascade'] = createLayerGateStatus('aftershock-cascade', 'waiting-sequence');
  }

  return statuses;
}
