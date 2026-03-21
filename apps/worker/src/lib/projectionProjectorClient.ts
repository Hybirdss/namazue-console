import type { Env } from '../index.ts';
import type { ProjectionBuildInput } from './projectionContracts.ts';

const PROJECTOR_NAME = 'operator-projection-projector';
const PROJECTOR_URL = 'https://projection-projector/publish';

interface PublishProjectionViaProjectorInput {
  now?: number;
  updates: ProjectionBuildInput['updates'];
}

export async function publishProjectionViaProjector(
  env: Pick<Env, 'PROJECTION_PROJECTOR'>,
  input: PublishProjectionViaProjectorInput,
): Promise<void> {
  const id = env.PROJECTION_PROJECTOR.idFromName(PROJECTOR_NAME);
  const response = await env.PROJECTION_PROJECTOR.get(id).fetch(PROJECTOR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      now: input.now ?? Date.now(),
      updates: input.updates,
    }),
  });

  if (!response.ok) {
    throw new Error(`Projection projector returned ${response.status}`);
  }
}
