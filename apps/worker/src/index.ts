import { Hono } from 'hono';
import { eventsRoute } from './routes/events.ts';
import { searchRoute } from './routes/search.ts';
import { reportsRoute } from './routes/reports.ts';
import { chatRoute } from './routes/chat.ts';
import { maritimeRoute } from './routes/maritime.ts';
import { railRoute } from './routes/rail.ts';
import { referenceRoute } from './routes/reference.ts';
import { runtimeRoute } from './routes/runtime.ts';
import { healthRoute } from './routes/health.ts';
import { seoRoute } from './routes/seo.ts';
import { knowledgeRoute } from './routes/knowledge.ts';
import { handleCron } from './routes/cron.ts';
export { MaritimeHub } from './durableObjects/maritimeHub.ts';
export { ProjectionProjector } from './durableObjects/projectionProjector.ts';
export { SeismicSentinel } from './durableObjects/seismicSentinel.ts';

export interface Env {
  DATABASE_URL: string;
  XAI_API_KEY: string;
  RATE_LIMIT: KVNamespace;
  MARITIME_HUB: DurableObjectNamespace;
  PROJECTION_PROJECTOR: DurableObjectNamespace;
  SEISMIC_SENTINEL: DurableObjectNamespace;
  FEED_BUCKET: R2Bucket;
  ALLOWED_ORIGINS?: string;
  INTERNAL_API_TOKEN?: string;
  AISSTREAM_API_KEY?: string;
  AIS_SNAPSHOT_TTL_MS?: number;
  AISSTREAM_COLLECTION_WINDOW_MS?: number;
  ODPT_CONSUMER_KEY?: string;
  REFERENCE_DATA_BASE_URL?: string;
}

const app = new Hono<{ Bindings: Env }>();

const ALLOW_METHODS = 'GET, POST, OPTIONS';
const ALLOW_HEADERS = 'Content-Type';
const MAX_AGE = '86400';

// Security headers — applied to all API responses.
app.use('/api/*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
});

// Request body size guard — reject payloads >512KB.
const MAX_BODY_BYTES = 512 * 1024;
app.use('/api/*', async (c, next) => {
  if (c.req.method === 'POST' || c.req.method === 'PUT' || c.req.method === 'PATCH') {
    const contentLength = c.req.header('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return c.json({ error: 'Request body too large' }, 413);
    }
  }
  await next();
});

// CORS — explicit origin allow-list from env.ALLOWED_ORIGINS (comma-separated).
// IMPORTANT: ALLOWED_ORIGINS must be set in production. If unset, no CORS headers
// are sent (browser same-origin requests still work, cross-origin are blocked).
app.use('/api/*', async (c, next) => {
  const requestOrigin = c.req.header('origin');
  const allowedOrigins = parseAllowedOrigins(c.env.ALLOWED_ORIGINS);

  // If ALLOWED_ORIGINS is not configured, do not send any CORS headers.
  // This is the safe default — cross-origin requests will be blocked by browsers.
  if (allowedOrigins.size === 0) {
    if (c.req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }
    await next();
    return;
  }

  const isAllowedOrigin = requestOrigin
    ? allowedOrigins.has(requestOrigin)
    : false;

  if (c.req.method === 'OPTIONS') {
    if (requestOrigin && !isAllowedOrigin) {
      return c.json({ error: 'Origin not allowed' }, 403);
    }

    const res = new Response(null, { status: 204 });
    if (requestOrigin && isAllowedOrigin) {
      res.headers.set('Access-Control-Allow-Origin', requestOrigin);
      res.headers.set('Vary', 'Origin');
    }
    res.headers.set('Access-Control-Allow-Methods', ALLOW_METHODS);
    res.headers.set('Access-Control-Allow-Headers', ALLOW_HEADERS);
    res.headers.set('Access-Control-Max-Age', MAX_AGE);
    return res;
  }

  await next();

  if (requestOrigin && isAllowedOrigin) {
    c.header('Access-Control-Allow-Origin', requestOrigin);
    c.header('Vary', 'Origin');
    c.header('Access-Control-Allow-Methods', ALLOW_METHODS);
    c.header('Access-Control-Allow-Headers', ALLOW_HEADERS);
    c.header('Access-Control-Max-Age', MAX_AGE);
  }
});

app.onError((err, c) => {
  console.error('[worker] unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Health check
app.route('/api/health', healthRoute);

// Routes
app.route('/api/events', eventsRoute);
app.route('/api/search', searchRoute);
app.route('/api/reports', reportsRoute);
app.route('/api/chat', chatRoute);
app.route('/api/maritime', maritimeRoute);
app.route('/api/rail', railRoute);
app.route('/api/reference', referenceRoute);
app.route('/api/runtime', runtimeRoute);
app.route('/api/knowledge', knowledgeRoute);

// SEO routes (no /api prefix — served at root for crawlers)
app.route('/', seoRoute);

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(handleCron(event, env));
  },
};

function parseAllowedOrigins(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );
}
