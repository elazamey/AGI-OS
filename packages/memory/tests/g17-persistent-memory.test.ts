// ============================================================================
// G17 — Persistent Memory Gate
//
// PASS only if:
//   ✓ write succeeds
//   ✓ process terminates (new store instance)
//   ✓ process restarts (new store instance)
//   ✓ memory is recovered
//   ✓ recovered data matches
//   ✓ no in-memory fallback
//   ✓ evidence records persistence + recovery
//   ✓ corruption/error path is tested
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileMemoryStore, createFileMemoryStore } from '../src/file-memory-store.js';
import type { MemoryRecord, MemoryType } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tmpDir(): string {
  return path.join(os.tmpdir(), `agi-os-memory-g17-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function makeRecord(overrides: Partial<MemoryRecord> = {}): MemoryRecord {
  return {
    id: overrides.id ?? `rec-${Date.now()}`,
    type: overrides.type ?? 'semantic',
    content: overrides.content ?? {
      kind: 'semantic' as const,
      category: 'fact' as const,
      subject: 'AGI-OS',
      predicate: 'has capability',
      object: 'persistent memory',
      source: 'g17-test',
      strength: 0.9,
    },
    sourceEventIds: overrides.sourceEventIds ?? ['evt-1'],
    evidenceRefs: overrides.evidenceRefs ?? ['ev-1'],
    confidence: overrides.confidence ?? 0.85,
    accessCount: overrides.accessCount ?? 0,
    lastAccessedAt: overrides.lastAccessedAt ?? new Date().toISOString(),
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    metadata: overrides.metadata ?? { test: true },
  };
}

// ---------------------------------------------------------------------------
// G17 — Persistent Memory Gate
// ---------------------------------------------------------------------------
describe('G17 — Persistent Memory Gate', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = tmpDir();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Gate 1: Write succeeds
  // -------------------------------------------------------------------------
  it('G17-1: write succeeds to filesystem', async () => {
    const store = new FileMemoryStore(testDir);
    const record = makeRecord({ id: 'g17-write-1' });

    await store.save(record);

    const filePath = path.join(testDir, 'memory', 'semantic', 'g17-write-1.json');
    const exists = await fs.access(filePath).then(() => true, () => false);
    expect(exists).toBe(true);

    const raw = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as MemoryRecord;
    expect(parsed.id).toBe('g17-write-1');
    expect(parsed.content).toEqual(record.content);
  });

  // -------------------------------------------------------------------------
  // Gate 2: Read back from same instance
  // -------------------------------------------------------------------------
  it('G17-2: read back from same instance', async () => {
    const store = new FileMemoryStore(testDir);
    const record = makeRecord({ id: 'g17-read-1', confidence: 0.92 });

    await store.save(record);
    const retrieved = await store.get('g17-read-1');

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe('g17-read-1');
    expect(retrieved!.confidence).toBe(0.92);
    expect(retrieved!.content).toEqual(record.content);
  });

  // -------------------------------------------------------------------------
  // Gate 3: Process terminates — new instance recovers data
  // -------------------------------------------------------------------------
  it('G17-3: new FileMemoryStore instance recovers data (simulates restart)', async () => {
    // First "process" — write data
    {
      const store = new FileMemoryStore(testDir);
      await store.save(makeRecord({ id: 'restart-1', confidence: 0.77 }));
      await store.save(makeRecord({ id: 'restart-2', confidence: 0.88 }));
      await store.save(makeRecord({ id: 'restart-3', confidence: 0.99 }));
    }
    // Instance destroyed — simulates process termination

    // Second "process" — new instance, no in-memory state
    {
      const store2 = new FileMemoryStore(testDir);

      const r1 = await store2.get('restart-1');
      const r2 = await store2.get('restart-2');
      const r3 = await store2.get('restart-3');

      expect(r1).not.toBeNull();
      expect(r1!.confidence).toBe(0.77);
      expect(r2).not.toBeNull();
      expect(r2!.confidence).toBe(0.88);
      expect(r3).not.toBeNull();
      expect(r3!.confidence).toBe(0.99);
    }
  });

  // -------------------------------------------------------------------------
  // Gate 4: Recovered data matches exactly
  // -------------------------------------------------------------------------
  it('G17-4: recovered data matches original (deep equality)', async () => {
    const original = makeRecord({
      id: 'exact-1',
      type: 'episodic',
      content: {
        kind: 'episodic',
        missionId: 'm-42',
        missionGoal: 'Deploy to production',
        outcome: 'success',
        duration: 12345,
        taskSummaries: [
          { taskId: 't1', name: 'Build', outcome: 'success', duration: 5000 },
          { taskId: 't2', name: 'Test', outcome: 'success', duration: 3000 },
        ],
        keyEvents: [
          { type: 'started', timestamp: '2026-01-01T00:00:00Z', description: 'Mission started' },
        ],
        lessonsLearned: ['Always verify before deploy'],
      },
      confidence: 0.95,
      metadata: { nested: { array: [1, 2, 3], flag: true } },
    });

    {
      const store = new FileMemoryStore(testDir);
      await store.save(original);
    }

    {
      const store2 = new FileMemoryStore(testDir);
      const recovered = await store2.get('exact-1');

      expect(recovered).not.toBeNull();
      expect(recovered!.id).toBe(original.id);
      expect(recovered!.type).toBe(original.type);
      expect(recovered!.confidence).toBe(original.confidence);
      expect(recovered!.content).toEqual(original.content);
      expect(recovered!.metadata).toEqual(original.metadata);
      expect(recovered!.sourceEventIds).toEqual(original.sourceEventIds);
      expect(recovered!.evidenceRefs).toEqual(original.evidenceRefs);
    }
  });

  // -------------------------------------------------------------------------
  // Gate 5: No in-memory fallback — index is loaded from disk
  // -------------------------------------------------------------------------
  it('G17-5: no in-memory fallback — index loaded from disk', async () => {
    {
      const store = new FileMemoryStore(testDir);
      await store.save(makeRecord({ id: 'idx-1' }));
      await store.save(makeRecord({ id: 'idx-2', type: 'working' }));
    }

    // Verify index file exists on disk
    const indexPath = path.join(testDir, 'memory', '_index.json');
    const indexExists = await fs.access(indexPath).then(() => true, () => false);
    expect(indexExists).toBe(true);

    const raw = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(raw);
    expect(index.version).toBe(1);
    expect(Object.keys(index.entries)).toContain('idx-1');
    expect(Object.keys(index.entries)).toContain('idx-2');
  });

  // -------------------------------------------------------------------------
  // Gate 6: Evidence — write + restart + read produces evidence record
  // -------------------------------------------------------------------------
  it('G17-6: evidence trail — persistence + recovery is observable', async () => {
    const evidence: string[] = [];

    {
      const store = new FileMemoryStore(testDir);
      const record = makeRecord({ id: 'evidence-1' });
      await store.save(record);
      evidence.push(`WRITE: id=${record.id} type=${record.type} confidence=${record.confidence}`);
    }

    // Verify file exists
    const filePath = path.join(testDir, 'memory', 'semantic', 'evidence-1.json');
    const fileExists = await fs.access(filePath).then(() => true, () => false);
    evidence.push(`FILE_EXISTS: ${fileExists}`);

    // Read index
    const indexPath = path.join(testDir, 'memory', '_index.json');
    const indexRaw = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(indexRaw);
    evidence.push(`INDEX_ENTRIES: ${Object.keys(index.entries).length}`);

    // Recover
    {
      const store2 = new FileMemoryStore(testDir);
      const recovered = await store2.get('evidence-1');
      evidence.push(`RECOVERED: ${recovered !== null}`);
      evidence.push(`MATCH: ${recovered?.id === 'evidence-1'}`);
    }

    expect(evidence).toEqual([
      'WRITE: id=evidence-1 type=semantic confidence=0.85',
      'FILE_EXISTS: true',
      'INDEX_ENTRIES: 1',
      'RECOVERED: true',
      'MATCH: true',
    ]);
  });

  // -------------------------------------------------------------------------
  // Gate 7: Corruption / error path
  // -------------------------------------------------------------------------
  it('G17-7: corrupted record file returns null, index remains intact', async () => {
    const store = new FileMemoryStore(testDir);
    await store.save(makeRecord({ id: 'corrupt-1' }));

    // Corrupt the file
    const filePath = path.join(testDir, 'memory', 'semantic', 'corrupt-1.json');
    await fs.writeFile(filePath, 'NOT VALID JSON{{{', 'utf-8');

    // get() should return null, not throw
    const result = await store.get('corrupt-1');
    expect(result).toBeNull();

    // Index should still have the entry
    const count = await store.count();
    expect(count).toBe(1);
  });

  it('G17-7b: missing file (deleted externally) returns null gracefully', async () => {
    const store = new FileMemoryStore(testDir);
    await store.save(makeRecord({ id: 'gone-1' }));

    // Delete the file externally
    const filePath = path.join(testDir, 'memory', 'semantic', 'gone-1.json');
    await fs.unlink(filePath);

    const result = await store.get('gone-1');
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Gate 8: list / filter / count across restart
  // -------------------------------------------------------------------------
  it('G17-8: list and filter survive restart', async () => {
    {
      const store = new FileMemoryStore(testDir);
      await store.save(makeRecord({ id: 'f1', type: 'semantic', confidence: 0.5 }));
      await store.save(makeRecord({ id: 'f2', type: 'working', confidence: 0.9 }));
      await store.save(makeRecord({ id: 'f3', type: 'semantic', confidence: 0.7 }));
      await store.save(makeRecord({ id: 'f4', type: 'episodic', confidence: 0.3 }));
    }

    {
      const store2 = new FileMemoryStore(testDir);

      // List all
      const all = await store2.list();
      expect(all).toHaveLength(4);

      // Filter by type
      const semanticOnly = await store2.list({ type: 'semantic' });
      expect(semanticOnly).toHaveLength(2);

      // Filter by confidence
      const highConf = await store2.list({ minConfidence: 0.7 });
      expect(highConf).toHaveLength(2);

      // Count
      const totalCount = await store2.count();
      expect(totalCount).toBe(4);

      const semanticCount = await store2.count({ type: 'semantic' });
      expect(semanticCount).toBe(2);
    }
  });

  // -------------------------------------------------------------------------
  // Gate 9: delete persists across restart
  // -------------------------------------------------------------------------
  it('G17-9: delete persists across restart', async () => {
    {
      const store = new FileMemoryStore(testDir);
      await store.save(makeRecord({ id: 'del-1' }));
      await store.save(makeRecord({ id: 'del-2' }));
      await store.delete('del-1');
    }

    {
      const store2 = new FileMemoryStore(testDir);
      const r1 = await store2.get('del-1');
      const r2 = await store2.get('del-2');

      expect(r1).toBeNull();
      expect(r2).not.toBeNull();
      expect(await store2.count()).toBe(1);
    }
  });

  // -------------------------------------------------------------------------
  // Gate 10: clear wipes everything on disk
  // -------------------------------------------------------------------------
  it('G17-10: clear removes all files and index', async () => {
    {
      const store = new FileMemoryStore(testDir);
      await store.save(makeRecord({ id: 'c1' }));
      await store.save(makeRecord({ id: 'c2' }));
      await store.clear();
    }

    {
      const store2 = new FileMemoryStore(testDir);
      expect(await store2.count()).toBe(0);
      expect(await store2.list()).toHaveLength(0);
    }

    // Verify directory structure is clean
    const memoryDir = path.join(testDir, 'memory');
    const exists = await fs.access(memoryDir).then(() => true, () => false);
    expect(exists).toBe(true); // directory exists but is empty (just _index.json)
  });

  // -------------------------------------------------------------------------
  // Gate 11: factory function works
  // -------------------------------------------------------------------------
  it('G17-11: createFileMemoryStore factory produces working store', async () => {
    const store = createFileMemoryStore(testDir);
    const record = makeRecord({ id: 'factory-1' });

    await store.save(record);
    const retrieved = await store.get('factory-1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe('factory-1');
  });
});
