import type { RailLineStatus } from '../routes/rail.ts';
import {
  computeDamageProbs,
  probsToSeverity,
  probsToScore,
} from '../../../globe/src/ops/fragilityCurves.ts';
import {
  assessPowerPlant,
  rankScramLikelihood,
  scramLikelihoodToSeverity,
} from '../../../globe/src/ops/powerAssessment.ts';
import { estimateSiteIntensity } from '../../../globe/src/ops/siteIntensity.ts';
import type { OpsAsset, OpsAssetClass, OpsRegion } from '../../../globe/src/ops/types.ts';
import type { EarthquakeEvent } from '../../../globe/src/types.ts';
import { POWER_PLANTS } from '../reference/powerCatalog.ts';
import { RAIL_LINE_LABELS } from '../reference/railCatalog.ts';
import type {
  ProjectionBundleCounter,
  ProjectionBundleDomain,
  ProjectionBundleDomainOverrides,
  ProjectionBundleSignal,
  ProjectionBundleTrust,
  ProjectionSection,
  ProjectionSectionState,
  ProjectionSeverity,
} from './projectionContracts.ts';

interface RailSectionData {
  source?: string;
  updatedAt?: number;
  lines?: RailLineStatus[];
}

interface ModeledAssetExposure {
  asset: OpsAsset;
  intensity: number;
  severity: ProjectionSeverity;
  score: number;
  summary: string;
}

const OPERATIONAL_MAGNITUDE_THRESHOLD = 4.5;
const MEDIUM_EVENT_WINDOW_MS = 24 * 60 * 60_000;
const MAJOR_EVENT_WINDOW_MS = 72 * 60 * 60_000;
const MAJOR_EVENT_MAGNITUDE_THRESHOLD = 6.8;

function buildCounter(
  id: string,
  label: string,
  value: number,
  tone: ProjectionSeverity,
): ProjectionBundleCounter {
  return { id, label, value, tone };
}

function buildSignal(
  id: string,
  label: string,
  value: string,
  tone: ProjectionSeverity,
): ProjectionBundleSignal {
  return { id, label, value, tone };
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function capModeledTrust(
  trust: Exclude<ProjectionBundleTrust, 'pending'>,
): Exclude<ProjectionBundleTrust, 'pending'> {
  return trust === 'confirmed' ? 'review' : trust;
}

function formatRegion(region: OpsRegion | null): string {
  if (!region) return 'Japan';

  switch (region) {
    case 'hokkaido': return 'Hokkaido';
    case 'tohoku': return 'Tohoku';
    case 'kanto': return 'Kanto';
    case 'chubu': return 'Chubu';
    case 'kansai': return 'Kansai';
    case 'chugoku': return 'Chugoku';
    case 'shikoku': return 'Shikoku';
    case 'kyushu': return 'Kyushu';
  }
}

// Removed: toProjectionSeverityFromScore — replaced by fragility-curve-based probsToSeverity

function parseEventTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseFaultType(value: unknown): EarthquakeEvent['faultType'] {
  switch (value) {
    case 'interface':
    case 'intraslab':
    case 'crustal':
      return value;
    default:
      return 'crustal';
  }
}

function parseProjectionEvent(row: unknown): EarthquakeEvent | null {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return null;
  }

  const record = row as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : null;
  const lat = typeof record.lat === 'number' ? record.lat : null;
  const lng = typeof record.lng === 'number' ? record.lng : null;
  const depth_km = typeof record.depth_km === 'number' ? record.depth_km : null;
  const magnitude = typeof record.magnitude === 'number' ? record.magnitude : null;
  const time = parseEventTimestamp(record.time);
  const place = typeof record.place === 'string'
    ? record.place
    : record.place && typeof record.place === 'object' && !Array.isArray(record.place) && typeof (record.place as Record<string, unknown>).text === 'string'
      ? (record.place as Record<string, unknown>).text as string
      : '';

  if (!id || lat === null || lng === null || depth_km === null || magnitude === null || time === null) {
    return null;
  }

  return {
    id,
    lat,
    lng,
    depth_km,
    magnitude,
    time,
    faultType: parseFaultType(record.fault_type ?? record.faultType),
    tsunami: record.tsunami === true,
    place: { text: place },
  };
}

function isSignificantEvent(now: number, event: EarthquakeEvent): boolean {
  const ageMs = Math.max(0, now - event.time);

  if (event.tsunami || event.magnitude >= MAJOR_EVENT_MAGNITUDE_THRESHOLD) {
    return ageMs <= MAJOR_EVENT_WINDOW_MS;
  }

  return event.magnitude >= OPERATIONAL_MAGNITUDE_THRESHOLD && ageMs <= MEDIUM_EVENT_WINDOW_MS;
}

function scoreProjectionEvent(now: number, event: EarthquakeEvent): number {
  const ageMinutes = Math.max(0, (now - event.time) / 60_000);
  const recencyScore = Math.max(0, 24 - Math.min(ageMinutes / 15, 24));
  const magnitudeScore = event.magnitude * 14;
  const tsunamiScore = event.tsunami ? 18 : 0;
  return magnitudeScore + tsunamiScore + recencyScore;
}

function selectProjectionFocusEvent(now: number, rows: unknown[]): EarthquakeEvent | null {
  const events = rows
    .map((row) => parseProjectionEvent(row))
    .filter((event): event is EarthquakeEvent => event !== null)
    .filter((event) => isSignificantEvent(now, event))
    .sort((left, right) => scoreProjectionEvent(now, right) - scoreProjectionEvent(now, left));

  return events[0] ?? null;
}

function buildModeledAssetExposure(event: EarthquakeEvent, asset: OpsAsset): ModeledAssetExposure {
  const intensity = estimateSiteIntensity(event, asset.lat, asset.lng);
  const probs = computeDamageProbs(intensity, asset.class);
  const score = probsToScore(probs);
  const severity = probsToSeverity(probs) as ProjectionSeverity;

  return {
    asset,
    intensity,
    severity,
    score,
    summary: `${asset.name} is in ${severity} posture.`,
  };
}

function selectModeledExposures(
  event: EarthquakeEvent,
  classes: OpsAssetClass[],
  assets: OpsAsset[],
): ModeledAssetExposure[] {
  return assets
    .filter((asset) => classes.includes(asset.class))
    .map((asset) => buildModeledAssetExposure(event, asset))
    .filter((exposure) => exposure.severity !== 'clear')
    .sort((left, right) =>
      severityRank(right.severity) - severityRank(left.severity) ||
      right.score - left.score,
    );
}

function joinAssetNames(assets: OpsAsset[]): string {
  if (assets.length <= 1) {
    return assets[0]?.name ?? '';
  }
  if (assets.length === 2) {
    return `${assets[0]!.name} and ${assets[1]!.name}`;
  }
  return `${assets.slice(0, -1).map((asset) => asset.name).join(', ')}, and ${assets[assets.length - 1]!.name}`;
}

function waterIntensityToSeverity(intensity: number): ProjectionSeverity {
  if (intensity >= 5.5) return 'critical';
  if (intensity >= 4.5) return 'priority';
  if (intensity >= 3.5) return 'watch';
  return 'clear';
}

function formatWaterPosture(severity: ProjectionSeverity): string {
  switch (severity) {
    case 'critical': return 'Outage Risk';
    case 'priority': return 'Continuity Review';
    case 'watch': return 'Verification';
    case 'clear': return 'Nominal';
  }
}

function buildPowerDomain(
  selectedEvent: EarthquakeEvent | null,
  trust: Exclude<ProjectionBundleTrust, 'pending'>,
  assets: OpsAsset[],
): ProjectionBundleDomain | null {
  if (!selectedEvent) {
    return null;
  }

  const effectiveTrust = capModeledTrust(trust);
  const powerExposures = selectModeledExposures(selectedEvent, ['power_substation'], assets);
  const topPowerExposure = powerExposures[0];
  const powerNodeCount = powerExposures.length;
  const powerNodeSeverity = topPowerExposure?.severity ?? 'clear';
  const powerNodeDetail = topPowerExposure?.summary ?? null;
  const topPowerAsset = topPowerExposure?.asset ?? null;

  const plantAssessments = POWER_PLANTS.map((plant) => ({
    plant,
    assessment: assessPowerPlant(plant, selectedEvent),
  }));
  const scramLikely = plantAssessments.filter(({ plant, assessment }) =>
    plant.type === 'nuclear' && (assessment.scram === 'likely' || assessment.scram === 'certain'),
  );
  const scramPossible = plantAssessments.filter(({ plant, assessment }) =>
    plant.type === 'nuclear' && assessment.scram === 'possible',
  );
  const plantsInZone = plantAssessments.filter(({ assessment }) => assessment.inImpactZone);
  const topPlant = [...plantAssessments]
    .sort((left, right) =>
      rankScramLikelihood(right.assessment.scram) - rankScramLikelihood(left.assessment.scram) ||
      Number(right.assessment.inImpactZone) - Number(left.assessment.inImpactZone) ||
      right.assessment.pgaGal - left.assessment.pgaGal ||
      right.plant.capacityMw - left.plant.capacityMw,
    )[0];

  const plantSeverity = topPlant
    ? maxSeverity(
        scramLikelihoodToSeverity(topPlant.assessment.scram),
        topPlant.assessment.inImpactZone ? 'watch' : 'clear',
      )
    : 'clear';
  const severity = maxSeverity(powerNodeSeverity, plantSeverity);

  if (severity === 'clear' && powerNodeCount === 0 && plantsInZone.length === 0) {
    return null;
  }

  let metric: string;
  let detail: string;

  if (scramLikely.length > 0 && topPlant) {
    metric = `${scramLikely.length} nuclear SCRAM ${scramLikely.length === 1 ? 'likely' : 'risks active'}`;
    detail = `${topPlant.plant.nameEn} is estimated near SCRAM thresholds at ~${Math.round(topPlant.assessment.pgaGal)} gal.`;
  } else if (scramPossible.length > 0 && topPlant) {
    metric = `${scramPossible.length} nuclear site${scramPossible.length === 1 ? '' : 's'} under review`;
    detail = `${topPlant.plant.nameEn} is estimated at JMA ${topPlant.assessment.intensity.toFixed(1)} and requires grid verification.`;
  } else if (powerNodeCount > 0 && powerNodeDetail) {
    metric = `${powerNodeCount} power node${powerNodeCount === 1 ? '' : 's'} in elevated posture`;
    detail = powerNodeDetail;
  } else if (plantsInZone.length > 0 && topPlant) {
    metric = `${plantsInZone.length} generation site${plantsInZone.length === 1 ? '' : 's'} in impact zone`;
    detail = `${topPlant.plant.nameEn} sits inside the current shake field and requires continuity verification.`;
  } else {
    return null;
  }

  const counters: ProjectionBundleCounter[] = [];
  if (powerNodeCount > 0) {
    counters.push(buildCounter('power-nodes', 'Power Nodes', powerNodeCount, powerNodeSeverity));
  }
  if (scramLikely.length > 0) {
    counters.push(buildCounter('scram-likely', 'SCRAM Likely', scramLikely.length, 'critical'));
  }
  if (scramPossible.length > 0) {
    counters.push(buildCounter('scram-review', 'SCRAM Review', scramPossible.length, 'priority'));
  }
  if (plantsInZone.length > 0) {
    counters.push(buildCounter('plants-in-zone', 'Plants In Zone', plantsInZone.length, plantSeverity));
  }

  const signals: ProjectionBundleSignal[] = [
    buildSignal('source', 'Source', 'Modeled from seismic exposure', 'watch'),
  ];
  if (topPlant) {
    signals.push(buildSignal('primary-plant', 'Primary Plant', topPlant.plant.nameEn, plantSeverity));
    signals.push(buildSignal('power-region', 'Power Region', formatRegion(topPlant.plant.region as OpsRegion), plantSeverity));
    if (topPlant.assessment.pgaGal > 0) {
      signals.push(buildSignal('estimated-pga', 'Estimated PGA', `~${Math.round(topPlant.assessment.pgaGal)} gal`, plantSeverity));
    }
  }
  if (topPowerAsset) {
    signals.push(buildSignal('grid-node', 'Grid Node', topPowerAsset.name, powerNodeSeverity));
  }

  return {
    id: 'power',
    label: 'Power',
    metric,
    detail,
    eventId: selectedEvent.id,
    severity,
    availability: 'modeled',
    trust: effectiveTrust,
    counters,
    signals,
  };
}

function buildWaterDomain(
  selectedEvent: EarthquakeEvent | null,
  trust: Exclude<ProjectionBundleTrust, 'pending'>,
  assets: OpsAsset[],
): ProjectionBundleDomain | null {
  if (!selectedEvent) {
    return null;
  }

  const effectiveTrust = capModeledTrust(trust);
  const waterExposures = selectModeledExposures(selectedEvent, ['water_facility'], assets);
  const topWaterExposure = waterExposures[0];
  const assessedWaterSites = assets
    .filter((asset) => asset.class === 'water_facility')
    .map((asset) => {
      const intensity = estimateSiteIntensity(selectedEvent, asset.lat, asset.lng);
      return {
        asset,
        intensity,
        severity: waterIntensityToSeverity(intensity),
      };
    })
    .filter((assessment) => assessment.severity !== 'clear')
    .sort((left, right) =>
      severityRank(right.severity) - severityRank(left.severity) || right.intensity - left.intensity,
    );
  const criticalSites = assessedWaterSites.filter((assessment) => assessment.severity === 'critical');
  const reviewSites = assessedWaterSites.filter((assessment) => assessment.severity === 'priority');
  const verificationSites = assessedWaterSites.filter((assessment) => assessment.severity === 'watch');
  const topWaterAssessment = assessedWaterSites[0];
  const waterSiteCount = Math.max(waterExposures.length, assessedWaterSites.length);
  const waterSeverity = topWaterExposure?.severity ?? topWaterAssessment?.severity ?? 'clear';
  const waterDetail = topWaterExposure?.summary ?? null;
  const topWaterAsset = topWaterAssessment?.asset ?? topWaterExposure?.asset ?? null;

  if (waterSeverity === 'clear' && waterSiteCount === 0) {
    return null;
  }

  let metric: string;
  let detail: string;

  if (criticalSites.length > 0 && topWaterAssessment) {
    metric = `${criticalSites.length} water site${criticalSites.length === 1 ? '' : 's'} at outage risk`;
    detail = `${topWaterAssessment.asset.name} is estimated at JMA ${topWaterAssessment.intensity.toFixed(1)} with potable-water continuity at risk.`;
  } else if (reviewSites.length > 0 && topWaterAssessment) {
    metric = `${reviewSites.length} water site${reviewSites.length === 1 ? '' : 's'} in continuity review`;
    detail = `${topWaterAssessment.asset.name} is estimated at JMA ${topWaterAssessment.intensity.toFixed(1)} and requires distribution verification.`;
  } else if (waterSiteCount > 0 && waterDetail) {
    metric = `${waterSiteCount} water site${waterSiteCount === 1 ? '' : 's'} in elevated posture`;
    detail = waterDetail;
  } else if (verificationSites.length > 0 && topWaterAssessment) {
    metric = `${verificationSites.length} water site${verificationSites.length === 1 ? '' : 's'} under verification`;
    detail = `${topWaterAssessment.asset.name} is inside the current shake field and requires water continuity confirmation.`;
  } else {
    return null;
  }

  const counters: ProjectionBundleCounter[] = [];
  if (waterSiteCount > 0) {
    counters.push(buildCounter('water-sites', 'Water Sites', waterSiteCount, waterSeverity));
  }
  if (criticalSites.length > 0) {
    counters.push(buildCounter('water-outage-risk', 'Outage Risk', criticalSites.length, 'critical'));
  }
  if (reviewSites.length > 0) {
    counters.push(buildCounter('water-review', 'Continuity Review', reviewSites.length, 'priority'));
  }
  if (verificationSites.length > 0) {
    counters.push(buildCounter('water-verify', 'Verification', verificationSites.length, 'watch'));
  }

  const signals: ProjectionBundleSignal[] = [
    buildSignal('source', 'Source', 'Modeled from seismic exposure', 'watch'),
  ];
  if (topWaterAsset) {
    signals.push(buildSignal('primary-facility', 'Primary Facility', topWaterAsset.name, waterSeverity));
    signals.push(buildSignal('water-region', 'Water Region', formatRegion(topWaterAsset.region), waterSeverity));
  }
  if (topWaterAssessment) {
    signals.push(buildSignal('estimated-intensity', 'Estimated Intensity', `JMA ${topWaterAssessment.intensity.toFixed(1)}`, topWaterAssessment.severity));
    signals.push(buildSignal('network-posture', 'Network Posture', formatWaterPosture(topWaterAssessment.severity), topWaterAssessment.severity));
  }

  return {
    id: 'water',
    label: 'Water',
    metric,
    detail,
    eventId: selectedEvent.id,
    severity: waterSeverity,
    availability: 'modeled',
    trust: effectiveTrust,
    counters,
    signals,
  };
}

function buildMedicalDomain(
  selectedEvent: EarthquakeEvent | null,
  trust: Exclude<ProjectionBundleTrust, 'pending'>,
  assets: OpsAsset[],
): ProjectionBundleDomain | null {
  if (!selectedEvent) {
    return null;
  }

  const effectiveTrust = capModeledTrust(trust);
  const hospitalExposures = selectModeledExposures(selectedEvent, ['hospital'], assets);
  if (hospitalExposures.length === 0) {
    return null;
  }

  const topSeverity = hospitalExposures[0]!.severity;
  const focusAssets = hospitalExposures.slice(0, 2).map((entry) => entry.asset);

  return {
    id: 'hospital',
    label: 'Hospital',
    metric: `${hospitalExposures.length} medical site${hospitalExposures.length === 1 ? '' : 's'} in elevated posture`,
    detail: `${joinAssetNames(focusAssets)} require hospital access verification.`,
    eventId: selectedEvent.id,
    severity: topSeverity,
    availability: 'modeled',
    trust: effectiveTrust,
    counters: [
      buildCounter('medical-sites', 'Sites', hospitalExposures.length, topSeverity),
    ],
    signals: [
      buildSignal('source', 'Source', 'Modeled from seismic exposure', 'watch'),
      buildSignal('medical-focus', 'Medical Focus', joinAssetNames(focusAssets), topSeverity),
    ],
  };
}

function railStatusRank(status: RailLineStatus['status']): number {
  switch (status) {
    case 'suspended': return 4;
    case 'partial': return 3;
    case 'delayed': return 2;
    case 'unknown': return 1;
    case 'normal': return 0;
  }
}

function railStatusToSeverity(status: RailLineStatus['status']): ProjectionSeverity {
  switch (status) {
    case 'suspended': return 'critical';
    case 'partial': return 'priority';
    case 'delayed':
    case 'unknown':
      return 'watch';
    case 'normal':
      return 'clear';
  }
}

function formatRailLineLabel(lineId: string): string {
  return RAIL_LINE_LABELS[lineId] ?? lineId
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatRailStatusLabel(status: RailLineStatus['status']): string {
  switch (status) {
    case 'suspended': return 'Suspended';
    case 'partial': return 'Partial Service';
    case 'delayed': return 'Delayed';
    case 'unknown': return 'Pending';
    case 'normal': return 'Nominal';
  }
}

function summarizeRailNetworkState(statuses: RailLineStatus[]): string {
  if (statuses.some((status) => status.status === 'suspended')) return 'Suspended';
  if (statuses.some((status) => status.status === 'partial')) return 'Partial Service';
  if (statuses.some((status) => status.status === 'delayed')) return 'Delayed';
  if (statuses.some((status) => status.status === 'unknown')) return 'Pending';
  return 'Nominal';
}

function formatFeedSourceLabel(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) return 'feed';
  if (trimmed.length <= 4) return trimmed.toUpperCase();

  return trimmed
    .split(/[_\-\s]+/)
    .map((segment) => segment.length <= 4
      ? segment.toUpperCase()
      : segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function sectionStateToSeverity(state: ProjectionSectionState): ProjectionSeverity {
  switch (state) {
    case 'down': return 'critical';
    case 'degraded': return 'priority';
    case 'stale': return 'watch';
    case 'live': return 'clear';
  }
}

function sectionStateToTrust(state: ProjectionSectionState): Exclude<ProjectionBundleTrust, 'pending'> {
  switch (state) {
    case 'down':
    case 'degraded':
      return 'degraded';
    case 'stale':
      return 'review';
    case 'live':
      return 'confirmed';
  }
}

function severityRank(severity: ProjectionSeverity): number {
  switch (severity) {
    case 'critical': return 3;
    case 'priority': return 2;
    case 'watch': return 1;
    case 'clear': return 0;
  }
}

function maxSeverity(left: ProjectionSeverity, right: ProjectionSeverity): ProjectionSeverity {
  return severityRank(left) >= severityRank(right) ? left : right;
}

function trustRank(trust: Exclude<ProjectionBundleTrust, 'pending'>): number {
  switch (trust) {
    case 'degraded': return 2;
    case 'review': return 1;
    case 'confirmed': return 0;
  }
}

function maxTrust(
  left: Exclude<ProjectionBundleTrust, 'pending'>,
  right: Exclude<ProjectionBundleTrust, 'pending'>,
): Exclude<ProjectionBundleTrust, 'pending'> {
  return trustRank(left) >= trustRank(right) ? left : right;
}

function buildRailFeedValue(section: ProjectionSection<RailSectionData>): string {
  const source = formatFeedSourceLabel(section.source || section.data.source || 'odpt');
  switch (section.state) {
    case 'stale': return `Stale ${source}`;
    case 'degraded': return `Degraded ${source}`;
    case 'down': return `${source} Down`;
    case 'live': return `Live ${source}`;
  }
}

function buildRailFeedMessage(section: ProjectionSection<RailSectionData>, hasStatuses: boolean): string {
  if (section.last_error) {
    return section.last_error;
  }

  switch (section.state) {
    case 'stale':
      return hasStatuses
        ? 'Rail telemetry is stale; using last confirmed corridor state.'
        : 'Rail telemetry is stale and no current corridor status is available.';
    case 'degraded':
      return hasStatuses
        ? 'Rail telemetry is degraded; verify the last confirmed corridor state before acting.'
        : 'Rail telemetry is degraded and no current corridor status is available.';
    case 'down':
      return hasStatuses
        ? 'Rail telemetry is down; manual corridor verification is required.'
        : 'Rail telemetry is down and no current corridor status is available.';
    case 'live':
      return '';
  }
}

function buildRailFeedOnlyDomain(section: ProjectionSection<RailSectionData>): ProjectionBundleDomain {
  const severity = sectionStateToSeverity(section.state);

  return {
    id: 'rail',
    label: 'Rail',
    metric: section.state === 'down'
      ? 'Rail telemetry down'
      : section.state === 'degraded'
        ? 'Rail telemetry degraded'
        : 'Rail telemetry stale',
    detail: buildRailFeedMessage(section, false),
    severity,
    availability: 'live',
    trust: sectionStateToTrust(section.state),
    counters: [],
    signals: [
      buildSignal('rail-feed', 'Rail Feed', buildRailFeedValue(section), severity),
    ],
  };
}

function buildRailDomain(section: ProjectionSection<RailSectionData>): ProjectionBundleDomain | null {
  const statuses = Array.isArray(section.data.lines) ? section.data.lines : [];
  if (statuses.length === 0) {
    return section.state === 'live' ? null : buildRailFeedOnlyDomain(section);
  }

  const suspendedCount = statuses.filter((status) => status.status === 'suspended').length;
  const partialCount = statuses.filter((status) => status.status === 'partial').length;
  const delayedCount = statuses.filter((status) => status.status === 'delayed').length;
  const unknownCount = statuses.filter((status) => status.status === 'unknown').length;
  const topStatus = statuses
    .slice()
    .sort((left, right) =>
      railStatusRank(right.status) - railStatusRank(left.status) ||
      right.updatedAt - left.updatedAt,
    )[0];

  if (!topStatus) {
    return null;
  }

  const operationalSeverity = railStatusToSeverity(topStatus.status);
  const feedSeverity = sectionStateToSeverity(section.state);
  const severity = maxSeverity(operationalSeverity, feedSeverity);
  const trust = maxTrust('confirmed', sectionStateToTrust(section.state));
  const primaryLine = formatRailLineLabel(topStatus.lineId);
  const primaryStatus = formatRailStatusLabel(topStatus.status);

  let metric: string;
  let detail: string;

  if (suspendedCount > 0) {
    metric = `${suspendedCount} ${pluralize(suspendedCount, 'rail corridor')} suspended`;
    detail = `${primaryLine} is suspended on the live rail feed${topStatus.cause ? ` due to ${topStatus.cause}` : ''}.`;
  } else if (partialCount > 0) {
    metric = `${partialCount} ${pluralize(partialCount, 'rail corridor')} in partial service`;
    detail = `${primaryLine} is operating in partial service${topStatus.cause ? ` due to ${topStatus.cause}` : ''}.`;
  } else if (delayedCount > 0) {
    metric = `${delayedCount} ${pluralize(delayedCount, 'rail corridor')} delayed`;
    detail = `${primaryLine} is reporting delays${topStatus.cause ? ` due to ${topStatus.cause}` : ''}.`;
  } else if (unknownCount > 0) {
    metric = `${unknownCount} ${pluralize(unknownCount, 'rail corridor')} pending status`;
    detail = `${primaryLine} is awaiting a confirmed live status update.`;
  } else {
    metric = `${statuses.length} ${pluralize(statuses.length, 'rail corridor')} nominal`;
    detail = 'Live rail telemetry shows nominal posture across monitored Shinkansen corridors.';
  }

  if (section.state !== 'live') {
    detail = `${detail} ${buildRailFeedMessage(section, true)}`.trim();
  }

  const counters: ProjectionBundleCounter[] = [
    buildCounter('rail-monitored', 'Monitored', statuses.length, 'clear'),
  ];
  if (suspendedCount > 0) counters.push(buildCounter('rail-suspended', 'Suspended', suspendedCount, 'critical'));
  if (partialCount > 0) counters.push(buildCounter('rail-partial', 'Partial', partialCount, 'priority'));
  if (delayedCount > 0) counters.push(buildCounter('rail-delayed', 'Delayed', delayedCount, 'watch'));
  if (unknownCount > 0) counters.push(buildCounter('rail-pending', 'Pending', unknownCount, 'watch'));

  const signals: ProjectionBundleSignal[] = [
    buildSignal('rail-feed', 'Rail Feed', buildRailFeedValue(section), feedSeverity === 'clear' ? operationalSeverity : feedSeverity),
    buildSignal('rail-network-state', 'Network State', summarizeRailNetworkState(statuses), severity),
    buildSignal('rail-primary-line', 'Primary Corridor', primaryLine, severity),
  ];
  if (topStatus.cause) {
    signals.push(buildSignal('rail-cause', 'Reported Cause', topStatus.cause, severity));
  } else {
    signals.push(buildSignal('rail-primary-status', 'Primary Status', primaryStatus, severity));
  }

  return {
    id: 'rail',
    label: 'Rail',
    metric,
    detail,
    severity,
    availability: 'live',
    trust,
    counters,
    signals,
  };
}

export function buildProjectionDomainOverrides(input: {
  now: number;
  events: ProjectionSection<unknown>;
  rail: ProjectionSection<unknown>;
  assets: OpsAsset[];
}): ProjectionBundleDomainOverrides {
  const rail = buildRailDomain(input.rail as ProjectionSection<RailSectionData>);
  const selectedEvent = selectProjectionFocusEvent(
    input.now,
    Array.isArray((input.events as ProjectionSection<unknown[]>).data)
      ? (input.events as ProjectionSection<unknown[]>).data
      : [],
  );
  const trust = sectionStateToTrust(input.events.state);
  const power = buildPowerDomain(selectedEvent, trust, input.assets);
  const water = buildWaterDomain(selectedEvent, trust, input.assets);
  const medical = buildMedicalDomain(selectedEvent, trust, input.assets);

  const lifelines: ProjectionBundleDomain[] = [];
  if (rail) lifelines.push(rail);
  if (power) lifelines.push(power);
  if (water) lifelines.push(water);

  return {
    ...(lifelines.length > 0 ? { lifelines } : {}),
    ...(medical ? { medical: [medical] } : {}),
  };
}
