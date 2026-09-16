// ============================================================================
// AGI OS - File-Backed Memory Store
// Persistent implementation of MemoryStore using filesystem
// ============================================================================

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { MemoryRecord, MemoryStore, MemoryFilter, MemoryType } from './types.js';

// ---------------------------------------------------------------------------
// Index entry — minimal metadata for fast filtering without loading full records
// ---------------------------------------------------------------------------
interface IndexEntry {
  id: string;
  type: MemoryType;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

interface IndexFile {
  version: 1;
  entries: Record<string, IndexEntry>;
}

// ---------------------------------------------------------------------------
// File-Backed Memory Store
// ---------------------------------------------------------------------------
export class FileMemoryStore implements MemoryStore {
  private basePath: string;
  private index: IndexFile;
  private indexLoaded = false;

  constructor(basePath: string) {
    this.basePath = path.join(basePath, 'memory');
    this.index = { version: 1, entries: {} };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private recordFilePath(type: MemoryType, id: string): string {
    return path.join(this.basePath, type, `${id}.json`);
  }

  private indexPath(): string {
    return path.join(this.basePath, '_index.json');
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  private async loadIndex(): Promise<void> {
    if (this.indexLoaded) return;
    await this.ensureDir();
    try {
      const raw = await fs.readFile(this.indexPath(), 'utf-8');
      this.index = JSON.parse(raw) as IndexFile;
    } catch {
      this.index = { version: 1, entries: {} };
    }
    this.indexLoaded = true;
  }

  private async saveIndex(): Promise<void> {
    await this.ensureDir();
    await fs.writeFile(this.indexPath(), JSON.stringify(this.index, null, 2), 'utf-8');
  }

  private async loadRecord(id: string): Promise<MemoryRecord | null> {
    const entry = this.index.entries[id];
    if (!entry) return null;
    const filePath = this.recordFilePath(entry.type, id);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as MemoryRecord;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // MemoryStore interface
  // -------------------------------------------------------------------------

  async save(record: MemoryRecord): Promise<void> {
    await this.loadIndex();
    await this.ensureDir();

    const typeDir = path.join(this.basePath, record.type);
    await fs.mkdir(typeDir, { recursive: true });

    const filePath = this.recordFilePath(record.type, record.id);
    await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');

    this.index.entries[record.id] = {
      id: record.id,
      type: record.type,
      confidence: record.confidence,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    await this.saveIndex();
  }

  async get(id: string): Promise<MemoryRecord | null> {
    await this.loadIndex();
    return this.loadRecord(id);
  }

  async list(filter?: MemoryFilter): Promise<MemoryRecord[]> {
    await this.loadIndex();

    let candidates = Object.values(this.index.entries);

    if (filter) {
      if (filter.type) {
        candidates = candidates.filter((e) => e.type === filter.type);
      }
      if (filter.minConfidence !== undefined) {
        candidates = candidates.filter((e) => e.confidence >= filter.minConfidence!);
      }
      if (filter.maxConfidence !== undefined) {
        candidates = candidates.filter((e) => e.confidence <= filter.maxConfidence!);
      }
      if (filter.createdAfter) {
        candidates = candidates.filter((e) => e.createdAt >= filter.createdAfter!);
      }
      if (filter.createdBefore) {
        candidates = candidates.filter((e) => e.createdAt <= filter.createdBefore!);
      }
    }

    candidates.sort((a, b) => b.confidence - a.confidence);

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? candidates.length;
    const sliced = candidates.slice(offset, offset + limit);

    const records: MemoryRecord[] = [];
    for (const entry of sliced) {
      const record = await this.loadRecord(entry.id);
      if (record) records.push(record);
    }
    return records;
  }

  async delete(id: string): Promise<boolean> {
    await this.loadIndex();
    const entry = this.index.entries[id];
    if (!entry) return false;

    const filePath = this.recordFilePath(entry.type, id);
    try {
      await fs.unlink(filePath);
    } catch {
      // File may not exist
    }

    delete this.index.entries[id];
    await this.saveIndex();
    return true;
  }

  async clear(): Promise<void> {
    await this.loadIndex();
    await fs.rm(this.basePath, { recursive: true, force: true });
    this.index = { version: 1, entries: {} };
    await this.ensureDir();
    await this.saveIndex();
  }

  async count(filter?: MemoryFilter): Promise<number> {
    await this.loadIndex();

    if (!filter || Object.keys(filter).length === 0) {
      return Object.keys(this.index.entries).length;
    }

    let candidates = Object.values(this.index.entries);

    if (filter.type) {
      candidates = candidates.filter((e) => e.type === filter.type);
    }
    if (filter.minConfidence !== undefined) {
      candidates = candidates.filter((e) => e.confidence >= filter.minConfidence!);
    }
    if (filter.maxConfidence !== undefined) {
      candidates = candidates.filter((e) => e.confidence <= filter.maxConfidence!);
    }
    if (filter.createdAfter) {
      candidates = candidates.filter((e) => e.createdAt >= filter.createdAfter!);
    }
    if (filter.createdBefore) {
      candidates = candidates.filter((e) => e.createdAt <= filter.createdBefore!);
    }

    return candidates.length;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createFileMemoryStore(basePath: string): MemoryStore {
  return new FileMemoryStore(basePath);
}
