import { describe, it, expect } from 'vitest';
import { DiffEngine } from '../src/diff-engine.js';

describe('DiffEngine', () => {
  const engine = new DiffEngine();

  it('detects changes', () => {
    const diff = engine.diff('line1\nline2', 'line1\nline3');
    expect(diff.added.length).toBe(1);
    expect(diff.removed.length).toBe(1);
    expect(diff.totalChanges).toBe(2);
  });

  it('detects no changes', () => {
    const diff = engine.diff('same', 'same');
    expect(diff.totalChanges).toBe(0);
  });

  it('hasChanges', () => {
    const diff = engine.diff('a', 'b');
    expect(engine.hasChanges(diff)).toBe(true);
  });

  it('summary', () => {
    const diff = engine.diff('a\nb', 'a\nc');
    expect(engine.summary(diff)).toContain('+1');
  });
});
