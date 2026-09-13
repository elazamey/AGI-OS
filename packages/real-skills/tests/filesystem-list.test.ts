import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import { FileSystemListSkill } from '../src/filesystem/list.js';

describe('FileSystemListSkill', () => {
  const skill = new FileSystemListSkill();
  const testDir = '.agi-os-test/list-test';

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(`${testDir}/file1.txt`, 'a', 'utf-8');
    await fs.writeFile(`${testDir}/file2.txt`, 'bb', 'utf-8');
    await fs.mkdir(`${testDir}/subdir`, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm('.agi-os-test', { recursive: true, force: true });
  });

  it('should list directory entries', async () => {
    const result = await skill.execute({ path: testDir }, {} as any);
    expect(result.entries.length).toBe(3);
    expect(result.entries.map(e => e.name)).toContain('file1.txt');
    expect(result.entries.map(e => e.name)).toContain('subdir');
  });

  it('should include file sizes', async () => {
    const result = await skill.execute({ path: testDir }, {} as any);
    const file1 = result.entries.find(e => e.name === 'file1.txt');
    expect(file1?.size).toBe(1);
  });
});
