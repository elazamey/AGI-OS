import { generateId, now } from '@agi-os/kernel';
import type { FileEntry } from './types.js';

export class FileManager {
  private files: Map<string, { content: string; modified: string }> = new Map();

  writeFile(path: string, content: string): { success: boolean; path: string } {
    this.files.set(path, { content, modified: now().toISOString() });
    return { success: true, path };
  }

  readFile(path: string): { success: boolean; content?: string; error?: string } {
    const file = this.files.get(path);
    if (file) return { success: true, content: file.content };
    return { success: false, error: `File not found: ${path}` };
  }

  deleteFile(path: string): { success: boolean } {
    return { success: this.files.delete(path) };
  }

  listDirectory(dirPath: string): FileEntry[] {
    const entries: FileEntry[] = [];
    for (const [path, file] of this.files) {
      if (path.startsWith(dirPath)) {
        const relative = path.slice(dirPath.length).replace(/^\//, '');
        if (!relative.includes('/')) {
          entries.push({
            name: relative || path.split('/').pop() || path,
            path,
            type: 'file',
            size: file.content.length,
            modified: file.modified,
          });
        }
      }
    }
    return entries;
  }

  fileExists(path: string): boolean {
    return this.files.has(path);
  }

  copyFile(src: string, dest: string): { success: boolean } {
    const file = this.files.get(src);
    if (!file) return { success: false };
    this.files.set(dest, { ...file, modified: now().toISOString() });
    return { success: true };
  }

  moveFile(src: string, dest: string): { success: boolean } {
    const result = this.copyFile(src, dest);
    if (result.success) this.files.delete(src);
    return result;
  }

  getFileInfo(path: string): FileEntry | undefined {
    const file = this.files.get(path);
    if (!file) return undefined;
    return {
      name: path.split('/').pop() || path,
      path,
      type: 'file',
      size: file.content.length,
      modified: file.modified,
    };
  }

  createDirectory(path: string): void {
    this.files.set(path + '/.dir', { content: '', modified: now().toISOString() });
  }

  getStats(): { totalFiles: number; totalSize: number } {
    let totalSize = 0;
    for (const file of this.files.values()) {
      totalSize += file.content.length;
    }
    return { totalFiles: this.files.size, totalSize };
  }

  clear(): void { this.files.clear(); }
}
