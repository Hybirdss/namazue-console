import './styles.css';

import type { DocsLocale } from './content';
import type { DocsContentModel } from './content';
import { buildDocsContent } from './content';
import { buildDocsPath, renderDocsView } from './templates';
import type { DocsSurface } from '../namazue/routeModel';
import { resolveDocsLocale, resolveDocsSurface } from '../namazue/routeModel';

const ORIGIN = 'https://namazue.dev';
const OG_LOCALE_BY_DOCS_LOCALE: Record<DocsLocale, string> = {
  en: 'en_US',
  ja: 'ja_JP',
  ko: 'ko_KR',
};

function removeLegacyLoadingScreen(): void {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.remove();
  }
}

function detectPreferredLocale(): DocsLocale {
  const saved = readSavedLocale();
  if (saved) {
    return saved;
  }

  const browserPrefix = navigator.language?.slice(0, 2).toLowerCase();
  if (browserPrefix === 'en' || browserPrefix === 'ko' || browserPrefix === 'ja') {
    return browserPrefix;
  }

  return 'ja';
}

function readSavedLocale(): DocsLocale | null {
  try {
    const saved = window.localStorage.getItem('namazue.docs.locale');
    return saved === 'en' || saved === 'ko' || saved === 'ja' ? saved : null;
  } catch {
    return null;
  }
}

function saveLocale(locale: DocsLocale): void {
  try {
    window.localStorage.setItem('namazue.docs.locale', locale);
  } catch {
    // Ignore storage failures. The route path still carries locale authority.
  }
}

function ensureLocalizedDocsPath(): void {
  const pathname = window.location.pathname;
  if (pathname !== '/docs' && pathname !== '/lab/docs') {
    return;
  }

  const surface = pathname === '/lab/docs' ? 'lab' : 'public';
  const locale = detectPreferredLocale();
  window.history.replaceState({}, '', buildDocsPath(locale, surface));
}

function toAbsoluteUrl(path: string): string {
  return new URL(path, ORIGIN).toString();
}

function ensureLinkElement(selector: string, attrs: Record<string, string>): HTMLLinkElement {
  let element = document.head.querySelector<HTMLLinkElement>(selector);
  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attrs).forEach(([key, value]) => {
    element!.setAttribute(key, value);
  });

  return element;
}

function ensureMetaElement(selector: string, attrs: Record<string, string>): HTMLMetaElement {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attrs).forEach(([key, value]) => {
    element!.setAttribute(key, value);
  });

  return element;
}

function syncAlternateLanguageLinks(): void {
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((element) => element.remove());

  (['ja', 'en', 'ko'] as const).forEach((locale) => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = locale;
    link.href = toAbsoluteUrl(buildDocsPath(locale, 'public'));
    link.dataset.docsAlt = 'true';
    document.head.appendChild(link);
  });

  const fallback = document.createElement('link');
  fallback.rel = 'alternate';
  fallback.hreflang = 'x-default';
  fallback.href = toAbsoluteUrl(buildDocsPath('ja', 'public'));
  fallback.dataset.docsAlt = 'true';
  document.head.appendChild(fallback);
}

export function syncDocsHead(input: {
  locale: DocsLocale;
  surface: DocsSurface;
  path: string;
  content: DocsContentModel;
}): void {
  const publicPath = buildDocsPath(input.locale, 'public');
  const canonicalPath = input.surface === 'public' ? input.path : publicPath;
  const robots = input.surface === 'public' ? 'index, follow' : 'noindex, follow';

  document.title = input.content.meta.title;
  document.documentElement.lang = input.locale;

  ensureLinkElement('link[rel="canonical"]', {
    rel: 'canonical',
    href: toAbsoluteUrl(canonicalPath),
  });

  ensureMetaElement('meta[name="description"]', {
    name: 'description',
    content: input.content.meta.description,
  });

  ensureMetaElement('meta[name="robots"]', {
    name: 'robots',
    content: robots,
  });

  ensureMetaElement('meta[property="og:title"]', {
    property: 'og:title',
    content: input.content.meta.title,
  });

  ensureMetaElement('meta[property="og:description"]', {
    property: 'og:description',
    content: input.content.meta.description,
  });

  ensureMetaElement('meta[property="og:url"]', {
    property: 'og:url',
    content: toAbsoluteUrl(canonicalPath),
  });

  ensureMetaElement('meta[property="og:locale"]', {
    property: 'og:locale',
    content: OG_LOCALE_BY_DOCS_LOCALE[input.locale],
  });

  syncAlternateLanguageLinks();
}

function bindLocaleLinks(root: HTMLElement, render: () => void): void {
  root.querySelectorAll<HTMLAnchorElement>('[data-docs-locale]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const nextLocale = link.dataset.docsLocale;
      if (nextLocale !== 'en' && nextLocale !== 'ko' && nextLocale !== 'ja') {
        return;
      }

      event.preventDefault();
      const surface = resolveDocsSurface(window.location.pathname);
      saveLocale(nextLocale);
      window.history.pushState({ locale: nextLocale }, '', buildDocsPath(nextLocale, surface));
      render();
    });
  });
}

// ── Scroll Reveal via IntersectionObserver ───────────────────

function initScrollReveal(root: HTMLElement): () => void {
  const targets = root.querySelectorAll<HTMLElement>('.docs-reveal');
  if (!targets.length) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
  );

  targets.forEach((el) => observer.observe(el));
  return () => observer.disconnect();
}

// ── Smooth Section Scroll ───────────────────────────────────

function bindSmoothScroll(root: HTMLElement): void {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href')?.slice(1);
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (!target) return;

      e.preventDefault();
      const navHeight = 64 + 52; // nav + section-nav sticky heights
      const top = target.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

// ── Active Section Highlight ─────────────────────────────────

function initActiveSectionTracker(root: HTMLElement): () => void {
  const sections = root.querySelectorAll<HTMLElement>('.docs-section[id]');
  const pills = root.querySelectorAll<HTMLAnchorElement>('.docs-pill');

  if (!sections.length || !pills.length) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          pills.forEach((pill) => {
            pill.classList.toggle('is-active', pill.getAttribute('href') === `#${id}`);
          });
        }
      }
    },
    { threshold: 0.15, rootMargin: '-120px 0px -50% 0px' },
  );

  sections.forEach((s) => observer.observe(s));
  return () => observer.disconnect();
}

// ── Pretendard Font Loader ───────────────────────────────────

function loadPretendard(): void {
  if (document.querySelector('link[href*="pretendard"]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';
  document.head.appendChild(link);
}

// ── Bootstrap ────────────────────────────────────────────────

export function bootstrapDocsApp(): void {
  const maybeApp = document.getElementById('app');
  if (!maybeApp) {
    throw new Error('Missing #app root element');
  }
  const app: HTMLElement = maybeApp;

  removeLegacyLoadingScreen();
  ensureLocalizedDocsPath();
  loadPretendard();

  document.body.classList.remove('namazue-body');
  document.body.classList.add('docs-body');

  let cleanupReveal = (): void => {};
  let cleanupTracker = (): void => {};

  function render(): void {
    cleanupReveal();
    cleanupTracker();

    const locale = resolveDocsLocale(window.location.pathname) ?? detectPreferredLocale();
    const surface = resolveDocsSurface(window.location.pathname);
    const content = buildDocsContent(locale);

    app.className = 'docs-app';
    app.innerHTML = renderDocsView({ locale, surface, content });
    syncDocsHead({
      locale,
      surface,
      path: window.location.pathname,
      content,
    });
    bindLocaleLinks(app, render);
    bindSmoothScroll(app);

    // Defer observers to next frame for layout to settle
    requestAnimationFrame(() => {
      cleanupReveal = initScrollReveal(app);
      cleanupTracker = initActiveSectionTracker(app);
    });
  }

  function handlePopState(): void {
    window.scrollTo({ top: 0 });
    render();
  }

  window.addEventListener('popstate', handlePopState);
  render();

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      cleanupReveal();
      cleanupTracker();
      window.removeEventListener('popstate', handlePopState);
    });
  }
}
