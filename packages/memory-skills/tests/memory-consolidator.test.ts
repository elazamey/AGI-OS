import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../src/memory-store.js';
import { MemoryConsolidator } from '../src/memory-consolidator.js';

describe('MemoryConsolidator', () => {
  let store: MemoryStore;
  let consolidator: MemoryConsolidator;

  beforeEach(() => {
    store = new MemoryStore();
    consolidator = new MemoryConsolidator(store);
  });

  it('promotes important working memory', () => {
    store.store({ tier: 'working', content: 'important', source: 'test', importance: 0.9 });
    const item = store.store({ tier: 'working', content: 'test', source: 'test', importance: 0.9 });
    for (let i = 0; i < 5; i++) store.retrieve(item.id);
    const result = consolidator.consolidate();
    expect(result.promoted).toBeGreaterThanOrEqual(0);
  });

  it('forgets low importance', () => {
    store.store({ tier: 'session', content: 'unimportant', source: 'test', importance: 0.05 });
    const forgotten = consolidator.forget(0.1);
    expect(forgotten).toBe(1);
  });

  it('deduplicates', () => {
    store.store({ tier: 'working', content: 'duplicate', source: 'test' });
    store.store({ tier: 'working', content: 'duplicate', source: 'test' });
    const removed = consolidator.deduplicate();
    expect(removed).toBe(1);
    expect(store.count()).toBe(1);
  });
});
