/**
 * SEO Routes — Dynamic sitemap, RSS/Atom feeds, OG meta, IndexNow, News sitemap.
 *
 * GET /sitemap.xml      — Dynamic sitemap with recent significant earthquakes
 * GET /sitemap-news.xml — Google News sitemap (last 48h, M5.0+)
 * GET /feed.xml         — RSS 2.0 feed of recent earthquakes
 * GET /feed.atom        — Atom 1.0 feed of recent earthquakes
 * GET /indexnow         — IndexNow key verification (Bing/Yandex instant indexing)
 * GET /event/:id        — HTML page with dynamic OG tags for social card previews
 */

import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { earthquakes } from '@namazue/db';
import { desc, gte, and, sql } from 'drizzle-orm';

export const seoRoute = new Hono<{ Bindings: Env }>();

const INDEXNOW_KEY = 'b7e4f2a8c1d6e3f9';

// ── Dynamic Sitemap ──────────────────────────────────────────

seoRoute.get('/sitemap.xml', async (c) => {
  const db = createDb(c.env.DATABASE_URL);

  // Significant events from last 90 days (M4.0+)
  const since = new Date(Date.now() - 90 * 86_400_000);
  const events = await db
    .select({
      id: earthquakes.id,
      time: earthquakes.time,
      magnitude: earthquakes.magnitude,
    })
    .from(earthquakes)
    .where(gte(earthquakes.time, since))
    .orderBy(desc(earthquakes.magnitude))
    .limit(200);

  const eventUrls = events.map((e) => {
    const lastmod = new Date(e.time).toISOString().slice(0, 10);
    const priority = e.magnitude >= 6.0 ? '0.9' : e.magnitude >= 5.0 ? '0.7' : '0.5';
    return `  <url>
    <loc>https://namazue.dev/event/${e.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://namazue.dev/</loc>
    <xhtml:link rel="alternate" hreflang="ja" href="https://namazue.dev/?lang=ja" />
    <xhtml:link rel="alternate" hreflang="en" href="https://namazue.dev/?lang=en" />
    <xhtml:link rel="alternate" hreflang="ko" href="https://namazue.dev/?lang=ko" />
    <xhtml:link rel="alternate" hreflang="x-default" href="https://namazue.dev/" />
    <changefreq>always</changefreq>
    <priority>1.0</priority>
  </url>
${eventUrls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Robots-Tag': 'index, follow',
    },
  });
});

// ── Google News Sitemap ──────────────────────────────────────

seoRoute.get('/sitemap-news.xml', async (c) => {
  const db = createDb(c.env.DATABASE_URL);

  // Google News requires articles from last 2 days, M5.0+ for significance
  const since = new Date(Date.now() - 2 * 86_400_000);
  const events = await db
    .select({
      id: earthquakes.id,
      time: earthquakes.time,
      magnitude: earthquakes.magnitude,
      place: earthquakes.place,
    })
    .from(earthquakes)
    .where(and(gte(earthquakes.time, since), gte(earthquakes.magnitude, 5.0)))
    .orderBy(desc(earthquakes.time))
    .limit(100);

  const newsUrls = events.map((e) => {
    const pubDate = new Date(e.time).toISOString();
    const mag = Number(e.magnitude).toFixed(1);
    const place = String(e.place ?? 'Unknown Location');
    return `  <url>
    <loc>https://namazue.dev/event/${e.id}</loc>
    <news:news>
      <news:publication>
        <news:name>Namazue</news:name>
        <news:language>ja</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>M${mag} Earthquake — ${escapeXml(place)}</news:title>
      <news:keywords>earthquake, seismic, ${escapeXml(place)}, magnitude ${mag}</news:keywords>
    </news:news>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${newsUrls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
      'X-Robots-Tag': 'index, follow',
    },
  });
});

// ── RSS 2.0 Feed ─────────────────────────────────────────────

seoRoute.get('/feed.xml', async (c) => {
  const db = createDb(c.env.DATABASE_URL);

  const since = new Date(Date.now() - 7 * 86_400_000);
  const events = await db
    .select({
      id: earthquakes.id,
      time: earthquakes.time,
      magnitude: earthquakes.magnitude,
      lat: earthquakes.lat,
      lng: earthquakes.lng,
      depth_km: sql<number>`${earthquakes.depth_km}`,
      place: earthquakes.place,
      tsunami: earthquakes.tsunami,
    })
    .from(earthquakes)
    .where(and(gte(earthquakes.time, since), gte(earthquakes.magnitude, 4.0)))
    .orderBy(desc(earthquakes.time))
    .limit(50);

  const items = events.map((e) => {
    const mag = Number(e.magnitude).toFixed(1);
    const depth = Math.round(Number(e.depth_km));
    const place = String(e.place ?? 'Unknown Location');
    const pubDate = new Date(e.time).toUTCString();
    const tsunami = e.tsunami ? ' [Tsunami Warning]' : '';
    const url = `https://namazue.dev/event/${e.id}`;

    return `    <item>
      <title>M${mag} Earthquake — ${escapeXml(place)}${tsunami}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>Magnitude ${mag} earthquake at ${depth}km depth near ${escapeXml(place)}. Real-time intensity analysis and infrastructure impact assessment.</description>
      <category>Earthquake</category>
      <geo:lat>${e.lat}</geo:lat>
      <geo:long>${e.lng}</geo:long>
    </item>`;
  }).join('\n');

  const buildDate = new Date().toUTCString();

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:geo="http://www.w3.org/2003/01/geo/wgs84_pos#">
  <channel>
    <title>Namazue — Earthquake Intelligence Feed</title>
    <link>https://namazue.dev</link>
    <description>Real-time significant earthquake events (M4.0+) monitored by Namazue. Data sourced from USGS and JMA with GMPE intensity modeling.</description>
    <language>ja</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <ttl>15</ttl>
    <image>
      <url>https://namazue.dev/icon-192.png</url>
      <title>Namazue</title>
      <link>https://namazue.dev</link>
      <width>192</width>
      <height>192</height>
    </image>
    <atom:link href="https://namazue.dev/feed.xml" rel="self" type="application/rss+xml" />
    <atom:link href="https://namazue.dev" rel="alternate" type="text/html" />
    <copyright>Earthquake data: USGS, JMA. Analysis: Namazue.</copyright>
    <managingEditor>info@namazue.dev (Namazue)</managingEditor>
    <webMaster>info@namazue.dev (Namazue)</webMaster>
    <category>Science/Earth Sciences/Seismology</category>
    <category>Disaster Monitoring</category>
    <docs>https://www.rssboard.org/rss-specification</docs>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
      'X-Robots-Tag': 'index, follow',
    },
  });
});

// ── Atom 1.0 Feed ────────────────────────────────────────────

seoRoute.get('/feed.atom', async (c) => {
  const db = createDb(c.env.DATABASE_URL);

  const since = new Date(Date.now() - 7 * 86_400_000);
  const events = await db
    .select({
      id: earthquakes.id,
      time: earthquakes.time,
      magnitude: earthquakes.magnitude,
      lat: earthquakes.lat,
      lng: earthquakes.lng,
      depth_km: sql<number>`${earthquakes.depth_km}`,
      place: earthquakes.place,
      tsunami: earthquakes.tsunami,
    })
    .from(earthquakes)
    .where(and(gte(earthquakes.time, since), gte(earthquakes.magnitude, 4.0)))
    .orderBy(desc(earthquakes.time))
    .limit(50);

  const updated = events.length > 0
    ? new Date(events[0].time).toISOString()
    : new Date().toISOString();

  const entries = events.map((e) => {
    const mag = Number(e.magnitude).toFixed(1);
    const depth = Math.round(Number(e.depth_km));
    const place = String(e.place ?? 'Unknown Location');
    const isoTime = new Date(e.time).toISOString();
    const tsunami = e.tsunami ? ' [Tsunami Warning]' : '';
    const url = `https://namazue.dev/event/${e.id}`;

    return `  <entry>
    <title>M${mag} Earthquake — ${escapeXml(place)}${tsunami}</title>
    <link href="${url}" rel="alternate" type="text/html" />
    <id>${url}</id>
    <published>${isoTime}</published>
    <updated>${isoTime}</updated>
    <summary>Magnitude ${mag} earthquake at ${depth}km depth near ${escapeXml(place)}. Real-time intensity analysis and infrastructure impact assessment.</summary>
    <category term="earthquake" label="Earthquake" />
    <georss:point>${e.lat} ${e.lng}</georss:point>
  </entry>`;
  }).join('\n');

  const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:georss="http://www.georss.org/georss">
  <title>Namazue — Earthquake Intelligence Feed</title>
  <subtitle>Real-time significant earthquake events (M4.0+) with GMPE intensity modeling</subtitle>
  <link href="https://namazue.dev" rel="alternate" type="text/html" />
  <link href="https://namazue.dev/feed.atom" rel="self" type="application/atom+xml" />
  <id>https://namazue.dev/</id>
  <updated>${updated}</updated>
  <author>
    <name>Namazue</name>
    <uri>https://namazue.dev</uri>
  </author>
  <icon>https://namazue.dev/favicon.png</icon>
  <logo>https://namazue.dev/icon-512.png</logo>
  <rights>Earthquake data: USGS, JMA. Analysis: Namazue.</rights>
  <generator uri="https://namazue.dev" version="2.0">Namazue Intelligence Engine</generator>
${entries}
</feed>`;

  return new Response(atom, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
      'X-Robots-Tag': 'index, follow',
    },
  });
});

// ── IndexNow (Bing/Yandex Instant Indexing) ──────────────────

seoRoute.get('/indexnow', (_c) => {
  // Key verification endpoint — Bing/Yandex fetch this to confirm ownership
  return new Response(INDEXNOW_KEY, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
});

/**
 * Submit URLs to IndexNow for instant indexing by Bing, Yandex, Seznam, Naver.
 * Call this after ingesting new earthquake events.
 */
export async function submitToIndexNow(urls: string[]): Promise<boolean> {
  if (urls.length === 0) return true;

  try {
    const body = {
      host: 'namazue.dev',
      key: INDEXNOW_KEY,
      keyLocation: `https://namazue.dev/${INDEXNOW_KEY}.txt`,
      urlList: urls.slice(0, 10_000), // IndexNow max 10K per batch
    };

    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });

    // 200 = submitted, 202 = accepted for later processing
    return res.status === 200 || res.status === 202;
  } catch (err) {
    console.error('[indexnow] submission failed:', err);
    return false;
  }
}

// ── Dynamic OG for Event Pages ───────────────────────────────

const CRAWLER_UA = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|discordbot|telegrambot|whatsapp|kakaotalk|line\b|slackbot|pinterestbot|applebot/i;

seoRoute.get('/event/:id', async (c) => {
  const ua = c.req.header('user-agent') ?? '';

  // Only serve OG HTML to crawlers/bots. Real users get redirected to the SPA.
  if (!CRAWLER_UA.test(ua)) {
    return c.redirect(`https://namazue.dev/event/${c.req.param('id')}`, 302);
  }

  const db = createDb(c.env.DATABASE_URL);
  const eventId = c.req.param('id');

  const rows = await db
    .select({
      id: earthquakes.id,
      magnitude: earthquakes.magnitude,
      lat: earthquakes.lat,
      lng: earthquakes.lng,
      depth_km: sql<number>`${earthquakes.depth_km}`,
      time: earthquakes.time,
      place: earthquakes.place,
      tsunami: earthquakes.tsunami,
    })
    .from(earthquakes)
    .where(sql`${earthquakes.id} = ${eventId}`)
    .limit(1);

  if (rows.length === 0) {
    return c.redirect('https://namazue.dev/', 302);
  }

  const ev = rows[0];
  const mag = Number(ev.magnitude).toFixed(1);
  const depth = Math.round(Number(ev.depth_km));
  const place = String(ev.place ?? 'Unknown Location');
  const time = new Date(ev.time).toISOString();
  const timeDisplay = new Date(ev.time).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const tsunami = ev.tsunami ? ' | Tsunami Warning' : '';
  const title = `M${mag} ${place}${tsunami} — Namazue`;
  const description = `${timeDisplay} JST — Magnitude ${mag} earthquake at ${depth}km depth near ${place}. Real-time intensity analysis and infrastructure impact assessment on Namazue.`;
  const url = `https://namazue.dev/event/${ev.id}`;

  const html = `<!DOCTYPE html>
<html lang="ja" prefix="og: https://ogp.me/ns# article: https://ogp.me/ns/article#">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <link rel="canonical" href="${url}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Namazue" />
  <meta property="og:locale" content="ja_JP" />
  <meta property="og:locale:alternate" content="en_US" />
  <meta property="og:locale:alternate" content="ko_KR" />
  <meta property="og:image" content="https://namazue.dev/namazue-hero.jpg" />
  <meta property="og:image:secure_url" content="https://namazue.dev/namazue-hero.jpg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:alt" content="M${mag} earthquake near ${escapeAttr(place)} - Namazue intelligence console" />

  <!-- Article meta (for news aggregators and social platforms) -->
  <meta property="article:published_time" content="${time}" />
  <meta property="article:modified_time" content="${time}" />
  <meta property="article:author" content="https://namazue.dev" />
  <meta property="article:section" content="Earthquake Intelligence" />
  <meta property="article:tag" content="earthquake" />
  <meta property="article:tag" content="seismic" />
  <meta property="article:tag" content="${escapeAttr(place)}" />
  <meta property="article:tag" content="magnitude ${mag}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="https://namazue.dev/namazue-hero.jpg" />
  <meta name="twitter:image:alt" content="M${mag} earthquake near ${escapeAttr(place)}" />
  <meta name="twitter:label1" content="Magnitude" />
  <meta name="twitter:data1" content="M${mag}" />
  <meta name="twitter:label2" content="Depth" />
  <meta name="twitter:data2" content="${depth} km" />

  <!-- Robots -->
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />

  <!-- Geo -->
  <meta name="geo.position" content="${ev.lat};${ev.lng}" />
  <meta name="ICBM" content="${ev.lat}, ${ev.lng}" />
  <meta name="geo.placename" content="${escapeAttr(place)}" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "headline": "M${mag} Earthquake — ${escapeJson(place)}",
        "description": "${escapeJson(description)}",
        "datePublished": "${time}",
        "dateModified": "${time}",
        "author": { "@type": "Organization", "name": "Namazue", "url": "https://namazue.dev" },
        "publisher": {
          "@type": "Organization",
          "name": "Namazue",
          "url": "https://namazue.dev",
          "logo": { "@type": "ImageObject", "url": "https://namazue.dev/icon-512.png", "width": 512, "height": 512 }
        },
        "mainEntityOfPage": { "@type": "WebPage", "@id": "${url}" },
        "image": {
          "@type": "ImageObject",
          "url": "https://namazue.dev/namazue-hero.jpg",
          "width": 1200,
          "height": 630
        },
        "keywords": "earthquake, seismic, ${escapeJson(place)}, magnitude ${mag}, depth ${depth}km",
        "articleSection": "Earthquake Intelligence",
        "inLanguage": "ja",
        "isAccessibleForFree": true,
        "speakable": {
          "@type": "SpeakableSpecification",
          "cssSelector": ["h1", ".event-summary"]
        },
        "about": {
          "@type": "Place",
          "name": "${escapeJson(place)}",
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": ${ev.lat},
            "longitude": ${ev.lng},
            "elevation": ${-depth * 1000}
          },
          "containedInPlace": {
            "@type": "Country",
            "name": "${guessCountry(place)}"
          }
        }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Namazue", "item": "https://namazue.dev/" },
          { "@type": "ListItem", "position": 2, "name": "Earthquakes", "item": "https://namazue.dev/?filter=earthquake" },
          { "@type": "ListItem", "position": 3, "name": "M${mag} ${escapeJson(place)}", "item": "${url}" }
        ]
      }
    ]
  }
  </script>

  <meta http-equiv="refresh" content="0;url=${url}" />
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="event-summary">${escapeHtml(description)}</p>
  <ul>
    <li>Magnitude: ${mag}</li>
    <li>Depth: ${depth} km</li>
    <li>Location: ${escapeHtml(place)}</li>
    <li>Coordinates: ${ev.lat}, ${ev.lng}</li>
    <li>Time: ${timeDisplay} JST</li>
    ${ev.tsunami ? '<li>Tsunami Warning: Yes</li>' : ''}
  </ul>
  <p><a href="${url}">View full analysis on Namazue &rarr;</a></p>
  <p><a href="https://namazue.dev/">Back to Namazue Console</a></p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'X-Robots-Tag': 'index, follow, max-image-preview:large',
    },
  });
});

// ── Helpers ──────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function escapeJson(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** Best-effort country extraction from USGS/JMA place strings. */
function guessCountry(place: string): string {
  const lower = place.toLowerCase();
  if (lower.includes('japan') || /^.{1,6}(県|市|町|村|沖|付近|地方)/.test(place)) return 'Japan';
  // Common USGS patterns: "123km SSW of SomeCity, CountryName"
  const commaMatch = place.match(/,\s*([^,]+)$/);
  if (commaMatch) return commaMatch[1].trim();
  return 'Unknown';
}
