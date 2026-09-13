import { describe, it, expect } from 'vitest';
import { ExecutionPolicy } from '../src/ExecutionPolicy.js';
import type { SkillContract } from '@agi-os/skills';

describe('ExecutionPolicy', () => {
  const policy = new ExecutionPolicy();

  const lowRiskSkill: SkillContract = {
    id: 'test.low', name: 'Low Risk', version: '1.0.0', description: 'Test',
    category: 'core', capabilities: [], risk: 'LOW',
    requiresApproval: false, requiresNetwork: false, requiresPersistence: false,
    allowedScopes: [], timeoutMs: 10000, retryLimit: 1,
    verification: { required: false, level: 'BASIC' },
  };

  const criticalSkill: SkillContract = {
    ...lowRiskSkill, id: 'test.critical', risk: 'CRITICAL',
  };

  it('should allow low risk skill', async () => {
    const result = await policy.check(lowRiskSkill, 'm1');
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });

  it('should require approval for critical skill', async () => {
    const result = await policy.check(criticalSkill, 'm1');
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });
});
