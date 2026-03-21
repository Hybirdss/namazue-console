import { MUNICIPALITIES, type Municipality } from '../data/municipalities';
import { onLocaleChange, t } from '../i18n';
import { escapeHtml } from '../utils/escapeHtml';

interface CuratedCityPreset {
  code: string;
  name: string;
  nameEn: string;
  lat: number;
  lng: number;
  prefectureId: string;
  aliases: string[];
  matches: (place: Municipality) => boolean;
}

interface SearchEntry {
  place: Municipality;
  aliases: string[];
}

const CURATED_CITY_PRESETS: CuratedCityPreset[] = [
  {
    code: 'city-tokyo',
    name: '東京',
    nameEn: 'Tokyo',
    lat: 35.6812,
    lng: 139.7671,
    prefectureId: 'tokyo',
    aliases: ['東京', 'とうきょう', 'tokyo', '도쿄'],
    matches: (place) => (place.code?.startsWith('131') ?? false),
  },
  {
    code: 'city-osaka',
    name: '大阪市',
    nameEn: 'Osaka',
    lat: 34.6937,
    lng: 135.5023,
    prefectureId: 'osaka',
    aliases: ['大阪', 'おおさか', 'osaka', '오사카'],
    matches: (place) => place.name.startsWith('大阪市'),
  },
  {
    code: 'city-yokohama',
    name: '横浜市',
    nameEn: 'Yokohama',
    lat: 35.4437,
    lng: 139.638,
    prefectureId: 'kanagawa',
    aliases: ['横浜', 'よこはま', 'yokohama', '요코하마'],
    matches: (place) => place.name.startsWith('横浜市'),
  },
  {
    code: 'city-nagoya',
    name: '名古屋市',
    nameEn: 'Nagoya',
    lat: 35.1815,
    lng: 136.9066,
    prefectureId: 'aichi',
    aliases: ['名古屋', 'なごや', 'nagoya', '나고야'],
    matches: (place) => place.name.startsWith('名古屋市'),
  },
  {
    code: 'city-sendai',
    name: '仙台市',
    nameEn: 'Sendai',
    lat: 38.2682,
    lng: 140.8694,
    prefectureId: 'miyagi',
    aliases: ['仙台', 'せんだい', 'sendai', '센다이'],
    matches: (place) => place.name.startsWith('仙台市'),
  },
  {
    code: 'city-sapporo',
    name: '札幌市',
    nameEn: 'Sapporo',
    lat: 43.0621,
    lng: 141.3544,
    prefectureId: 'hokkaido',
    aliases: ['札幌', 'さっぽろ', 'sapporo', '삿포로'],
    matches: (place) => place.name.startsWith('札幌市'),
  },
  {
    code: 'city-fukuoka',
    name: '福岡市',
    nameEn: 'Fukuoka',
    lat: 33.5904,
    lng: 130.4017,
    prefectureId: 'fukuoka',
    aliases: ['福岡', 'ふくおか', 'fukuoka', '후쿠오카'],
    matches: (place) => place.name.startsWith('福岡市'),
  },
  {
    code: 'city-hiroshima',
    name: '広島市',
    nameEn: 'Hiroshima',
    lat: 34.3853,
    lng: 132.4553,
    prefectureId: 'hiroshima',
    aliases: ['広島', 'ひろしま', 'hiroshima', '히로시마'],
    matches: (place) => place.name.startsWith('広島市'),
  },
  {
    code: 'city-kobe',
    name: '神戸市',
    nameEn: 'Kobe',
    lat: 34.6901,
    lng: 135.1956,
    prefectureId: 'hyogo',
    aliases: ['神戸', 'こうべ', 'kobe', '고베'],
    matches: (place) => place.name.startsWith('神戸市'),
  },
  {
    code: 'city-kyoto',
    name: '京都市',
    nameEn: 'Kyoto',
    lat: 35.0116,
    lng: 135.7681,
    prefectureId: 'kyoto',
    aliases: ['京都', 'きょうと', 'kyoto', '교토'],
    matches: (place) => place.name.startsWith('京都市'),
  },
  {
    code: 'city-niigata',
    name: '新潟市',
    nameEn: 'Niigata',
    lat: 37.9026,
    lng: 139.0236,
    prefectureId: 'niigata',
    aliases: ['新潟', 'にいがた', 'niigata', '니가타'],
    matches: (place) => place.name.startsWith('新潟市'),
  },
  {
    code: 'city-kagoshima',
    name: '鹿児島市',
    nameEn: 'Kagoshima',
    lat: 31.5966,
    lng: 130.5571,
    prefectureId: 'kagoshima',
    aliases: ['鹿児島', 'かごしま', 'kagoshima', '가고시마'],
    matches: (place) => place.name === '鹿児島市',
  },
  {
    code: 'city-naha',
    name: '那覇市',
    nameEn: 'Naha',
    lat: 26.2125,
    lng: 127.6809,
    prefectureId: 'okinawa',
    aliases: ['那覇', 'なは', 'naha', '오키나와', '나하', 'okinawa'],
    matches: (place) => place.name === '那覇市',
  },
  {
    code: 'city-kumamoto',
    name: '熊本市',
    nameEn: 'Kumamoto',
    lat: 32.8031,
    lng: 130.7079,
    prefectureId: 'kumamoto',
    aliases: ['熊本', 'くまもと', 'kumamoto', '구마모토'],
    matches: (place) => place.name.startsWith('熊本市'),
  },
  {
    code: 'city-shizuoka',
    name: '静岡市',
    nameEn: 'Shizuoka',
    lat: 34.9756,
    lng: 138.3827,
    prefectureId: 'shizuoka',
    aliases: ['静岡', 'しずおか', 'shizuoka', '시즈오카'],
    matches: (place) => place.name.startsWith('静岡市'),
  },
];

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s-_]+/g, '');
}

function aggregatePopulation(preset: CuratedCityPreset): number {
  return MUNICIPALITIES.reduce((sum, place) => {
    return sum + (preset.matches(place) ? place.population : 0);
  }, 0);
}

function buildSearchEntries(): SearchEntry[] {
  const curated = CURATED_CITY_PRESETS.map((preset) => ({
    place: {
      code: preset.code,
      name: preset.name,
      nameEn: preset.nameEn,
      lat: preset.lat,
      lng: preset.lng,
      population: aggregatePopulation(preset),
      prefectureId: preset.prefectureId,
    } satisfies Municipality,
    aliases: preset.aliases,
  }));

  const raw = MUNICIPALITIES.map((place) => ({
    place,
    aliases: [place.name, place.nameEn],
  }));

  return [...curated, ...raw];
}

let searchEntriesCache: SearchEntry[] | null = null;
let cachedMunicipalitySource: Municipality[] | null = null;

function getSearchEntries(): SearchEntry[] {
  if (cachedMunicipalitySource !== MUNICIPALITIES || !searchEntriesCache) {
    cachedMunicipalitySource = MUNICIPALITIES;
    searchEntriesCache = buildSearchEntries();
  }
  return searchEntriesCache;
}

function fuzzyScore(query: string, target: string): number {
  if (!target) return 0;
  if (target === query) return 120;
  if (target.startsWith(query)) return 90;
  if (target.includes(query)) return 65;

  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      score += 8;
      qi += 1;
    }
  }
  return qi === query.length ? score : 0;
}

function scoreEntry(query: string, entry: SearchEntry): number {
  const targets = [
    entry.place.name,
    entry.place.nameEn,
    ...entry.aliases,
  ].map(normalizeSearchText);

  let best = 0;
  for (const target of targets) {
    best = Math.max(best, fuzzyScore(query, target));
  }
  return best;
}

export function searchMunicipalities(query: string, limit = 8): Municipality[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return [];
  }

  return getSearchEntries()
    .map((entry) => ({
      entry,
      score: scoreEntry(normalized, entry),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.entry.place.population - a.entry.place.population;
    })
    .slice(0, limit)
    .map((candidate) => candidate.entry.place);
}

function getResultLabel(place: Municipality): string {
  return place.nameEn && place.nameEn !== place.name
    ? `${place.name} · ${place.nameEn}`
    : place.name;
}

function getResultMeta(place: Municipality): string {
  return `${place.prefectureId} · ${place.population.toLocaleString()}`;
}

export function renderMapSearchResultsMarkup(
  results: Municipality[],
  activeIndex = -1,
): string {
  if (results.length === 0) {
    return `<div class="nz-map-search__empty">${t('mapSearch.noResults')}</div>`;
  }

  return results.map((place, index) => `
    <button
      type="button"
      class="nz-map-search__result${index === activeIndex ? ' nz-map-search__result--active' : ''}"
      data-map-search-result="${escapeHtml(place.code ?? `${place.prefectureId}-${place.name}`)}"
      data-result-index="${index}"
    >
      <span class="nz-map-search__result-label">${escapeHtml(getResultLabel(place))}</span>
      <span class="nz-map-search__result-meta">${escapeHtml(getResultMeta(place))}</span>
    </button>
  `).join('');
}

export function mountMapSearch(
  container: HTMLElement,
  options: {
    onSelectPlace: (place: Municipality) => void;
  },
): () => void {
  let activeIndex = 0;
  let currentResults: Municipality[] = [];

  container.innerHTML = `
    <div class="nz-panel nz-map-search">
      <div class="nz-map-search__input-row">
        <input
          class="nz-map-search__input"
          type="text"
          placeholder="${t('mapSearch.placeholder')}"
          autocomplete="off"
          spellcheck="false"
          aria-label="${t('mapSearch.label')}"
        />
        <button type="button" class="nz-map-search__clear" aria-label="${t('mapSearch.clearQuery')}">×</button>
      </div>
      <div class="nz-map-search__results" aria-live="polite"></div>
    </div>
  `;

  const input = container.querySelector<HTMLInputElement>('.nz-map-search__input')!;
  const clearBtn = container.querySelector<HTMLButtonElement>('.nz-map-search__clear')!;
  const resultsEl = container.querySelector<HTMLElement>('.nz-map-search__results')!;

  function render(): void {
    clearBtn.hidden = input.value.trim().length === 0;
    resultsEl.innerHTML = input.value.trim().length === 0
      ? ''
      : renderMapSearchResultsMarkup(currentResults, activeIndex);
  }

  function updateResults(): void {
    currentResults = searchMunicipalities(input.value, 8);
    activeIndex = 0;
    render();
  }

  function selectActiveResult(index = activeIndex): void {
    const place = currentResults[index];
    if (!place) return;
    options.onSelectPlace(place);
    input.value = '';
    currentResults = [];
    activeIndex = 0;
    render();
  }

  input.addEventListener('input', () => {
    updateResults();
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, Math.max(currentResults.length - 1, 0));
      render();
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      render();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      selectActiveResult();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      currentResults = [];
      render();
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    currentResults = [];
    activeIndex = 0;
    input.focus();
    render();
  });

  resultsEl.addEventListener('mousedown', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-result-index]');
    if (!target) return;
    event.preventDefault();
    const index = Number(target.dataset.resultIndex);
    if (!Number.isNaN(index)) {
      selectActiveResult(index);
    }
  });

  const unsubscribeLocale = onLocaleChange(() => {
    input.setAttribute('placeholder', t('mapSearch.placeholder'));
    input.setAttribute('aria-label', t('mapSearch.label'));
    clearBtn.setAttribute('aria-label', t('mapSearch.clearQuery'));
    render();
  });

  render();

  return () => {
    unsubscribeLocale();
    container.innerHTML = '';
  };
}
