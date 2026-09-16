import { describe, it, expect, beforeEach } from 'vitest';
import { DelegationManager } from '../src/delegation-manager.js';

describe('DelegationManager', () => {
  let dm: DelegationManager;
  beforeEach(() => { dm = new DelegationManager(); });

  it('creates with defaults', () => {
    const d = dm.create({ parentMissionId: 'm1', goal: 'G', assignedTo: 'a1', assignedBy: 'k' });
    expect(d.id).toBeDefined();
    expect(d.status).toBe('pending');
    expect(d.priority).toBe('medium');
    expect(d.constraints.maxCost).toBe(0);
  });

  it('creates with custom values', () => {
    const d = dm.create({ parentMissionId: 'm1', goal: 'G', assignedTo: 'a1', assignedBy: 'k', priority: 'critical', constraints: { maxDuration: 60000, allowedModules: ['fs'] } });
    expect(d.priority).toBe('critical');
    expect(d.constraints.maxDuration).toBe(60000);
  });

  it('transitions pending → accepted → in_progress → completed', () => {
    const d = dm.create({ parentMissionId: 'm1', goal: 'G', assignedTo: 'a1', assignedBy: 'k' });
    expect(dm.accept(d.id)?.status).toBe('accepted');
    expect(dm.start(d.id)?.status).toBe('in_progress');
    expect(dm.complete(d.id)?.status).toBe('completed');
  });

  it('transitions pending → accepted → in_progress → failed', () => {
    const d = dm.create({ parentMissionId: 'm1', goal: 'G', assignedTo: 'a1', assignedBy: 'k' });
    dm.accept(d.id);
    dm.start(d.id);
    expect(dm.fail(d.id)?.status).toBe('failed');
  });

  it('transitions pending → rejected', () => {
    const d = dm.create({ parentMissionId: 'm1', goal: 'G', assignedTo: 'a1', assignedBy: 'k' });
    expect(dm.reject(d.id)?.status).toBe('rejected');
  });

  it('rejects invalid transitions', () => {
    const d = dm.create({ parentMissionId: 'm1', goal: 'G', assignedTo: 'a1', assignedBy: 'k' });
    expect(dm.start(d.id)).toBeUndefined();
    expect(dm.complete(d.id)).toBeUndefined();
    expect(dm.fail(d.id)).toBeUndefined();
  });

  it('gets by agent', () => {
    dm.create({ parentMissionId: 'm1', goal: 'G1', assignedTo: 'a1', assignedBy: 'k' });
    dm.create({ parentMissionId: 'm1', goal: 'G2', assignedTo: 'a2', assignedBy: 'k' });
    expect(dm.getByAgent('a1').length).toBe(1);
  });

  it('gets by status', () => {
    const d1 = dm.create({ parentMissionId: 'm1', goal: 'G1', assignedTo: 'a1', assignedBy: 'k' });
    dm.create({ parentMissionId: 'm1', goal: 'G2', assignedTo: 'a1', assignedBy: 'k' });
    dm.accept(d1.id);
    dm.start(d1.id);
    dm.complete(d1.id);
    expect(dm.getByStatus('completed').length).toBe(1);
    expect(dm.getByStatus('pending').length).toBe(1);
  });

  it('gets by mission', () => {
    dm.create({ parentMissionId: 'm1', goal: 'G1', assignedTo: 'a1', assignedBy: 'k' });
    dm.create({ parentMissionId: 'm2', goal: 'G2', assignedTo: 'a1', assignedBy: 'k' });
    expect(dm.getByMission('m1').length).toBe(1);
  });

  it('gets active', () => {
    const d1 = dm.create({ parentMissionId: 'm1', goal: 'G1', assignedTo: 'a1', assignedBy: 'k' });
    dm.create({ parentMissionId: 'm1', goal: 'G2', assignedTo: 'a1', assignedBy: 'k' });
    dm.accept(d1.id);
    dm.start(d1.id);
    dm.complete(d1.id);
    expect(dm.getActive().length).toBe(1);
  });

  it('detects overdue', () => {
    const d = dm.create({ parentMissionId: 'm1', goal: 'G', assignedTo: 'a1', assignedBy: 'k', deadline: '2020-01-01T00:00:00Z' });
    expect(dm.isOverdue(d.id)).toBe(true);
  });

  it('returns false for no deadline', () => {
    const d = dm.create({ parentMissionId: 'm1', goal: 'G', assignedTo: 'a1', assignedBy: 'k' });
    expect(dm.isOverdue(d.id)).toBe(false);
  });
});
