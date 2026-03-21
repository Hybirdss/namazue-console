import { getLocale, onLocaleChange, t, tf } from '../i18n';
import { consoleStore } from '../core/store';
import { buildLocationSafety, type LocationSafetyModel, type LocationSafetyTone } from '../ops/locationSafety';
import { escapeHtml } from '../utils/escapeHtml';

function getDisplayName(model: LocationSafetyModel): string {
  if (getLocale() === 'en' && model.place.nameEn) {
    return model.place.nameEn;
  }
  return model.place.name;
}

function formatPopulation(population: number): string {
  return new Intl.NumberFormat(getLocale()).format(population);
}

function formatDistanceKm(distanceKm: number | null): string {
  if (distanceKm == null) {
    return t('locationSafety.na');
  }
  if (distanceKm >= 100) {
    return `${Math.round(distanceKm)} km`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

function formatMagnitude(magnitude: number | null): string {
  if (magnitude == null) {
    return t('locationSafety.na');
  }
  return `M${magnitude.toFixed(1)}`;
}

function toneLabel(tone: LocationSafetyTone): string {
  if (tone === 'danger') return t('locationSafety.tone.danger');
  if (tone === 'caution') return t('locationSafety.tone.caution');
  return t('locationSafety.tone.safe');
}

function buildOverallSummary(model: LocationSafetyModel): string {
  if (model.overall.tone === 'danger') {
    return model.overall.driver === 'nearby-activity'
      ? t('locationSafety.summary.nearbyDanger')
      : t('locationSafety.summary.selectedDanger');
  }

  if (model.overall.tone === 'caution') {
    return model.overall.driver === 'selected-event'
      ? t('locationSafety.summary.selectedCaution')
      : t('locationSafety.summary.nearbyCaution');
  }

  return t('locationSafety.summary.safe');
}

export function renderLocationSafetyCardMarkup(model: LocationSafetyModel): string {
  const displayName = getDisplayName(model);
  const alternateName = model.place.nameEn && model.place.nameEn !== model.place.name
    ? (getLocale() === 'en' ? model.place.name : model.place.nameEn)
    : null;
  const selectedEventMarkup = model.selectedEvent
    ? `
      <div class="nz-location-safety__metric-row">
        <span>${formatMagnitude(model.selectedEvent.magnitude)}</span>
        <span>JMA ${model.selectedEvent.estimatedJma.toFixed(1)}</span>
        <span>${formatDistanceKm(model.selectedEvent.distanceKm)}</span>
      </div>
    `
    : `<div class="nz-location-safety__empty">${t('locationSafety.noSelectedEvent')}</div>`;

  const nearbyMarkup = model.nearbyRecent.count24h > 0
    ? `
      <div class="nz-location-safety__metric-row">
        <span>${tf('locationSafety.events24h', { count: model.nearbyRecent.count24h })}</span>
        <span>${formatMagnitude(model.nearbyRecent.maxMagnitude)}</span>
        <span>${formatDistanceKm(model.nearbyRecent.nearestDistanceKm)}</span>
      </div>
    `
    : `<div class="nz-location-safety__empty">${t('locationSafety.noNearby24h')}</div>`;

  return `
    <div class="nz-panel nz-location-safety nz-location-safety--${model.overall.tone}" data-location-safety-tone="${model.overall.tone}">
      <div class="nz-panel__header">
        <span class="nz-panel__title">${t('locationSafety.title')}</span>
        <button type="button" class="nz-location-safety__close" data-location-safety-close aria-label="${t('locationSafety.close')}">×</button>
        <span class="nz-location-safety__badge nz-location-safety__badge--${model.overall.tone}">${toneLabel(model.overall.tone)}</span>
      </div>
      <div class="nz-location-safety__place">${escapeHtml(displayName)}</div>
      ${alternateName ? `<div class="nz-location-safety__place-alt">${escapeHtml(alternateName)}</div>` : ''}
      <div class="nz-location-safety__place-meta">
        <span>${tf('locationSafety.population', { count: formatPopulation(model.place.population) })}</span>
        <span>${model.place.lat.toFixed(3)}°N ${model.place.lng.toFixed(3)}°E</span>
      </div>
      <div class="nz-location-safety__summary">${escapeHtml(buildOverallSummary(model))}</div>

      <div class="nz-location-safety__section">
        <div class="nz-location-safety__section-title">${t('locationSafety.selectedEventTitle')}</div>
        ${selectedEventMarkup}
      </div>

      <div class="nz-location-safety__section">
        <div class="nz-location-safety__section-title">${t('locationSafety.nearbyTitle')}</div>
        ${nearbyMarkup}
      </div>
    </div>
  `;
}

export function mountLocationSafetyCard(container: HTMLElement): () => void {
  function clearPlace(): void {
    consoleStore.set('searchedPlace', null);
  }

  function bindClear(): void {
    const closeButton = container.querySelector<HTMLElement>('[data-location-safety-close]');
    closeButton?.addEventListener('click', clearPlace, { once: true });
  }

  function render(): void {
    const place = consoleStore.get('searchedPlace');
    if (!place) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    const model = buildLocationSafety({
      place,
      selectedEvent: consoleStore.get('selectedEvent'),
      intensityGrid: consoleStore.get('intensityGrid'),
      events: consoleStore.get('events'),
    });

    container.hidden = false;
    container.innerHTML = renderLocationSafetyCardMarkup(model);
    bindClear();
  }

  const unsubscribers = [
    consoleStore.subscribe('searchedPlace', render),
    consoleStore.subscribe('selectedEvent', render),
    consoleStore.subscribe('intensityGrid', render),
    consoleStore.subscribe('events', render),
    onLocaleChange(render),
  ];

  render();

  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
    container.innerHTML = '';
  };
}
