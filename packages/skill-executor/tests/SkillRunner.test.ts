import { describe, it, expect, vi } from 'vitest';
import { SkillRunner } from '../src/SkillRunner.js';
import { InputValidator } from '../src/InputValidator.js';
import { OutputValidator } from '../src/OutputValidator.js';
import { ExecutionPolicy } from '../src/ExecutionPolicy.js';
import type { SkillHandler } from '../src/types.js';
import type { SkillContract } from '@agi-os/skills';

describe('SkillRunner', () => {
  const mockHandler: SkillHandler = {
    skillId: 'test.skill',
    category: 'test',
    execute: async (input) => ({ result: 'ok', ...input }),
  };

  const mockContract: SkillContract = {
    id: 'test.skill', name: 'Test', version: '1.0.0', description: 'Test',
    category: 'core', capabilities: [], risk: 'LOW',
    requiresApproval: false, requiresNetwork: false, requiresPersistence: false,
    allowedScopes: [], timeoutMs: 10000, retryLimit: 1,
    verification: { required: false, level: 'BASIC' },
  };

  const mockGovernance = {
    intercept: vi.fn().mockReturnValue({
      decision: 'ALLOW',
      riskAssessment: { reason: 'ok' },
    }),
  } as any;

  const runner = new SkillRunner({
    handlers: new Map([['test.skill', mockHandler]]),
    contracts: new Map([['test.skill', mockContract]]),
    inputValidator: new InputValidator(),
    outputValidator: new OutputValidator(),
    executionPolicy: new ExecutionPolicy(),
  });

  it('should execute skill successfully', async () => {
    const result = await runner.execute(
      { missionId: 'm1', taskId: 't1', skillId: 'test.skill', input: { x: 1 }, requestedBy: 'test' },
      { missionId: 'm1', taskId: 't1', workingDir: '/tmp', timeout: 10000, governance: mockGovernance }
    );

    expect(result.success).toBe(true);
    expect(result.output).toEqual({ result: 'ok', x: 1 });
    expect(result.evidence.operation).toBe('skill.test.skill');
    expect(result.evidence.exitCode).toBe(0);
  });

  it('should fail for unknown skill', async () => {
    const result = await runner.execute(
      { missionId: 'm1', taskId: 't1', skillId: 'unknown', input: {}, requestedBy: 'test' },
      { missionId: 'm1', taskId: 't1', workingDir: '/tmp', timeout: 10000, governance: mockGovernance }
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SKILL_NOT_FOUND');
  });

  it('should block governance-blocked skill', async () => {
    const blockedGovernance = {
      intercept: vi.fn().mockReturnValue({
        decision: 'BLOCK',
        riskAssessment: { reason: 'blocked by policy' },
      }),
    } as any;

    const result = await runner.execute(
      { missionId: 'm1', taskId: 't1', skillId: 'test.skill', input: {}, requestedBy: 'test' },
      { missionId: 'm1', taskId: 't1', workingDir: '/tmp', timeout: 10000, governance: blockedGovernance }
    );

    expect(result.success).toBe(false);
    expect(result.error?.message).toContain('Governance blocked');
  });

  it('should create evidence with hashes', async () => {
    const result = await runner.execute(
      { missionId: 'm1', taskId: 't1', skillId: 'test.skill', input: { a: 1 }, requestedBy: 'test' },
      { missionId: 'm1', taskId: 't1', workingDir: '/tmp', timeout: 10000, governance: mockGovernance }
    );

    expect(result.evidence.stdoutHash).toBeDefined();
    expect(result.evidence.metadata).toBeDefined();
    expect((result.evidence.metadata as any).success).toBe(true);
  });
});
