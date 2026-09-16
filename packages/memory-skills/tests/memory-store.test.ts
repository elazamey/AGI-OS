import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../src/memory-store.js';

describe('MemoryStore', () => {
  let store: MemoryStore;
  beforeEach(() => { store = new MemoryStore(); });

  it('stores item', () => {
    const item = store.store({ tier: 'working', content: 'test memory', source: 'test' });
    expect(item.id).toBeDefined();
    expect(item.tier).toBe('working');
    expect(item.content).toBe('test memory');
  });

  it('retrieves item', () => {
    const item = store.store({ tier: 'working', content: 'test', source: 'test' });
    const retrieved = store.retrieve(item.id);
    expect(retrieved?.content).toBe('test');
    expect(retrieved?.accessCount).toBe(1);
  });

  it('queries by tier', () => {
    store.store({ tier: 'working', content: 'w1', source: 'test' });
    store.store({ tier: 'session', content: 's1', source: 'test' });
    expect(store.query({ tier: 'working' }).length).toBe(1);
  });

  it('queries by text', () => {
    store.store({ tier: 'working', content: 'hello world', source: 'test' });
    store.store({ tier: 'working', content: 'goodbye', source: 'test' });
    expect(store.query({ text: 'hello' }).length).toBe(1);
  });

  it('queries by mission', () => {
    store.store({ tier: 'task', content: 't1', source: 'test', missionId: 'm1' });
    store.store({ tier: 'task', content: 't2', source: 'test', missionId: 'm2' });
    expect(store.query({ missionId: 'm1' }).length).toBe(1);
  });

  it('deletes item', () => {
    const item = store.store({ tier: 'working', content: 'test', source: 'test' });
    expect(store.delete(item.id)).toBe(true);
    expect(store.count()).toBe(0);
  });

  it('gets stats', () => {
    store.store({ tier: 'working', content: 'w1', source: 'test' });
    store.store({ tier: 'session', content: 's1', source: 'test' });
    const stats = store.getStats();
    expect(stats.total).toBe(2);
  });

  it('clears tier', () => {
    store.store({ tier: 'working', content: 'w1', source: 'test' });
    store.store({ tier: 'session', content: 's1', source: 'test' });
    store.clear('working');
    expect(store.count()).toBe(1);
  });
});
