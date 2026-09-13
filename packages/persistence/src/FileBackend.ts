import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export class FileBackend {
  constructor(private basePath: string) {}

  async ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(path.join(this.basePath, dirPath), { recursive: true });
  }

  async writeFile(filePath: string, data: unknown): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async readFile<T>(filePath: string): Promise<T | null> {
    try {
      const fullPath = path.join(this.basePath, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  async appendLine(filePath: string, line: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.appendFile(fullPath, line + '\n', 'utf-8');
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.basePath, filePath);
      await fs.unlink(fullPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.basePath, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
