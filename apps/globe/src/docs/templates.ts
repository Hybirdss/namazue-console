import type { DocsContentModel, DocsLocale } from './content';
import type { DocsSurface } from '../namazue/routeModel';

const LOCALE_LABELS: Record<DocsLocale, string> = {
  en: 'EN',
  ja: 'JA',
  ko: 'KO',
};

const ANATOMY_ICONS: Record<string, string> = {
  'event-snapshot': '\u26A1',
  'asset-exposure': '\uD83C\uDFE2',
  'check-these-now': '\u2705',
  'replay-rail': '\u23F1\uFE0F',
};

export interface RenderDocsViewInput {
  locale: DocsLocale;
  surface: DocsSurface;
  content: DocsContentModel;
}

export function buildDocsPath(locale: DocsLocale, surface: DocsSurface): string {
  return surface === 'lab' ? `/${locale}/lab/docs` : `/${locale}/docs`;
}

export function renderDocsView(input: RenderDocsViewInput): string {
  return `
    <div class="docs-shell">
      ${renderNav(input)}
      ${renderHero(input.content)}
      ${renderSectionNav(input.content)}
      <div class="docs-content">
        ${input.content.sections.map((s) => renderSection(s.id, input.content)).join('')}
      </div>
      ${renderFooter()}
    </div>
  `;
}

// ── Navigation ──────────────────────────────────────────────

function renderNav(input: RenderDocsViewInput): string {
  const isLab = input.surface === 'lab';

  return `
    <nav class="docs-nav" role="navigation" aria-label="Main">
      <a class="docs-nav__brand" href="/">
        <img class="docs-nav__logo" src="/favicon.png" alt="" width="28" height="28">
        <span class="docs-nav__wordmark">Namazue</span>
        <span class="docs-nav__badge">Docs</span>
      </a>
      <div class="docs-nav__actions">
        <a class="docs-nav__link" href="/">Console</a>
        <a class="docs-nav__link${isLab ? '' : ' is-active'}" href="${buildDocsPath(input.locale, 'public')}">Docs</a>
        <a class="docs-nav__link${isLab ? ' is-active' : ''}" href="${buildDocsPath(input.locale, 'lab')}">Lab</a>
        <span class="docs-nav__divider"></span>
        ${renderLocaleButtons(input.locale, input.surface)}
      </div>
    </nav>
  `;
}

function renderLocaleButtons(current: DocsLocale, surface: DocsSurface): string {
  return (Object.keys(LOCALE_LABELS) as DocsLocale[])
    .map((locale) => `
      <a
        class="docs-locale-btn${locale === current ? ' is-active' : ''}"
        data-docs-locale="${locale}"
        href="${buildDocsPath(locale, surface)}"
      >${LOCALE_LABELS[locale]}</a>
    `)
    .join('');
}

// ── Hero ────────────────────────────────────────────────────

function renderHero(content: DocsContentModel): string {
  return `
    <header class="docs-hero">
      <span class="docs-hero__kicker docs-reveal">${escapeHtml(content.hero.kicker)}</span>
      <h1 class="docs-hero__title docs-reveal docs-reveal--delay-1">${escapeHtml(content.hero.title)}</h1>
      <p class="docs-hero__subtitle docs-reveal docs-reveal--delay-2">${escapeHtml(content.hero.summary)}</p>
      <a class="docs-hero__cta docs-reveal docs-reveal--delay-3" href="#capabilities">
        ${content.locale === 'ko' ? '주요 기능 보기' : content.locale === 'ja' ? '主要機能を見る' : 'View Capabilities'}
        <span class="docs-hero__cta-arrow">\u2192</span>
      </a>
    </header>
  `;
}

// ── Section Navigation ──────────────────────────────────────

function renderSectionNav(content: DocsContentModel): string {
  return `
    <nav class="docs-section-nav" aria-label="Page sections">
      <div class="docs-section-nav__inner">
        ${content.sections.map((s) => `
          <a class="docs-pill" href="#${s.id}">${escapeHtml(s.title)}</a>
        `).join('')}
      </div>
    </nav>
  `;
}

// ── Section Renderer ────────────────────────────────────────

function renderSection(
  sectionId: DocsContentModel['sections'][number]['id'],
  content: DocsContentModel,
): string {
  const section = content.sections.find((s) => s.id === sectionId);
  if (!section) return '';

  if (sectionId === 'capabilities') return renderCapabilities(section, content);
  if (sectionId === 'console-anatomy') return renderAnatomy(section, content);
  if (sectionId === 'core-workflow') return renderWorkflow(section, content);
  if (sectionId === 'trust-boundaries') return renderTrustBoundaries(section);

  return renderGenericSection(section);
}

function renderGenericSection(section: { id: string; title: string; body: string }): string {
  return `
    <section class="docs-section" id="${section.id}">
      <div class="docs-section__inner">
        <h2 class="docs-section__title docs-reveal">${escapeHtml(section.title)}</h2>
        <p class="docs-section__body docs-reveal docs-reveal--delay-1">${escapeHtml(section.body)}</p>
      </div>
    </section>
  `;
}

// ── Capabilities ────────────────────────────────────────────

function renderCapabilities(
  section: { id: string; title: string; body: string },
  content: DocsContentModel,
): string {
  return `
    <section class="docs-section" id="${section.id}">
      <div class="docs-section__inner">
        <p class="docs-section__eyebrow docs-reveal">Capabilities</p>
        <h2 class="docs-section__title docs-reveal docs-reveal--delay-1">${escapeHtml(section.title)}</h2>
        <p class="docs-section__body docs-reveal docs-reveal--delay-2">${escapeHtml(section.body)}</p>
        <div class="docs-cap-grid">
          ${content.capabilities.map((cap, i) => `
            <article class="docs-cap-card docs-reveal docs-reveal--delay-${Math.min(i + 1, 4)}">
              <span class="docs-cap-card__number">${String(i + 1).padStart(2, '0')}</span>
              <h3 class="docs-cap-card__title">${escapeHtml(cap.title)}</h3>
              <p class="docs-cap-card__summary">${escapeHtml(cap.summary)}</p>
              <p class="docs-cap-card__why">${escapeHtml(cap.whyItMatters)}</p>
              <span class="docs-cap-card__action">
                ${escapeHtml(cap.nextAction)}
                <span class="docs-cap-card__action-arrow">\u2192</span>
              </span>
            </article>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// ── Console Anatomy ─────────────────────────────────────────

function renderAnatomy(
  section: { id: string; title: string; body: string },
  content: DocsContentModel,
): string {
  return `
    <section class="docs-section" id="${section.id}">
      <div class="docs-section__inner">
        <p class="docs-section__eyebrow docs-reveal">Console Anatomy</p>
        <h2 class="docs-section__title docs-reveal docs-reveal--delay-1">${escapeHtml(section.title)}</h2>
        <p class="docs-section__body docs-reveal docs-reveal--delay-2">${escapeHtml(section.body)}</p>
        <div class="docs-anatomy-grid">
          ${content.anatomy.map((item, i) => `
            <article class="docs-anatomy-card docs-reveal docs-reveal--delay-${Math.min(i + 1, 4)}">
              <div class="docs-anatomy-card__icon">${ANATOMY_ICONS[item.id] ?? '\u25CB'}</div>
              <h3 class="docs-anatomy-card__title">${escapeHtml(item.title)}</h3>
              <p class="docs-anatomy-card__body">${escapeHtml(item.body)}</p>
            </article>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// ── Core Workflow ────────────────────────────────────────────

const WORKFLOW_STEPS: Record<DocsLocale, Array<{ title: string; desc: string }>> = {
  en: [
    { title: 'Event activates', desc: 'An earthquake or scenario becomes active on the console.' },
    { title: 'Console interprets', desc: 'The system reads likely consequences and reorders assets by impact.' },
    { title: 'Operator reads', desc: 'Inspect the event, exposed assets, and immediate checks.' },
    { title: 'Drill deeper', desc: 'Use replay, scenario shift, or place context without leaving the surface.' },
  ],
  ko: [
    { title: '\uC774\uBCA4\uD2B8 \uD65C\uC131\uD654', desc: '\uC9C0\uC9C4 \uB610\uB294 \uC2DC\uB098\uB9AC\uC624\uAC00 \uCF58\uC194\uC5D0\uC11C \uD65C\uC131\uD654\uB41C\uB2E4.' },
    { title: '\uCF58\uC194\uC774 \uD574\uC11D', desc: '\uC2DC\uC2A4\uD15C\uC774 \uC608\uC0C1 \uACB0\uACFC\uB97C \uC77D\uACE0 \uC790\uC0B0\uC744 \uC601\uD5A5 \uC21C\uC73C\uB85C \uC7AC\uC815\uB82C\uD55C\uB2E4.' },
    { title: '\uC6B4\uC601\uC790\uAC00 \uD655\uC778', desc: '\uC774\uBCA4\uD2B8, \uB178\uCD9C \uC790\uC0B0, \uC989\uC2DC \uD655\uC778 \uD56D\uBAA9\uC744 \uC77D\uB294\uB2E4.' },
    { title: '\uB354 \uAE4A\uAC8C', desc: '\uB9AC\uD50C\uB808\uC774, \uC2DC\uB098\uB9AC\uC624 \uC2DC\uD504\uD2B8, \uC7A5\uC18C \uBB38\uB9E5\uC744 \uD654\uBA74\uC744 \uBC97\uC5B4\uB098\uC9C0 \uC54A\uACE0 \uD0D0\uC0C9\uD55C\uB2E4.' },
  ],
  ja: [
    { title: '\u30A4\u30D9\u30F3\u30C8\u767A\u751F', desc: '\u5730\u9707\u307E\u305F\u306F\u30B7\u30CA\u30EA\u30AA\u304C\u30B3\u30F3\u30BD\u30FC\u30EB\u3067\u6709\u52B9\u306B\u306A\u308B\u3002' },
    { title: '\u30B3\u30F3\u30BD\u30FC\u30EB\u304C\u89E3\u91C8', desc: '\u30B7\u30B9\u30C6\u30E0\u304C\u4E88\u60F3\u3055\u308C\u308B\u5F71\u97FF\u3092\u8AAD\u307F\u3001\u8CC7\u7523\u3092\u5F71\u97FF\u9806\u306B\u4E26\u3079\u66FF\u3048\u308B\u3002' },
    { title: '\u30AA\u30DA\u30EC\u30FC\u30BF\u30FC\u304C\u78BA\u8A8D', desc: '\u30A4\u30D9\u30F3\u30C8\u3001\u9732\u51FA\u8CC7\u7523\u3001\u5373\u6642\u78BA\u8A8D\u9805\u76EE\u3092\u8AAD\u3080\u3002' },
    { title: '\u3055\u3089\u306B\u6DF1\u304F', desc: '\u30EA\u30D7\u30EC\u30A4\u3001\u30B7\u30CA\u30EA\u30AA\u30B7\u30D5\u30C8\u3001\u5730\u70B9\u6587\u8108\u3092\u753B\u9762\u3092\u96E2\u308C\u305A\u306B\u63A2\u7D22\u3002' },
  ],
};

function renderWorkflow(
  section: { id: string; title: string; body: string },
  content: DocsContentModel,
): string {
  const steps = WORKFLOW_STEPS[content.locale] ?? WORKFLOW_STEPS.en;

  return `
    <section class="docs-section" id="${section.id}">
      <div class="docs-section__inner">
        <p class="docs-section__eyebrow docs-reveal">Workflow</p>
        <h2 class="docs-section__title docs-reveal docs-reveal--delay-1">${escapeHtml(section.title)}</h2>
        <p class="docs-section__body docs-reveal docs-reveal--delay-2">${escapeHtml(section.body)}</p>
        <div class="docs-workflow">
          ${steps.map((step, i) => `
            <div class="docs-workflow__step docs-reveal docs-reveal--delay-${Math.min(i + 1, 4)}">
              <span class="docs-workflow__dot">${i + 1}</span>
              <div class="docs-workflow__text">
                <h3 class="docs-workflow__text-title">${escapeHtml(step.title)}</h3>
                <p class="docs-workflow__text-desc">${escapeHtml(step.desc)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

// ── Trust Boundaries ────────────────────────────────────────

function renderTrustBoundaries(section: { id: string; title: string; body: string }): string {
  return `
    <section class="docs-section" id="${section.id}">
      <div class="docs-section__inner">
        <h2 class="docs-section__title docs-reveal">${escapeHtml(section.title)}</h2>
        <div class="docs-trust docs-reveal docs-reveal--delay-1">
          <span class="docs-trust__icon">\u26A0\uFE0F</span>
          <p class="docs-trust__text">${escapeHtml(section.body)}</p>
        </div>
      </div>
    </section>
  `;
}

// ── Footer ──────────────────────────────────────────────────

function renderFooter(): string {
  return `
    <footer class="docs-footer">
      <span class="docs-footer__copy">\u00A9 2026 Namazue</span>
      <div class="docs-footer__links">
        <a class="docs-footer__link" href="/">Console</a>
        <a class="docs-footer__link" href="https://github.com" target="_blank" rel="noopener">GitHub</a>
      </div>
    </footer>
  `;
}

// ── Helpers ──────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
