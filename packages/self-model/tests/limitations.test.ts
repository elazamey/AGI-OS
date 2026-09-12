import { describe, it, expect, beforeEach } from 'vitest';
import { LimitationRegistry } from '../src/limitations.js';

describe('LimitationRegistry', () => {
  let registry: LimitationRegistry;

  beforeEach(() => {
    registry = new LimitationRegistry();
  });

  it('should discover a new limitation', () => {
    const lim = registry.discover({
      category: 'tool',
      description: 'Cannot access network',
      severity: 'moderate',
    });
    expect(lim.id).toBeDefined();
    expect(lim.category).toBe('tool');
    expect(lim.hitCount).toBe(1);
  });

  it('should record and increment hit count', () => {
    const lim = registry.discover({
      category: 'provider',
      description: 'Rate limited',
      severity: 'minor',
    });
    registry.hit(lim.id);
    registry.hit(lim.id);
    expect(registry.getLimitation(lim.id)!.hitCount).toBe(3);
  });

  it('should find by description substring', () => {
    registry.discover({ category: 'tool', description: 'Network timeout', severity: 'minor' });
    const found = registry.findByDescription('timeout');
    expect(found).toBeDefined();
  });

  it('should recordIfNew and increment existing', () => {
    const r1 = registry.recordIfNew({
      category: 'tool',
      description: 'Disk full',
      severity: 'major',
    });
    expect(r1.isNew).toBe(true);

    const r2 = registry.recordIfNew({
      category: 'tool',
      description: 'Disk full',
      severity: 'major',
    });
    expect(r2.isNew).toBe(false);
    expect(r2.limitation.hitCount).toBe(2);
  });

  it('should add workaround', () => {
    const lim = registry.discover({
      category: 'tool',
      description: 'No GPU available',
      severity: 'minor',
    });
    registry.addWorkaround(lim.id, 'Use CPU fallback');
    expect(registry.getLimitation(lim.id)!.workaround).toBe('Use CPU fallback');
  });

  it('should get by category', () => {
    registry.discover({ category: 'tool', description: 'a', severity: 'minor' });
    registry.discover({ category: 'provider', description: 'b', severity: 'minor' });
    expect(registry.getByCategory('tool')).toHaveLength(1);
  });

  it('should get by severity', () => {
    registry.discover({ category: 'tool', description: 'a', severity: 'minor' });
    registry.discover({ category: 'tool', description: 'b', severity: 'critical' });
    expect(registry.getBySeverity('critical')).toHaveLength(1);
  });

  it('should get most hit', () => {
    const lim1 = registry.discover({ category: 'tool', description: 'a', severity: 'minor' });
    const lim2 = registry.discover({ category: 'tool', description: 'b', severity: 'minor' });
    registry.hit(lim1.id);
    registry.hit(lim1.id);
    registry.hit(lim2.id);
    expect(registry.getMostHit(1)[0].id).toBe(lim1.id);
  });

  it('should remove', () => {
    const lim = registry.discover({ category: 'tool', description: 'x', severity: 'minor' });
    expect(registry.remove(lim.id)).toBe(true);
    expect(registry.getLimitation(lim.id)).toBeUndefined();
  });

  it('should reset', () => {
    registry.discover({ category: 'tool', description: 'x', severity: 'minor' });
    registry.reset();
    expect(registry.count()).toBe(0);
  });

  it('should count', () => {
    registry.discover({ category: 'tool', description: 'a', severity: 'minor' });
    registry.discover({ category: 'tool', description: 'b', severity: 'minor' });
    expect(registry.count()).toBe(2);
  });
});
