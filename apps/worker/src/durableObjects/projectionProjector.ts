import type { Env } from '../index.ts';
import { publishProjectionUpdate } from '../lib/feedPublisher.ts';
import type { ProjectionBuildInput } from '../lib/projectionContracts.ts';

interface PublishProjectionRequestBody {
  now?: number;
  updates?: ProjectionBuildInput['updates'];
}

export class ProjectionProjector {
  constructor(
    private readonly _state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/ping') {
      return Response.json({ status: 'ok' });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body: PublishProjectionRequestBody;
    try {
      body = await request.json() as PublishProjectionRequestBody;
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    try {
      const projection = await publishProjectionUpdate({
        bucket: this.env.FEED_BUCKET,
        now: body.now ?? Date.now(),
        updates: body.updates ?? {},
        referenceDataBaseUrl: this.env.REFERENCE_DATA_BASE_URL,
      });

      return Response.json({
        version: projection.version,
        generated_at: projection.generated_at,
      });
    } catch (err) {
      console.error('[ProjectionProjector] publish failed:', err);
      return Response.json({ error: 'Projection publish failed' }, { status: 500 });
    }
  }
}
