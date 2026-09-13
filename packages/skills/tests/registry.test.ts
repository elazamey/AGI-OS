import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../src/registry.js';
import type { SkillContract } from '../src/types.js';

const makeSkill = (id: string, overrides?: Partial<SkillContract>): SkillContract => ({
  id,
  name: `Skill ${id}`,
  version: '1.0.0',
  description: `Test skill ${id}`,
  category: 'core',
  capabilities: ['test'],
  risk: 'LOW',
  requiresApproval: false,
  requiresNetwork: false,
  requiresPersistence: false,
  allowedScopes: [],
  timeoutMs: 5000,
  retryLimit: 3,
  verification: { required: false, level: 'BASIC' },
  ...overrides,
});

describe('SkillRegistry', () => {
  let registry: SkillRegistry;
  beforeEach(() => { registry = new SkillRegistry(); });

  it('registers a skill', () => {
    const instance = registry.register(makeSkill('s1'));
    expect(instance.id).toBe('s1');
    expect(instance.status).toBe('registered');
    expect(instance.totalExecutions).toBe(0);
  });

  it('prevents duplicate registration', () => {
    registry.register(makeSkill('s1'));
    expect(() => registry.register(makeSkill('s1'))).toThrow('already registered');
  });

  it('unregisters a skill', () => {
    registry.register(makeSkill('s1'));
    expect(registry.unregister('s1')).toBe(true);
    expect(registry.getSkill('s1')).toBeUndefined();
  });

  it('enables and disables skills', () => {
    registry.register(makeSkill('s1'));
    registry.disable('s1');
    expect(registry.getSkill('s1')?.status).toBe('disabled');
    registry.enable('s1');
    expect(registry.getSkill('s1')?.status).toBe('enabled');
  });

  it('gets skills by category', () => {
    registry.register(makeSkill('s1', { category: 'core' }));
    registry.register(makeSkill('s2', { category: 'browser' }));
    registry.register(makeSkill('s3', { category: 'core' }));
    expect(registry.getSkillsByCategory('core').length).toBe(2);
    expect(registry.getSkillsByCategory('browser').length).toBe(1);
  });

  it('gets enabled skills', () => {
    registry.register(makeSkill('s1'));
    registry.register(makeSkill('s2'));
    registry.disable('s2');
    expect(registry.getEnabledSkills().length).toBe(1);
  });

  it('checks canExecute', () => {
    registry.register(makeSkill('s1'));
    expect(registry.canExecute('s1').allowed).toBe(true);
    registry.disable('s1');
    expect(registry.canExecute('s1').allowed).toBe(false);
    expect(registry.canExecute('nonexistent').allowed).toBe(false);
  });

  it('records execution and updates stats', () => {
    registry.register(makeSkill('s1'));
    registry.recordExecution({ skillId: 's1', success: true, output: null, duration: 100, timestamp: new Date().toISOString() });
    registry.recordExecution({ skillId: 's1', success: false, output: null, duration: 100, timestamp: new Date().toISOString() });
    const skill = registry.getSkill('s1');
    expect(skill?.totalExecutions).toBe(2);
    expect(skill?.successRate).toBe(0.5);
  });

  it('gets execution history', () => {
    registry.register(makeSkill('s1'));
    registry.recordExecution({ skillId: 's1', success: true, output: null, duration: 100, timestamp: new Date().toISOString() });
    expect(registry.getExecutionHistory('s1').length).toBe(1);
    expect(registry.getExecutionHistory().length).toBe(1);
  });

  it('gets stats', () => {
    registry.register(makeSkill('s1'));
    registry.register(makeSkill('s2'));
    registry.disable('s2');
    const stats = registry.getStats();
    expect(stats.total).toBe(2);
    expect(stats.enabled).toBe(1);
    expect(stats.disabled).toBe(1);
  });

  it('clears registry', () => {
    registry.register(makeSkill('s1'));
    registry.clear();
    expect(registry.getStats().total).toBe(0);
  });
});
