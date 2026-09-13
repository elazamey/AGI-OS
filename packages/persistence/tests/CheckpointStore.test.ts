import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import { FileBackend } from '../src/FileBackend.js';
import { CheckpointStore } from '../src/CheckpointStore.js';
import type { Checkpoint } from '../src/types.js';

describe('CheckpointStore', () => {
  const testDir = '.agi-os-test/checkpointstore';
  const backend = new FileBackend(testDir);
  const store = new CheckpointStore(backend, 'checkpoints');

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should save and load checkpoint', async () => {
    const checkpoint: Checkpoint = {
      missionId: 'm1',
      revision: 3,
      state: { status: 'running', step: 7 },
      taskResults: { t1: { success: true } },
      evidence: [{ id: 'e1', operation: 'test' }],
      timestamp: new Date().toISOString(),
    };

    await store.save(checkpoint);
    const loaded = await store.load('m1');
    expect(loaded).toEqual(checkpoint);
  });

  it('should return null for nonexistent checkpoint', async () => {
    const loaded = await store.load('nonexistent');
    expect(loaded).toBeNull();
  });

  it('should overwrite checkpoint on save', async () => {
    const cp1: Checkpoint = { missionId: 'm2', revision: 1, state: {}, taskResults: {}, evidence: [], timestamp: '' };
    const cp2: Checkpoint = { missionId: 'm2', revision: 5, state: { step: 10 }, taskResults: {}, evidence: [], timestamp: '' };

    await store.save(cp1);
    await store.save(cp2);
    const loaded = await store.load('m2');
    expect(loaded?.revision).toBe(5);
  });
});
