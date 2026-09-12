import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMemoryStore,
  createMemoryRetrieval,
  createMemoryConsolidation,
  createSemanticMemory,
  createEpisodicMemory,
  createWorkingMemory,
  createMetaMemory,
} from '../src/index.js';

// ===========================================================================
// Memory Retrieval
// ===========================================================================
describe('Memory Retrieval', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let retrieval: ReturnType<typeof createMemoryRetrieval>;

  beforeEach(async () => {
    store = createMemoryStore();
    retrieval = createMemoryRetrieval(store);

    // Seed with data
    const semantic = createSemanticMemory(store);
    await semantic.storeFact({ subject: 'TypeScript', predicate: 'is', object: 'typed JavaScript', source: 'docs' });
    await semantic.storeFact({ subject: 'Rust', predicate: 'has', object: 'ownership', source: 'docs' });

    const episodic = createEpisodicMemory(store);
    await episodic.recordEpisode({
      missionId: 'm1', missionGoal: 'Test', outcome: 'success',
      duration: 100, taskSummaries: [], keyEvents: [],
    });
  });

  it('should retrieve by text', async () => {
    const results = await retrieval.search('TypeScript');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].record.type).toBe('semantic');
  });

  it('should retrieve by type', async () => {
    const results = await retrieval.retrieve({
      type: 'episodic',
      limit: 10,
      includeEvidence: false,
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].record.type).toBe('episodic');
  });

  it('should retrieve by mission ID', async () => {
    const results = await retrieval.byMissionId('m1');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should get most accessed', async () => {
    const records = await retrieval.mostAccessed(5);
    expect(Array.isArray(records)).toBe(true);
  });

  it('should get most recent', async () => {
    const records = await retrieval.mostRecent(5);
    expect(records.length).toBeGreaterThanOrEqual(1);
  });

  it('should get high confidence', async () => {
    const records = await retrieval.highConfidence(0.7, 10);
    expect(Array.isArray(records)).toBe(true);
  });
});

// ===========================================================================
// Memory Consolidation
// ===========================================================================
describe('Memory Consolidation', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let consolidation: ReturnType<typeof createMemoryConsolidation>;

  beforeEach(async () => {
    store = createMemoryStore();
    consolidation = createMemoryConsolidation(store);
  });

  it('should run consolidation cycle', async () => {
    const result = await consolidation.consolidate();
    expect(result).toBeDefined();
    expect(result.timestamp).toBeDefined();
    expect(Array.isArray(result.promoted)).toBe(true);
    expect(Array.isArray(result.reinforced)).toBe(true);
    expect(Array.isArray(result.decayed)).toBe(true);
    expect(Array.isArray(result.removed)).toBe(true);
    expect(Array.isArray(result.merged)).toBe(true);
  });

  it('should merge duplicate semantic memories', async () => {
    // Add raw records directly to bypass storeFact deduplication
    await store.save({
      id: 'dup-1', type: 'semantic' as const,
      content: { kind: 'semantic', category: 'fact', subject: 'A', predicate: 'is', object: 'B', source: 's1', strength: 0.5 },
      sourceEventIds: [], evidenceRefs: [], confidence: 0.5, accessCount: 0,
      lastAccessedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), metadata: {},
    });
    await store.save({
      id: 'dup-2', type: 'semantic' as const,
      content: { kind: 'semantic', category: 'fact', subject: 'A', predicate: 'is', object: 'B', source: 's2', strength: 0.6 },
      sourceEventIds: [], evidenceRefs: [], confidence: 0.6, accessCount: 0,
      lastAccessedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), metadata: {},
    });

    const merged = await consolidation.mergeDuplicates();
    expect(merged.length).toBeGreaterThanOrEqual(1);

    const semantic = createSemanticMemory(store);
    const facts = await semantic.queryBySubject('A');
    expect(facts).toHaveLength(1); // only one remains
  });

  it('should reinforce frequently accessed', async () => {
    const semantic = createSemanticMemory(store);
    const record = await semantic.storeFact({
      subject: 'popular', predicate: 'is', object: 'well-known', source: 's',
    });

    // Simulate many accesses
    record.accessCount = 10;
    await store.save(record);

    const reinforced = await consolidation.reinforceFrequent(5, 0.1);
    expect(reinforced.length).toBeGreaterThanOrEqual(1);
  });

  it('should remove stale memories', async () => {
    const semantic = createSemanticMemory(store);
    const record = await semantic.storeFact({
      subject: 'old', predicate: 'was', object: 'something', source: 's', strength: 0.05,
    });

    // Make it old
    record.createdAt = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    await store.save(record);

    const removed = await consolidation.removeStale(180, 0.1);
    expect(removed.length).toBeGreaterThanOrEqual(1);
  });

  it('should provide stats', async () => {
    const semantic = createSemanticMemory(store);
    await semantic.storeFact({ subject: 'A', predicate: 'is', object: 'B', source: 's' });

    const stats = await consolidation.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(stats.byType.semantic).toBeGreaterThanOrEqual(1);
    expect(stats.avgConfidence).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Store
// ===========================================================================
describe('Memory Store', () => {
  let store: ReturnType<typeof createMemoryStore>;

  beforeEach(() => {
    store = createMemoryStore();
  });

  it('should save and retrieve', async () => {
    const record = {
      id: 'test-1',
      type: 'semantic' as const,
      content: { kind: 'semantic', category: 'fact', subject: 'A', predicate: 'is', object: 'B', source: 's', strength: 0.8 },
      sourceEventIds: [],
      evidenceRefs: [],
      confidence: 0.8,
      accessCount: 0,
      lastAccessedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    };

    await store.save(record);
    const found = await store.get('test-1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('test-1');
  });

  it('should delete', async () => {
    const record = {
      id: 'del-1', type: 'semantic' as const,
      content: { kind: 'semantic', category: 'fact', subject: 'A', predicate: 'is', object: 'B', source: 's', strength: 0.8 },
      sourceEventIds: [], evidenceRefs: [], confidence: 0.8, accessCount: 0,
      lastAccessedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), metadata: {},
    };

    await store.save(record);
    const deleted = await store.delete('del-1');
    expect(deleted).toBe(true);
    expect(await store.get('del-1')).toBeNull();
  });

  it('should list with filters', async () => {
    const r1 = {
      id: 'f-1', type: 'semantic' as const,
      content: { kind: 'semantic', category: 'fact', subject: 'A', predicate: 'is', object: 'B', source: 's', strength: 0.8 },
      sourceEventIds: [], evidenceRefs: [], confidence: 0.8, accessCount: 0,
      lastAccessedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), metadata: {},
    };
    const r2 = {
      id: 'f-2', type: 'episodic' as const,
      content: { kind: 'episodic', missionId: 'm', missionGoal: 'g', outcome: 'success', duration: 10, taskSummaries: [], keyEvents: [], lessonsLearned: [] },
      sourceEventIds: [], evidenceRefs: [], confidence: 0.5, accessCount: 0,
      lastAccessedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), metadata: {},
    };

    await store.save(r1);
    await store.save(r2);

    const semantic = await store.list({ type: 'semantic' });
    expect(semantic).toHaveLength(1);
    expect(semantic[0].type).toBe('semantic');
  });

  it('should count', async () => {
    expect(await store.count()).toBe(0);

    await store.save({
      id: 'c-1', type: 'working' as const,
      content: { kind: 'working', currentGoal: null, currentPlan: [], activeObservations: [], scratchpad: {} },
      sourceEventIds: [], evidenceRefs: [], confidence: 1.0, accessCount: 0,
      lastAccessedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), metadata: {},
    });

    expect(await store.count()).toBe(1);
  });

  it('should clear', async () => {
    await store.save({
      id: 'cl-1', type: 'working' as const,
      content: { kind: 'working', currentGoal: null, currentPlan: [], activeObservations: [], scratchpad: {} },
      sourceEventIds: [], evidenceRefs: [], confidence: 1.0, accessCount: 0,
      lastAccessedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(), metadata: {},
    });

    await store.clear();
    expect(await store.count()).toBe(0);
  });
});
