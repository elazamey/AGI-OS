import { describe, it, expect, beforeEach } from 'vitest';
import { CheckpointManager } from '../src/checkpoint-manager.js';

describe('CheckpointManager', () => {
  let mgr: CheckpointManager;
  beforeEach(() => { mgr = new CheckpointManager(); });

  it('creates checkpoint', () => {
    const cp = mgr.create('m1', 's1', { step: 1 });
    expect(cp.id).toBeDefined();
    expect(cp.missionId).toBe('m1');
    expect(cp.state.step).toBe(1);
  });

  it('gets latest checkpoint', () => {
    mgr.create('m1', 's1', { step: 1 });
    mgr.create('m1', 's2', { step: 2 });
    const latest = mgr.getLatest('m1');
    expect(latest?.state.step).toBe(2);
  });

  it('gets checkpoints by mission', () => {
    mgr.create('m1', 's1', {});
    mgr.create('m2', 's1', {});
    expect(mgr.getCheckpoints('m1').length).toBe(1);
  });

  it('gets by step', () => {
    mgr.create('m1', 's1', {});
    mgr.create('m1', 's2', {});
    expect(mgr.getByStep('m1', 's2')).toBeDefined();
  });

  it('clears mission checkpoints', () => {
    mgr.create('m1', 's1', {});
    mgr.create('m2', 's1', {});
    mgr.clear('m1');
    expect(mgr.count('m1')).toBe(0);
    expect(mgr.count('m2')).toBe(1);
  });

  it('counts checkpoints', () => {
    mgr.create('m1', 's1', {});
    mgr.create('m1', 's2', {});
    expect(mgr.count('m1')).toBe(2);
  });
});
