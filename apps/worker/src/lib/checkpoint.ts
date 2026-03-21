export type CheckpointAdvanceResult = 'unchanged' | 'held' | 'advanced';

interface AdvanceCheckpointAfterSuccessOptions {
  currentCheckpoint: string | null;
  nextCheckpoint: string | null;
  performWork: () => Promise<boolean>;
  persistCheckpoint: (nextCheckpoint: string) => Promise<void>;
}

/**
 * Advance a source checkpoint only after the caller confirms durable work
 * completed successfully. Any failed work leaves the prior checkpoint intact
 * so the next poll retries the same source state.
 */
export async function advanceCheckpointAfterSuccess(
  options: AdvanceCheckpointAfterSuccessOptions,
): Promise<CheckpointAdvanceResult> {
  if (!options.nextCheckpoint || options.currentCheckpoint === options.nextCheckpoint) {
    return 'unchanged';
  }

  const committed = await options.performWork();
  if (!committed) {
    return 'held';
  }

  await options.persistCheckpoint(options.nextCheckpoint);
  return 'advanced';
}

export async function readTextCheckpoint(
  bucket: R2Bucket | undefined,
  key: string,
): Promise<string | null> {
  if (!bucket) {
    return null;
  }

  try {
    const checkpoint = await bucket.get(key);
    return checkpoint ? await checkpoint.text() : null;
  } catch {
    return null;
  }
}
