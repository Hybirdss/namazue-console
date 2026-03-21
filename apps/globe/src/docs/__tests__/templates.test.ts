import { describe, expect, it } from 'vitest';

import { buildDocsContent } from '../content';
import { renderDocsView } from '../templates';

describe('renderDocsView', () => {
  it('renders the same core article body for public and lab docs surfaces', () => {
    const content = buildDocsContent('ja');
    const publicMarkup = renderDocsView({ locale: 'ja', surface: 'public', content });
    const labMarkup = renderDocsView({ locale: 'ja', surface: 'lab', content });

    expect(publicMarkup).toContain(content.hero.title);
    expect(labMarkup).toContain(content.hero.title);
    expect(publicMarkup).toContain('id="capabilities"');
    expect(labMarkup).toContain('id="capabilities"');
  });

  it('renders scroll-reveal classes for animation', () => {
    const content = buildDocsContent('en');
    const markup = renderDocsView({ locale: 'en', surface: 'public', content });

    expect(markup).toContain('docs-reveal');
    expect(markup).toContain('docs-hero__title');
    expect(markup).toContain('docs-cap-card');
  });

  it('renders workflow steps in the correct locale', () => {
    const koContent = buildDocsContent('ko');
    const koMarkup = renderDocsView({ locale: 'ko', surface: 'public', content: koContent });

    expect(koMarkup).toContain('docs-workflow__step');
  });

  it('renders anatomy cards with icons', () => {
    const content = buildDocsContent('en');
    const markup = renderDocsView({ locale: 'en', surface: 'public', content });

    expect(markup).toContain('docs-anatomy-card');
    expect(markup).toContain('docs-anatomy-card__icon');
  });

  it('renders trust boundaries with warning banner', () => {
    const content = buildDocsContent('en');
    const markup = renderDocsView({ locale: 'en', surface: 'public', content });

    expect(markup).toContain('docs-trust');
  });

  it('renders sticky navigation with locale buttons', () => {
    const content = buildDocsContent('ja');
    const markup = renderDocsView({ locale: 'ja', surface: 'public', content });

    expect(markup).toContain('docs-nav');
    expect(markup).toContain('docs-locale-btn');
    expect(markup).toContain('data-docs-locale="ja"');
  });
});
