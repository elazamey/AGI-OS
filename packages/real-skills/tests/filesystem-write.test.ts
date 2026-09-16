import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import { FileSystemWriteSkill } from '../src/filesystem/write.js';

describe('FileSystemWriteSkill', () => {
  const skill = new FileSystemWriteSkill();
  const testFile = '.agi-os-test/write-test/write-test.txt';

  afterAll(async () => {
    await fs.rm('.agi-os-test/write-test', { recursive: true, force: true });
  });

  it('should write file', async () => {
    const result = await skill.execute({ path: testFile, content: 'test data' }, {} as any);
    expect(result.bytesWritten).toBe(9);
    expect(result.path).toBe(testFile);

    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).toBe('test data');
  });

  it('should create parent directories', async () => {
    const nestedFile = '.agi-os-test/write-test/nested/deep/file.txt';
    await skill.execute({ path: nestedFile, content: 'nested' }, {} as any);
    const content = await fs.readFile(nestedFile, 'utf-8');
    expect(content).toBe('nested');
  });
});
