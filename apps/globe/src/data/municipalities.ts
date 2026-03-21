import {
  MUNICIPALITY_DATA,
  MUNICIPALITY_DATASET_METADATA,
  type MunicipalityData,
} from './municipalities.generated';
import { fetchReferenceJson } from './referenceApi';

export interface Municipality extends Omit<MunicipalityData, 'code'> {
  code?: string;
}

/** Full official municipality and ward dataset for Japan. */
export let MUNICIPALITIES: Municipality[] = MUNICIPALITY_DATA;

/** Count of assessed municipality / ward units. */
export let MUNICIPALITY_UNIT_COUNT = MUNICIPALITIES.length;

/** Sum of all municipality / ward populations in the dataset. */
export let CATALOGED_POPULATION = MUNICIPALITIES.reduce((sum, municipality) => {
  return sum + municipality.population;
}, 0);

/** Japan resident registry total population as of 2025-01-01. */
export let JAPAN_TOTAL_POPULATION: number = MUNICIPALITY_DATASET_METADATA.totalPopulation;

/** Dataset coverage ratio against the official national total. */
export let COVERAGE_RATIO = CATALOGED_POPULATION / JAPAN_TOTAL_POPULATION;

interface MunicipalityCatalogResponse {
  municipalities: Municipality[];
  metadata: {
    totalPopulation: number;
  };
}

function applyMunicipalityCatalog(
  municipalities: Municipality[],
  totalPopulation: number,
): void {
  MUNICIPALITIES = municipalities;
  MUNICIPALITY_UNIT_COUNT = MUNICIPALITIES.length;
  CATALOGED_POPULATION = MUNICIPALITIES.reduce((sum, municipality) => sum + municipality.population, 0);
  JAPAN_TOTAL_POPULATION = totalPopulation;
  COVERAGE_RATIO = JAPAN_TOTAL_POPULATION > 0
    ? CATALOGED_POPULATION / JAPAN_TOTAL_POPULATION
    : 0;
}

export async function loadMunicipalities(): Promise<number> {
  const payload = await fetchReferenceJson<MunicipalityCatalogResponse>('/api/reference/municipalities', 10_000);
  if (Array.isArray(payload?.municipalities) && typeof payload.metadata?.totalPopulation === 'number') {
    applyMunicipalityCatalog(payload.municipalities, payload.metadata.totalPopulation);
  }
  return MUNICIPALITY_UNIT_COUNT;
}
