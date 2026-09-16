import { describe, it, expect } from 'vitest';
import { LocalVectorEngine } from '../src/vector/vector-engine.js';
import { SemanticVectorMemory } from '../src/semantic-vector-memory.js';

// ===========================================================================
// Performance Benchmark Suite — Memory & Vector Latency
// ===========================================================================

describe('Performance Benchmark: Vector Search Latency', () => {
  it('should search 1,000 documents in under 20ms', () => {
    const engine = new LocalVectorEngine({ dimension: 128 });

    const topics = [
      'database optimization', 'network security', 'caching strategies',
      'API design patterns', 'authentication flows', 'error handling',
      'logging best practices', 'testing methodologies', 'deployment automation',
      'performance monitoring',
    ];

    for (let i = 0; i < 1000; i++) {
      const topic = topics[i % topics.length];
      engine.insertWithId(`doc-${i}`, `${topic} for system ${i} with details`);
    }

    const start = performance.now();
    const results = engine.search('database optimization performance', 5);
    const elapsed = performance.now() - start;

    expect(results.length).toBe(5);
    expect(elapsed).toBeLessThan(20);
  });

  it('should search 5,000 documents in under 50ms', () => {
    const engine = new LocalVectorEngine({ dimension: 128 });

    for (let i = 0; i < 5000; i++) {
      engine.insertWithId(`doc-${i}`, `knowledge item ${i % 50} about topic ${i % 20}`);
    }

    const start = performance.now();
    const results = engine.search('knowledge about topic', 10);
    const elapsed = performance.now() - start;

    expect(results.length).toBe(10);
    expect(elapsed).toBeLessThan(50);
  });

  it('should handle concurrent inserts and searches within budget', () => {
    const engine = new LocalVectorEngine({ dimension: 128 });
    const start = performance.now();

    for (let i = 0; i < 500; i++) {
      engine.insertWithId(`item-${i}`, `Concurrent test item ${i}`);
      if (i % 10 === 0) {
        engine.search(`test item ${i}`, 3);
      }
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});

describe('Performance Benchmark: Memory Footprint', () => {
  it('should store 2,000 vector documents without exceeding 35MB overhead', () => {
    const engine = new LocalVectorEngine({ dimension: 128 });

    if (global.gc) global.gc();
    const initialHeap = process.memoryUsage().heapUsed;

    for (let i = 0; i < 2000; i++) {
      engine.insertWithId(`mem-${i}`, `Memory consumption test payload for document ${i}`);
    }

    if (global.gc) global.gc();
    const finalHeap = process.memoryUsage().heapUsed;
    const heapDiffMB = (finalHeap - initialHeap) / (1024 * 1024);

    expect(heapDiffMB).toBeLessThan(35);
  });

  it('should handle SemanticVectorMemory with 1,000 entries within bounds', () => {
    const memory = new SemanticVectorMemory(128);

    if (global.gc) global.gc();
    const initialHeap = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      memory.store(`sem-${i}`, `Semantic lesson ${i % 25} about performance and patterns`);
    }

    if (global.gc) global.gc();
    const finalHeap = process.memoryUsage().heapUsed;
    const heapDiffMB = (finalHeap - initialHeap) / (1024 * 1024);

    expect(heapDiffMB).toBeLessThan(35);
  });
});

describe('Performance Benchmark: SemanticVectorMemory Latency', () => {
  it('should store and search 500 entries under 50ms', () => {
    const memory = new SemanticVectorMemory(128);
    const start = performance.now();

    for (let i = 0; i < 500; i++) {
      memory.store(`item-${i}`, `Performance test lesson number ${i}`);
    }
    memory.search('performance test lesson', 10);

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
