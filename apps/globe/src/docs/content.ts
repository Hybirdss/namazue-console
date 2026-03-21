import en from './copy/en';
import ja from './copy/ja';
import ko from './copy/ko';

export type DocsLocale = 'ja' | 'ko' | 'en';

export const DOCS_SECTION_IDS = [
  'what-this-product-does',
  'core-workflow',
  'capabilities',
  'console-anatomy',
  'how-to-use-it',
  'trust-boundaries',
  'go-deeper',
] as const;

export type DocsSectionId = (typeof DOCS_SECTION_IDS)[number];

export const DOCS_CAPABILITY_IDS = [
  'see-the-event',
  'read-operational-impact',
  'explore-replay-and-scenario-shift',
  'inspect-place-and-asset-context',
  'understand-why-the-console-says-this',
] as const;

export type DocsCapabilityId = (typeof DOCS_CAPABILITY_IDS)[number];

export const DOCS_ANATOMY_IDS = [
  'event-snapshot',
  'asset-exposure',
  'check-these-now',
  'replay-rail',
] as const;

export type DocsAnatomyId = (typeof DOCS_ANATOMY_IDS)[number];

export interface DocsHeroCopy {
  kicker: string;
  title: string;
  summary: string;
}

export interface DocsSectionCopy {
  title: string;
  body: string;
}

export interface DocsCapabilityCopy {
  title: string;
  summary: string;
  whyItMatters: string;
  nextAction: string;
}

export interface DocsAnatomyCopy {
  title: string;
  body: string;
}

export interface DocsCopy {
  meta: {
    title: string;
    description: string;
  };
  hero: DocsHeroCopy;
  sections: Record<DocsSectionId, DocsSectionCopy>;
  capabilities: Record<DocsCapabilityId, DocsCapabilityCopy>;
  anatomy: Record<DocsAnatomyId, DocsAnatomyCopy>;
}

export interface DocsSection {
  id: DocsSectionId;
  title: string;
  body: string;
}

export interface DocsCapability {
  id: DocsCapabilityId;
  title: string;
  summary: string;
  whyItMatters: string;
  nextAction: string;
  relatedSurfaceIds: string[];
}

export interface DocsAnatomyItem {
  id: DocsAnatomyId;
  title: string;
  body: string;
}

export interface DocsContentModel {
  locale: DocsLocale;
  meta: DocsCopy['meta'];
  hero: DocsHeroCopy;
  sections: DocsSection[];
  capabilities: DocsCapability[];
  anatomy: DocsAnatomyItem[];
}

const CAPABILITY_REGISTRY: ReadonlyArray<{
  id: DocsCapabilityId;
  relatedSurfaceIds: string[];
}> = [
  { id: 'see-the-event', relatedSurfaceIds: ['event-snapshot', 'map-overlays'] },
  { id: 'read-operational-impact', relatedSurfaceIds: ['asset-exposure', 'check-these-now'] },
  { id: 'explore-replay-and-scenario-shift', relatedSurfaceIds: ['replay-rail', 'scenario-shift'] },
  { id: 'inspect-place-and-asset-context', relatedSurfaceIds: ['asset-exposure', 'location-context'] },
  { id: 'understand-why-the-console-says-this', relatedSurfaceIds: ['analyst-note', 'impact-intelligence'] },
] as const;

const COPY_BY_LOCALE: Record<DocsLocale, DocsCopy> = { en, ja, ko };

export function buildDocsContent(locale: DocsLocale): DocsContentModel {
  const copy = COPY_BY_LOCALE[locale];

  return {
    locale,
    meta: copy.meta,
    hero: copy.hero,
    sections: DOCS_SECTION_IDS.map((id) => ({
      id,
      title: copy.sections[id].title,
      body: copy.sections[id].body,
    })),
    capabilities: CAPABILITY_REGISTRY.map((capability) => ({
      id: capability.id,
      title: copy.capabilities[capability.id].title,
      summary: copy.capabilities[capability.id].summary,
      whyItMatters: copy.capabilities[capability.id].whyItMatters,
      nextAction: copy.capabilities[capability.id].nextAction,
      relatedSurfaceIds: capability.relatedSurfaceIds,
    })),
    anatomy: DOCS_ANATOMY_IDS.map((id) => ({
      id,
      title: copy.anatomy[id].title,
      body: copy.anatomy[id].body,
    })),
  };
}
