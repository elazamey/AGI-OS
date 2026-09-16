import { describe, it, expect, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FileBackend } from '../src/FileBackend.js';

describe('FileBackend', () => {
  const testDir = '.agi-os-test/filebackend';
  const backend = new FileBackend(testDir);

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should write and read file', async () => {
    await backend.writeFile('test.json', { hello: 'world' });
    const result = await backend.readFile<{ hello: string }>('test.json');
    expect(result).toEqual({ hello: 'world' });
  });

  it('should return null for nonexistent file', async () => {
    const result = await backend.readFile('nonexistent.json');
    expect(result).toBeNull();
  });

  it('should check file existence', async () => {
    await backend.writeFile('exists.json', { data: 1 });
    expect(await backend.exists('exists.json')).toBe(true);
    expect(await backend.exists('nope.json')).toBe(false);
  });

  it('should delete file', async () => {
    await backend.writeFile('delete-me.json', { data: 1 });
    expect(await backend.exists('delete-me.json')).toBe(true);
    await backend.deleteFile('delete-me.json');
    expect(await backend.exists('delete-me.json')).toBe(false);
  });

  it('should append lines', async () => {
    await backend.appendLine('logs.jsonl', '{"event":"start"}');
    await backend.appendLine('logs.jsonl', '{"event":"end"}');
    const fullPath = path.join(testDir, 'logs.jsonl');
    const content = await fs.readFile(fullPath, 'utf-8');
    expect(content).toContain('start');
    expect(content).toContain('end');
  });
});
