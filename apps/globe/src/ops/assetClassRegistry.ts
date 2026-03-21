import type { OperatorBundleId } from './readModelTypes';
import type { OpsAsset, OpsAssetClass } from './types';
import { t, tf } from '../i18n';
import { getAssetDisplayName } from './assetDisplayName';

type BundleBackedAssetFamily = Exclude<OperatorBundleId, 'seismic'>;

/**
 * Operational concern — domain-specific action trigger at a given intensity.
 * These are display-only: they describe what operators should check,
 * but do NOT affect scoring (scoring uses fragility curves).
 */
export interface OpsOperationalConcern {
  /** JMA intensity threshold above which this concern applies */
  minIntensity: number;
  /** Human-readable description of the operational concern */
  reason: string;
}

export interface OpsAssetClassDefinition {
  id: OpsAssetClass;
  label: string;
  icon: string;
  bundleId: BundleBackedAssetFamily;
  familyLabel: string;
  counterLabel: string;
  domainId: string;
  exposureMetricLabel: string;
  /** Domain-specific operational concerns (display-only, no scoring effect) */
  operationalConcerns: OpsOperationalConcern[];
  tsunamiSensitive?: boolean;
  domainCheckLabel: string;
  priorityTitle: (asset: OpsAsset) => string;
}

function buildClassDefinitions(): Record<OpsAssetClass, OpsAssetClassDefinition> {
  return {
    port: {
      id: 'port',
      label: t('asset.port.label'),
      icon: '\u2693',
      bundleId: 'maritime',
      familyLabel: t('asset.port.family'),
      counterLabel: t('asset.port.counter'),
      domainId: 'ports',
      exposureMetricLabel: t('asset.port.metric'),
      operationalConcerns: [
        { minIntensity: 4.2, reason: 'exposure.concern.quayInspection' },
        { minIntensity: 5.0, reason: 'exposure.concern.liquefactionRisk' },
      ],
      tsunamiSensitive: true,
      domainCheckLabel: t('asset.port.domainCheck'),
      priorityTitle: (asset) => tf('asset.port.priority', { name: getAssetDisplayName(asset) }),
    },
    rail_hub: {
      id: 'rail_hub',
      label: t('asset.railHub.label'),
      icon: '\u{1F689}',
      bundleId: 'lifelines',
      familyLabel: t('asset.railHub.family'),
      counterLabel: t('asset.railHub.counter'),
      domainId: 'rail',
      exposureMetricLabel: t('asset.railHub.metric'),
      operationalConcerns: [
        { minIntensity: 4.0, reason: 'exposure.concern.trackInspection' },
        { minIntensity: 5.0, reason: 'exposure.concern.hubInspection' },
      ],
      domainCheckLabel: t('asset.railHub.domainCheck'),
      priorityTitle: (asset) => tf('asset.railHub.priority', { name: getAssetDisplayName(asset).replace(' Station', '') }),
    },
    hospital: {
      id: 'hospital',
      label: t('asset.hospital.label'),
      icon: '\u271A',
      bundleId: 'medical',
      familyLabel: t('asset.hospital.family'),
      counterLabel: t('asset.hospital.counter'),
      domainId: 'hospital',
      exposureMetricLabel: t('asset.hospital.metric'),
      operationalConcerns: [
        { minIntensity: 4.0, reason: 'exposure.concern.accessRouteSensitivity' },
        { minIntensity: 5.0, reason: 'exposure.concern.nonStructuralDamage' },
      ],
      domainCheckLabel: t('asset.hospital.domainCheck'),
      priorityTitle: (asset) => tf('asset.hospital.priority', { name: getAssetDisplayName(asset) }),
    },
    power_substation: {
      id: 'power_substation',
      label: t('asset.powerSub.label'),
      icon: '\u26A1',
      bundleId: 'lifelines',
      familyLabel: t('asset.powerSub.family'),
      counterLabel: t('asset.powerSub.counter'),
      domainId: 'power',
      exposureMetricLabel: t('asset.powerSub.metric'),
      operationalConcerns: [
        { minIntensity: 4.0, reason: 'exposure.concern.gridStability' },
        { minIntensity: 5.0, reason: 'exposure.concern.transformerInspection' },
      ],
      domainCheckLabel: t('asset.powerSub.domainCheck'),
      priorityTitle: (asset) => tf('asset.powerSub.priority', { name: getAssetDisplayName(asset) }),
    },
    water_facility: {
      id: 'water_facility',
      label: t('asset.water.label'),
      icon: '\u{1F4A7}',
      bundleId: 'lifelines',
      familyLabel: t('asset.water.family'),
      counterLabel: t('asset.water.counter'),
      domainId: 'water',
      exposureMetricLabel: t('asset.water.metric'),
      operationalConcerns: [
        { minIntensity: 4.0, reason: 'exposure.concern.serviceContinuity' },
        { minIntensity: 5.0, reason: 'exposure.concern.pipelineIntegrity' },
      ],
      domainCheckLabel: t('asset.water.domainCheck'),
      priorityTitle: (asset) => tf('asset.water.priority', { name: getAssetDisplayName(asset) }),
    },
    telecom_hub: {
      id: 'telecom_hub',
      label: t('asset.telecom.label'),
      icon: '\u{1F4F6}',
      bundleId: 'lifelines',
      familyLabel: t('asset.telecom.family'),
      counterLabel: t('asset.telecom.counter'),
      domainId: 'telecom',
      exposureMetricLabel: t('asset.telecom.metric'),
      operationalConcerns: [
        { minIntensity: 4.0, reason: 'exposure.concern.commsContinuity' },
        { minIntensity: 5.0, reason: 'exposure.concern.equipmentRack' },
      ],
      domainCheckLabel: t('asset.telecom.domainCheck'),
      priorityTitle: (asset) => tf('asset.telecom.priority', { name: getAssetDisplayName(asset) }),
    },
    building_cluster: {
      id: 'building_cluster',
      label: t('asset.building.label'),
      icon: '\u{1F3E2}',
      bundleId: 'built-environment',
      familyLabel: t('asset.building.family'),
      counterLabel: t('asset.building.counter'),
      domainId: 'urban-core',
      exposureMetricLabel: t('asset.building.metric'),
      operationalConcerns: [
        { minIntensity: 4.0, reason: 'exposure.concern.urbanInspection' },
        { minIntensity: 5.5, reason: 'exposure.concern.glassFacade' },
      ],
      domainCheckLabel: t('asset.building.domainCheck'),
      priorityTitle: (asset) => tf('asset.building.priority', { name: getAssetDisplayName(asset) }),
    },

    // ── New Asset Classes ─────────────────────────────────────────

    nuclear_plant: {
      id: 'nuclear_plant',
      label: t('asset.nuclear.label'),
      icon: '\u2622\uFE0F',
      bundleId: 'lifelines',
      familyLabel: t('asset.nuclear.family'),
      counterLabel: t('asset.nuclear.counter'),
      domainId: 'nuclear',
      exposureMetricLabel: t('asset.nuclear.metric'),
      operationalConcerns: [
        { minIntensity: 3.5, reason: 'exposure.concern.reactorScram' },
        { minIntensity: 5.0, reason: 'exposure.concern.spentFuel' },
        { minIntensity: 5.8, reason: 'exposure.concern.beyondDesignBasis' },
      ],
      tsunamiSensitive: true,
      domainCheckLabel: t('asset.nuclear.domainCheck'),
      priorityTitle: (asset) => tf('asset.nuclear.priority', { name: getAssetDisplayName(asset) }),
    },
    airport: {
      id: 'airport',
      label: t('asset.airport.label'),
      icon: '\u2708\uFE0F',
      bundleId: 'lifelines',
      familyLabel: t('asset.airport.family'),
      counterLabel: t('asset.airport.counter'),
      domainId: 'aviation',
      exposureMetricLabel: t('asset.airport.metric'),
      operationalConcerns: [
        { minIntensity: 4.0, reason: 'exposure.concern.runwayInspection' },
        { minIntensity: 5.5, reason: 'exposure.concern.terminalAssessment' },
      ],
      tsunamiSensitive: true,
      domainCheckLabel: t('asset.airport.domainCheck'),
      priorityTitle: (asset) => tf('asset.airport.priority', { name: getAssetDisplayName(asset) }),
    },
    dam: {
      id: 'dam',
      label: t('asset.dam.label'),
      icon: '\u{1F30A}',
      bundleId: 'lifelines',
      familyLabel: t('asset.dam.family'),
      counterLabel: t('asset.dam.counter'),
      domainId: 'dam',
      exposureMetricLabel: t('asset.dam.metric'),
      operationalConcerns: [
        { minIntensity: 4.0, reason: 'exposure.concern.damBodyInspection' },
        { minIntensity: 5.5, reason: 'exposure.concern.downstreamEvacuation' },
      ],
      domainCheckLabel: t('asset.dam.domainCheck'),
      priorityTitle: (asset) => tf('asset.dam.priority', { name: getAssetDisplayName(asset) }),
    },
    lng_terminal: {
      id: 'lng_terminal',
      label: t('asset.lng.label'),
      icon: '\u{1F525}',
      bundleId: 'maritime',
      familyLabel: t('asset.lng.family'),
      counterLabel: t('asset.lng.counter'),
      domainId: 'energy',
      exposureMetricLabel: t('asset.lng.metric'),
      operationalConcerns: [
        { minIntensity: 4.0, reason: 'exposure.concern.fireExplosionRisk' },
        { minIntensity: 5.0, reason: 'exposure.concern.pipelineIsolation' },
      ],
      tsunamiSensitive: true,
      domainCheckLabel: t('asset.lng.domainCheck'),
      priorityTitle: (asset) => tf('asset.lng.priority', { name: getAssetDisplayName(asset) }),
    },
    government_eoc: {
      id: 'government_eoc',
      label: t('asset.eoc.label'),
      icon: '\u{1F3DB}\uFE0F',
      bundleId: 'built-environment',
      familyLabel: t('asset.eoc.family'),
      counterLabel: t('asset.eoc.counter'),
      domainId: 'government',
      exposureMetricLabel: t('asset.eoc.metric'),
      operationalConcerns: [
        { minIntensity: 4.5, reason: 'exposure.concern.coordinationCapacity' },
      ],
      domainCheckLabel: t('asset.eoc.domainCheck'),
      priorityTitle: (asset) => tf('asset.eoc.priority', { name: getAssetDisplayName(asset) }),
    },
    evacuation_site: {
      id: 'evacuation_site',
      label: t('asset.evac.label'),
      icon: '\u{1F6A9}',
      bundleId: 'built-environment',
      familyLabel: t('asset.evac.family'),
      counterLabel: t('asset.evac.counter'),
      domainId: 'shelter',
      exposureMetricLabel: t('asset.evac.metric'),
      operationalConcerns: [
        { minIntensity: 5.0, reason: 'exposure.concern.shelterAssessment' },
      ],
      domainCheckLabel: t('asset.evac.domainCheck'),
      priorityTitle: (asset) => tf('asset.evac.priority', { name: getAssetDisplayName(asset) }),
    },
  };
}

let _classDefinitions: Record<OpsAssetClass, OpsAssetClassDefinition> | null = null;

function getClassDefinitions(): Record<OpsAssetClass, OpsAssetClassDefinition> {
  if (!_classDefinitions) {
    _classDefinitions = buildClassDefinitions();
  }
  return _classDefinitions;
}

export function getOpsAssetClassDefinition(assetClass: OpsAssetClass): OpsAssetClassDefinition {
  return getClassDefinitions()[assetClass];
}

export function getBundleAssetClasses(bundleId: BundleBackedAssetFamily): OpsAssetClass[] {
  return Object.values(getClassDefinitions())
    .filter((definition) => definition.bundleId === bundleId)
    .map((definition) => definition.id);
}

export function isOpsAssetClassModeled(assetClass: OpsAssetClass): boolean {
  switch (assetClass) {
    case 'hospital':
    case 'power_substation':
    case 'water_facility':
    case 'telecom_hub':
    case 'nuclear_plant':
    case 'dam':
    case 'lng_terminal':
      return true;
    case 'port':
    case 'rail_hub':
    case 'building_cluster':
    case 'airport':
    case 'government_eoc':
    case 'evacuation_site':
      return false;
  }
}
