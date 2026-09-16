import { describe, it, expect, beforeEach } from 'vitest';
import { AgentRegistry } from '../src/agent-registry.js';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  beforeEach(() => { registry = new AgentRegistry(); });

  it('registers an agent with defaults', () => {
    const agent = registry.register({ role: 'researcher', name: 'R1' });
    expect(agent.id).toBeDefined();
    expect(agent.role).toBe('researcher');
    expect(agent.trustLevel).toBe('standard');
    expect(agent.maxConcurrentTasks).toBe(1);
  });

  it('registers with custom values', () => {
    const agent = registry.register({ role: 'coder', name: 'C1', capabilities: ['ts'], maxConcurrentTasks: 3, trustLevel: 'privileged' });
    expect(agent.capabilities).toEqual(['ts']);
    expect(agent.maxConcurrentTasks).toBe(3);
    expect(agent.trustLevel).toBe('privileged');
  });

  it('throws on duplicate', () => {
    registry.register({ role: 'researcher', name: 'R1' });
    expect(() => registry.register({ role: 'researcher', name: 'R1' })).toThrow();
  });

  it('allows same name different roles', () => {
    registry.register({ role: 'researcher', name: 'Bot' });
    registry.register({ role: 'coder', name: 'Bot' });
    expect(registry.count()).toBe(2);
  });

  it('unregisters agent', () => {
    const a = registry.register({ role: 'researcher', name: 'R1' });
    expect(registry.unregister(a.id)).toBe(true);
    expect(registry.count()).toBe(0);
  });

  it('returns false for non-existent unregister', () => {
    expect(registry.unregister('x')).toBe(false);
  });

  it('gets by id', () => {
    const a = registry.register({ role: 'researcher', name: 'R1' });
    expect(registry.get(a.id)?.name).toBe('R1');
  });

  it('gets by role', () => {
    registry.register({ role: 'researcher', name: 'R1' });
    registry.register({ role: 'coder', name: 'C1' });
    expect(registry.getByRole('researcher').length).toBe(1);
  });

  it('gets by capability', () => {
    registry.register({ role: 'coder', name: 'C1', capabilities: ['ts'] });
    expect(registry.getByCapability('ts').length).toBe(1);
  });

  it('gets by trust level', () => {
    registry.register({ role: 'coder', name: 'C1', trustLevel: 'restricted' });
    expect(registry.getByTrustLevel('restricted').length).toBe(1);
  });

  it('returns all', () => {
    registry.register({ role: 'researcher', name: 'R1' });
    expect(registry.getAll().length).toBe(1);
  });

  it('checks has', () => {
    const a = registry.register({ role: 'researcher', name: 'R1' });
    expect(registry.has(a.id)).toBe(true);
    expect(registry.has('x')).toBe(false);
  });

  it('clears all', () => {
    registry.register({ role: 'researcher', name: 'R1' });
    registry.clear();
    expect(registry.count()).toBe(0);
  });
});
