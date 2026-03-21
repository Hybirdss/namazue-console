# Namazue SEO Strategy

## Executive Summary

Namazue occupies a unique position: **"earthquake intelligence"** has near-zero competition.
USGS/JMA dominate raw data; Yahoo Japan/tenki.jp own consumer alert traffic.
Nobody owns the **operator-grade intelligence** space.

**Target SEO score: 9.5/10** (from 6.5/10 baseline)

---

## Competitive Landscape

| Competitor | Strength | Weakness | Our Angle |
|---|---|---|---|
| USGS | .gov authority, data monopoly | Zero SEO optimization, Angular SPA invisible to crawlers | Better UX, intelligence layer |
| Yahoo Japan | Brand trust, 地震情報 traffic | Consumer-only, no depth analysis | Operator-grade positioning |
| tenki.jp | Best Japanese SEO (NewsArticle schema) | No infrastructure impact | Impact intelligence niche |
| Temblor | Best structured data, expert blog | US/global focus, paid model | Free + Japan-specific |
| VolcanoDiscovery | Programmatic pages, FAQ schema | Bloated, ad-heavy | Clean operator UX |
| EarthquakeTrack | Massive long-tail city pages | No intelligence, just data | Analysis over aggregation |
| Windy | Viral product, massive traffic | Earthquakes are secondary | Earthquake-first console |
| GDACS | Multi-hazard global | Zero SEO, institutional only | Public-facing intelligence |

---

## Keyword Strategy

### Tier 1: Own These (Low Competition, High Relevance)

| Keyword | Lang | Competition | Action |
|---|---|---|---|
| earthquake intelligence console | EN | None | Already in title |
| 地震 インテリジェンス | JA | None | In meta description |
| 지진 인텔리전스 | KO | None | In noscript content |
| disaster intelligence platform | EN | Very Low | Blog content |
| infrastructure impact earthquake | EN | Very Low | Feature page content |
| 地震 インフラ 影響 | JA | None | In meta description |
| 지진 인프라 피해 | KO | None | Blog/noscript content |
| 地震 被害 予測 | JA | Low | GMPE feature angle |
| earthquake situational awareness | EN | Very Low | Already in meta |

### Tier 2: Compete Strategically (Medium Competition)

| Keyword | Lang | Leader | Our Approach |
|---|---|---|---|
| real-time earthquake map | EN | USGS | "intelligence map" differentiation |
| 地震 リアルタイム 地図 | JA | Yahoo/tenki | Add "インフラ" qualifier |
| 활단층 지도 | KO | KMA | We have active fault layer |
| 지진 실시간 지도 | KO | Very few | Korean market wide open |
| earthquake monitoring Japan | EN | USGS, JMA | Japan-specific intelligence |
| seismic hazard map Japan | EN | J-SHIS | Interactive vs static |
| GMPE intensity modeling | EN | Academic papers | Product-focused content |

### Tier 3: Aspirational (High Competition — Long-term)

| Keyword | Notes |
|---|---|
| 地震情報 | Yahoo/JMA stronghold — need blog authority first |
| earthquake today | USGS/EarthquakeTrack — need programmatic pages |
| 地震 速報 | NHK/Yahoo — alert app territory |

---

## Technical SEO — Implemented

### Files Created
- `robots.txt` — crawl directives, sitemap reference
- `sitemap.xml` — with hreflang alternates for JA/EN/KO
- `manifest.webmanifest` — PWA manifest with icons
- `icon-192.png`, `icon-512.png` — Android PWA icons
- `apple-touch-icon.png` — iOS bookmark icon

### HTML Enhancements
- `<html lang="ja">` — Japanese primary market (dynamically synced)
- `<link rel="canonical">` — prevents duplicate content
- `<link rel="alternate" hreflang>` — JA/EN/KO/x-default
- `<link rel="apple-touch-icon">` — iOS support
- `<link rel="manifest">` — PWA install
- `meta robots` — max-image-preview:large for rich snippets
- `og:image:alt` — accessibility for social cards
- `og:locale:alternate` — EN/KO alternate locales

### Structured Data (JSON-LD @graph)
1. **Organization** — brand entity for knowledge graph
2. **WebApplication** — app listing with features, languages, pricing
3. **WebSite** — with SearchAction for sitelinks searchbox
4. **FAQPage** — 4 Q&As in EN/JA for rich snippets

### Noscript Fallback
Crawler-visible content in `<noscript>` with:
- H1/H2 semantic headings
- Feature list in EN/JA/KO
- Data sources listed
- Natural keyword usage
- Internal link to namazue.dev

### Dynamic Lang Sync
`document.documentElement.lang` synced with i18n locale on:
- Module init (from detectLocale)
- Every setLocale() call

---

## Content Strategy — Phase 2 (TODO)

### Blog / Insights Section
Following Temblor's proven model:

1. **Earthquake event analysis posts** — auto-generated from worker analysis
   - "M6.2 off Miyagi: infrastructure impact assessment"
   - "2026年宮城沖M6.2：インフラ影響分析"
   - Target: "M6.2 earthquake Japan" event-driven searches

2. **Educational content**
   - "Understanding GMPE: How ground motion is predicted"
   - "Active faults of Japan: A complete guide"
   - "活断層とは：日本の主要活断層ガイド"
   - Target: evergreen informational queries

3. **Technical articles**
   - "Real-time seismic monitoring architecture"
   - Target: developer/technical audience, backlink generation

### Programmatic Event Pages (Future)
Server-rendered `/event/{id}` pages with:
- Event details, intensity map screenshot
- Nearby infrastructure assessment
- JSON-LD Event schema
- Target: "earthquake [location] [date]" long-tail

---

## Performance Metrics

### Track Monthly
- Google Search Console impressions/clicks
- Keyword rankings for Tier 1 terms
- Core Web Vitals (LCP, FID, CLS)
- Structured data validation (Rich Results Test)
- Social share click-through rate

### Target Milestones
- **Month 1**: Indexed by Google/Bing, FAQPage rich snippets appearing
- **Month 3**: Top 10 for "earthquake intelligence console"
- **Month 6**: Top 10 for "地震 インフラ 影響", Korean earthquake map queries
- **Month 12**: Blog generating 20% of organic traffic

---

## Implementation Priority

| Priority | Item | Status |
|---|---|---|
| P0 | robots.txt | Done |
| P0 | sitemap.xml with hreflang | Done |
| P0 | JSON-LD structured data | Done |
| P0 | Canonical URL | Done |
| P0 | Bilingual meta description | Done |
| P0 | manifest.webmanifest + icons | Done |
| P0 | Noscript fallback content | Done |
| P0 | Dynamic html lang sync | Done |
| P1 | Google Search Console registration | Manual |
| P1 | Bing Webmaster Tools registration | Manual |
| P1 | Submit sitemap to Google/Bing | Manual |
| P2 | Blog/insights section | Future |
| P2 | Server-rendered event pages | Future |
| P2 | Programmatic location pages | Future |
| P3 | Backlink outreach to seismology sites | Future |
