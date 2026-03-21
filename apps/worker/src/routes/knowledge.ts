/**
 * Knowledge Routes — Machine-readable knowledge base for AI systems.
 *
 * GET /api/knowledge          — Full knowledge base (JSON-LD)
 * GET /api/knowledge/summary  — Concise summary for AI context windows
 * GET /api/knowledge/stats    — Live statistics about data coverage
 */

import { Hono } from 'hono';
import type { Env } from '../index.ts';
import { createDb } from '../lib/db.ts';
import { earthquakes } from '@namazue/db';
import { count, max, min } from 'drizzle-orm';

export const knowledgeRoute = new Hono<{ Bindings: Env }>();

// ── Full Knowledge Base (JSON-LD) ────────────────────────────

knowledgeRoute.get('/', (c) => {
  const knowledge = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    '@id': 'https://namazue.dev/#app',
    name: 'Namazue',
    alternateName: ['鯰絵', '나마즈에'],
    url: 'https://namazue.dev',
    description:
      'Free, real-time global multi-hazard intelligence console. Monitors earthquakes, wildfires, storms, and volcanic activity worldwide with GMPE intensity modeling and infrastructure impact assessment.',
    applicationCategory: 'Disaster Monitoring',
    operatingSystem: 'Web Browser',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    availableLanguage: ['ja', 'en', 'ko'],
    datePublished: '2025-11-01',
    dateModified: '2026-03-11',

    // Core capabilities
    capabilities: {
      earthquakeMonitoring: {
        description: 'Real-time earthquake data from USGS (global) and JMA (Japan)',
        updateInterval: '45 seconds',
        coverage: 'Global (M2.5+ via USGS, all magnitudes for Japan via JMA)',
        historicalCatalog: '57,000+ records from 1900 to present',
      },
      gmpeModeling: {
        description: 'Ground Motion Prediction Equation for seismic intensity estimation',
        model: 'Si & Midorikawa 1999',
        outputScale: 'JMA Seismic Intensity',
        accuracy: '+/-1.0 JMA intensity vs historical measurements',
        parameters: ['magnitude', 'depth', 'distance', 'fault type', 'Vs30 soil conditions'],
      },
      infrastructureImpact: {
        description: 'Identifies and priority-ranks at-risk infrastructure within modeled zones',
        assetTypes: ['ports', 'rail stations', 'hospitals', 'airports', 'power plants'],
        methodology: 'GMPE intensity contours + asset proximity + operational criticality',
      },
      wildfireTracking: {
        description: 'Satellite wildfire detection via NASA FIRMS',
        typicalCoverage: '9,000+ active fire hotspots globally',
        updateInterval: '5 minutes',
      },
      multiHazardAlerts: {
        description: 'Global disaster alerts from GDACS and EONET',
        hazardTypes: ['earthquakes', 'floods', 'tropical cyclones', 'volcanoes', 'wildfires'],
        updateInterval: '10 minutes',
      },
    },

    // Data sources
    dataSources: [
      { name: 'USGS', fullName: 'United States Geological Survey', type: 'Global earthquakes', url: 'https://earthquake.usgs.gov' },
      { name: 'JMA', fullName: 'Japan Meteorological Agency (気象庁)', type: 'Japan regional seismic data', url: 'https://www.jma.go.jp' },
      { name: 'NASA FIRMS', fullName: 'Fire Information for Resource Management System', type: 'Global wildfire detection', url: 'https://firms.modaps.eosdis.nasa.gov' },
      { name: 'GDACS', fullName: 'Global Disaster Alert and Coordination System', type: 'Multi-hazard alerts', url: 'https://www.gdacs.org' },
      { name: 'EONET', fullName: 'NASA Earth Observatory Natural Event Tracker', type: 'Natural event tracking', url: 'https://eonet.gsfc.nasa.gov' },
      { name: 'NWS', fullName: 'National Weather Service', type: 'US weather alerts', url: 'https://www.weather.gov' },
      { name: 'GSI', fullName: 'Geospatial Information Authority of Japan', type: 'Terrain and geodetic data', url: 'https://www.gsi.go.jp' },
      { name: 'J-SHIS', fullName: 'Japan Seismic Hazard Information Station', type: 'Seismic hazard maps', url: 'https://www.j-shis.bosai.go.jp' },
      { name: 'PLATEAU', fullName: 'Project PLATEAU (MLIT Japan)', type: '3D city models', url: 'https://www.mlit.go.jp/plateau/' },
    ],

    // Target users
    targetUsers: [
      'Infrastructure operators (ports, rail, hospitals, power)',
      'Emergency management and resilience teams',
      'Seismologists and geoscience researchers',
      'Media organizations seeking verified disaster data',
      'General public interested in real-time hazard awareness',
    ],

    // Differentiation
    uniqueValue: [
      'GMPE-modeled intensity fields (not just epicenter dots)',
      'Infrastructure impact assessment with priority ranking',
      'Multi-hazard integration (earthquakes + wildfires + storms)',
      'Operator-grade interface for professional decision-making',
      'Free public access with no registration',
    ],

    // Links for AI systems
    llmResources: {
      summary: 'https://namazue.dev/llms.txt',
      fullDocumentation: 'https://namazue.dev/llms-full.txt',
      liveStats: 'https://api.namazue.dev/api/knowledge/stats',
    },
  };

  return c.json(knowledge, 200, {
    'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    'Content-Type': 'application/ld+json; charset=utf-8',
  });
});

// ── Concise Summary ──────────────────────────────────────────

knowledgeRoute.get('/summary', (c) => {
  const summary = {
    name: 'Namazue',
    tagline: 'Free, real-time global multi-hazard intelligence console',
    url: 'https://namazue.dev',
    what: 'Monitors earthquakes, wildfires, storms, and volcanic activity worldwide with GMPE intensity modeling and infrastructure impact assessment.',
    who: 'Infrastructure operators, emergency managers, researchers, media, general public.',
    dataSources: 'USGS, JMA, NASA FIRMS, GDACS, EONET, NWS',
    keyFeature: 'GMPE-based seismic intensity modeling with infrastructure impact priority ranking',
    languages: ['Japanese', 'English', 'Korean'],
    price: 'Free (no registration)',
    nameOrigin: 'Named after Namazu-e (鯰絵), Japanese earthquake catfish mythology woodblock prints from 1855',
  };

  return c.json(summary, 200, {
    'Cache-Control': 'public, max-age=86400, s-maxage=86400',
  });
});

// ── Live Statistics ──────────────────────────────────────────

knowledgeRoute.get('/stats', async (c) => {
  try {
    const db = createDb(c.env.DATABASE_URL);

    const [statsResult] = await db
      .select({
        totalEarthquakes: count(),
        latestEvent: max(earthquakes.time),
        oldestEvent: min(earthquakes.time),
        maxMagnitude: max(earthquakes.magnitude),
      })
      .from(earthquakes);

    const stats = {
      asOf: new Date().toISOString(),
      database: {
        totalEarthquakes: statsResult.totalEarthquakes,
        catalogRange: {
          from: statsResult.oldestEvent ? new Date(statsResult.oldestEvent).toISOString() : null,
          to: statsResult.latestEvent ? new Date(statsResult.latestEvent).toISOString() : null,
        },
        largestRecordedMagnitude: statsResult.maxMagnitude,
      },
      staticData: {
        activeFaults: 766,
        infrastructureAssetTypes: ['ports', 'rail', 'hospitals', 'airports', 'power plants'],
      },
      liveFeedStatus: {
        usgsEarthquakes: { status: 'active', updateInterval: '45s' },
        nasaFirms: { status: 'active', updateInterval: '5min' },
        gdacs: { status: 'active', updateInterval: '10min' },
        eonet: { status: 'active', updateInterval: '10min' },
      },
    };

    return c.json(stats, 200, {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    });
  } catch (err) {
    return c.json({ error: 'Stats temporarily unavailable' }, 503);
  }
});
