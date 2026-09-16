import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import { FileBackend } from '../src/FileBackend.js';
import { MissionStore } from '../src/MissionStore.js';

describe('MissionStore', () => {
  const testDir = '.agi-os-test/missionstore';
  const backend = new FileBackend(testDir);
  const store = new MissionStore(backend, 'missions');

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should save and load mission', async () => {
    const mission = { id: 'm1', goal: 'Test mission', state: 'created' };
    await store.save('m1', mission);
    const loaded = await store.load<typeof mission>('m1');
    expect(loaded).toEqual(mission);
  });

  it('should return null for nonexistent mission', async () => {
    const loaded = await store.load('nonexistent');
    expect(loaded).toBeNull();
  });

  it('should check mission existence', async () => {
    await store.save('m2', { id: 'm2', goal: 'Exist test' });
    expect(await store.exists('m2')).toBe(true);
    expect(await store.exists('m3')).toBe(false);
  });

  it('should delete mission', async () => {
    await store.save('m4', { id: 'm4', goal: 'Delete me' });
    await store.delete('m4');
    expect(await store.exists('m4')).toBe(false);
  });
});
