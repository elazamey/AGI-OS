import { describe, it, expect, beforeEach } from 'vitest';
import { FileManager } from '../src/file-manager.js';

describe('FileManager', () => {
  let fm: FileManager;
  beforeEach(() => { fm = new FileManager(); });

  it('writes and reads file', () => {
    fm.writeFile('/test.txt', 'hello');
    const result = fm.readFile('/test.txt');
    expect(result.success).toBe(true);
    expect(result.content).toBe('hello');
  });

  it('fails reading nonexistent', () => {
    const result = fm.readFile('/nope.txt');
    expect(result.success).toBe(false);
  });

  it('deletes file', () => {
    fm.writeFile('/test.txt', 'content');
    expect(fm.deleteFile('/test.txt').success).toBe(true);
    expect(fm.fileExists('/test.txt')).toBe(false);
  });

  it('lists directory', () => {
    fm.writeFile('/dir/a.txt', 'a');
    fm.writeFile('/dir/b.txt', 'b');
    const entries = fm.listDirectory('/dir');
    expect(entries.length).toBe(2);
  });

  it('copies file', () => {
    fm.writeFile('/a.txt', 'content');
    expect(fm.copyFile('/a.txt', '/b.txt').success).toBe(true);
    expect(fm.readFile('/b.txt').content).toBe('content');
  });

  it('moves file', () => {
    fm.writeFile('/a.txt', 'content');
    fm.moveFile('/a.txt', '/b.txt');
    expect(fm.fileExists('/a.txt')).toBe(false);
    expect(fm.fileExists('/b.txt')).toBe(true);
  });

  it('gets stats', () => {
    fm.writeFile('/a.txt', 'hello');
    fm.writeFile('/b.txt', 'world!');
    const stats = fm.getStats();
    expect(stats.totalFiles).toBe(2);
  });
});
