import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import { FileSystemReadSkill } from '../src/filesystem/read.js';

describe('FileSystemReadSkill', () => {
  const skill = new FileSystemReadSkill();
  const testFile = '.agi-os-test/read-test.txt';
  const testContent = 'Hello, AGI-OS!';

  beforeAll(async () => {
    await fs.mkdir('.agi-os-test', { recursive: true });
    await fs.writeFile(testFile, testContent, 'utf-8');
  });

  afterAll(async () => {
    await fs.rm('.agi-os-test', { recursive: true, force: true });
  });

  it('should read file content', async () => {
    const result = await skill.execute({ path: testFile }, {} as any);
    expect(result.content).toBe(testContent);
    expect(result.size).toBeGreaterThan(0);
    expect(result.lastModified).toBeDefined();
  });

  it('should throw on nonexistent file', async () => {
    await expect(
      skill.execute({ path: '.agi-os-test/nonexistent.txt' }, {} as any)
    ).rejects.toThrow();
  });
});
