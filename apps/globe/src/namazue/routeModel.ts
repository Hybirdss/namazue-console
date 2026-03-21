export type AppRoute = 'console' | 'lab' | 'docs';
export type DocsLocale = 'ja' | 'ko' | 'en';
export type DocsSurface = 'public' | 'lab';

export const LAB_TAB_IDS = [
  'console',
  'design',
  'states',
  'components',
  'architecture',
  'voice',
] as const;

export type LabTabId = (typeof LAB_TAB_IDS)[number];

const DOCS_LOCALES: readonly DocsLocale[] = ['ja', 'ko', 'en'] as const;

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) || '/' : pathname;
}

function splitPath(pathname: string): string[] {
  return normalizePathname(pathname).split('/').filter(Boolean);
}

function isDocsLocale(value: string | undefined): value is DocsLocale {
  return DOCS_LOCALES.includes(value as DocsLocale);
}

function isDocsPath(pathname: string): boolean {
  const parts = splitPath(pathname);

  if (parts[0] === 'docs') return true;
  if (parts[0] === 'lab' && parts[1] === 'docs') return true;
  if (!isDocsLocale(parts[0])) return false;
  if (parts[1] === 'docs') return true;
  return parts[1] === 'lab' && parts[2] === 'docs';
}

export function resolveAppRoute(pathname: string): AppRoute {
  const normalized = normalizePathname(pathname);

  if (isDocsPath(normalized)) {
    return 'docs';
  }

  if (normalized === '/lab' || normalized.startsWith('/lab/')) {
    return 'lab';
  }

  return 'console';
}

export function resolveDocsLocale(pathname: string): DocsLocale | null {
  const parts = splitPath(pathname);
  return isDocsLocale(parts[0]) ? parts[0] : null;
}

export function resolveDocsSurface(pathname: string): DocsSurface {
  const parts = splitPath(pathname);
  if (parts[0] === 'lab' || parts[1] === 'lab') return 'lab';
  return 'public';
}

export function resolveLabTab(pathname: string): LabTabId {
  const normalized = normalizePathname(pathname);
  const match = normalized.match(/^\/lab\/([^/]+)$/);
  const candidate = match?.[1];

  if (!candidate) {
    return 'console';
  }

  return LAB_TAB_IDS.includes(candidate as LabTabId)
    ? (candidate as LabTabId)
    : 'console';
}
