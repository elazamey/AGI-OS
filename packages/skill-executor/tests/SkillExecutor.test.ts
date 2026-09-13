import { describe, it, expect, vi } from 'vitest';
import { SkillExecutor } from '../src/SkillExecutor.js';
import { SkillRunner } from '../src/SkillRunner.js';
import { InputValidator } from '../src/InputValidator.js';
import { OutputValidator } from '../src/OutputValidator.js';
import { ExecutionPolicy } from '../src/ExecutionPolicy.js';
import type { SkillHandler } from '../src/types.js';
import type { SkillContract } from '@agi-os/skills';

describe('SkillExecutor', () => {
  const mockHandler: SkillHandler = {
    skillId: 'test.skill',
    category: 'test',
    execute: async (input) => ({ done: true }),
  };

  const mockContract: SkillContract = {
    id: 'test.skill', name: 'Test', version: '1.0.0', description: 'Test',
    category: 'core', capabilities: [], risk: 'LOW',
    requiresApproval: false, requiresNetwork: false, requiresPersistence: false,
    allowedScopes: [], timeoutMs: 10000, retryLimit: 1,
    verification: { required: false, level: 'BASIC' },
  };

  const mockGovernance = {
    intercept: vi.fn().mockReturnValue({ decision: 'ALLOW', riskAssessment: { reason: 'ok' } }),
  } as any;

  const runner = new SkillRunner({
    handlers: new Map([['test.skill', mockHandler]]),
    contracts: new Map([['test.skill', mockContract]]),
    inputValidator: new InputValidator(),
    outputValidator: new OutputValidator(),
    executionPolicy: new ExecutionPolicy(),
  });

  const executor = new SkillExecutor(runner);

  it('should execute via executor entry point', async () => {
    const result = await executor.execute(
      { missionId: 'm1', taskId: 't1', skillId: 'test.skill', input: {}, requestedBy: 'test' },
      { missionId: 'm1', taskId: 't1', workingDir: '/tmp', timeout: 10000, governance: mockGovernance }
    );

    expect(result.success).toBe(true);
    expect(result.output).toEqual({ done: true });
  });
});
