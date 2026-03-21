import test from 'node:test';
import assert from 'node:assert/strict';

import { advanceCheckpointAfterSuccess } from '../src/lib/checkpoint.ts';
import { pollJma } from '../src/routes/cron.ts';

test('advanceCheckpointAfterSuccess skips unchanged checkpoints', async () => {
  let performed = false;
  let persisted = false;

  const committed = await advanceCheckpointAfterSuccess({
    currentCheckpoint: 'fp-1',
    nextCheckpoint: 'fp-1',
    performWork: async () => {
      performed = true;
      return true;
    },
    persistCheckpoint: async () => {
      persisted = true;
    },
  });

  assert.equal(committed, 'unchanged');
  assert.equal(performed, false);
  assert.equal(persisted, false);
});

test('advanceCheckpointAfterSuccess holds the checkpoint when work reports failure', async () => {
  let published = false;
  let checkpointWritten = false;

  const committed = await advanceCheckpointAfterSuccess({
    currentCheckpoint: 'fp-0',
    nextCheckpoint: 'fp-1',
    performWork: async () => {
      published = true;
      return false;
    },
    persistCheckpoint: async () => {
      checkpointWritten = true;
    },
  });

  assert.equal(committed, 'held');
  assert.equal(published, true);
  assert.equal(checkpointWritten, false);
});

test('advanceCheckpointAfterSuccess writes the checkpoint only after publish succeeds', async () => {
  const steps: string[] = [];

  const committed = await advanceCheckpointAfterSuccess({
    currentCheckpoint: 'fp-1',
    nextCheckpoint: 'fp-2',
    performWork: async () => {
      steps.push('publish');
      return true;
    },
    persistCheckpoint: async (value) => {
      steps.push(`put:${value}`);
    },
  });

  assert.equal(committed, 'advanced');
  assert.deepEqual(steps, ['publish', 'put:fp-2']);
});

test('advanceCheckpointAfterSuccess surfaces checkpoint persistence failures', async () => {
  await assert.rejects(
    advanceCheckpointAfterSuccess({
      currentCheckpoint: 'fp-1',
      nextCheckpoint: 'fp-2',
      performWork: async () => true,
      persistCheckpoint: async () => {
        throw new Error('bucket write failed');
      },
    }),
    /bucket write failed/,
  );
});

test('advanceCheckpointAfterSuccess does not write the checkpoint when work fails', async () => {
  let checkpointWritten = false;

  await assert.rejects(
    () => advanceCheckpointAfterSuccess({
      currentCheckpoint: 'fp-2',
      nextCheckpoint: 'fp-3',
      performWork: async () => {
        throw new Error('publish failed');
      },
      persistCheckpoint: async () => {
        checkpointWritten = true;
      },
    }),
    /publish failed/,
  );

  assert.equal(checkpointWritten, false);
});

test('pollJma reports persisted false when the durable upsert fails', async () => {
  const db = {
    select() {
      return {
        from() {
          return {
            where: async () => [],
          };
        },
      };
    },
    insert() {
      return {
        values() {
          return {
            onConflictDoUpdate: async () => {
              throw new Error('write failed');
            },
          };
        },
      };
    },
  };

  const result = await pollJma(
    {} as never,
    db as never,
    [{
      id: 'jma-test-1',
      lat: 35.68,
      lng: 139.76,
      depth_km: 10,
      magnitude: 3.9,
      time: '2026-03-09T00:00:00.000Z',
      place: 'Tokyo',
      place_ja: '東京',
      source: 'jma',
      mag_type: 'Mj',
      maxi: 3,
    }],
  );

  assert.equal(result.persisted, false);
  assert.equal(result.ingested, 0);
  assert.equal(result.analyzed, 0);
  assert.equal(result.revised, 0);
});
