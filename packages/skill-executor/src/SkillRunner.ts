import type { SkillExecutionRequest, SkillExecutionResult, SkillHandler, SkillExecutionContext } from './types.js';
import type { SkillContract } from '@agi-os/skills';
import { generateId, hash } from '@agi-os/kernel';
import type { InputValidator } from './InputValidator.js';
import type { OutputValidator } from './OutputValidator.js';
import type { ExecutionPolicy } from './ExecutionPolicy.js';

export class SkillRunner {
  constructor(private deps: {
    handlers: Map<string, SkillHandler>;
    contracts: Map<string, SkillContract>;
    inputValidator: InputValidator;
    outputValidator: OutputValidator;
    executionPolicy: ExecutionPolicy;
  }) {}

  async execute(
    request: SkillExecutionRequest,
    context: SkillExecutionContext
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const handler = this.deps.handlers.get(request.skillId);
    const contract = this.deps.contracts.get(request.skillId);

    if (!handler || !contract) {
      return {
        success: false,
        error: { code: 'SKILL_NOT_FOUND', message: `Skill ${request.skillId} is not registered`, retryable: false },
        evidence: this.createErrorEvidence(request, 'Skill not found', startTime),
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // 1. Check execution policy
      const policyResult = await this.deps.executionPolicy.check(contract, request.missionId);
      if (!policyResult.allowed) {
        throw new Error(`Policy violation: ${policyResult.reason ?? 'Execution blocked'}`);
      }

      // 2. Validate input
      await this.deps.inputValidator.validate(request.input, contract.inputSchema as Record<string, unknown> | undefined);

      // 3. Governance intercept
      const gateResult = context.governance.intercept({
        id: generateId(),
        module: contract.category,
        operation: request.skillId,
        target: JSON.stringify(request.input),
        payload: request.input,
      });

      if (gateResult.decision === 'BLOCK') {
        throw new Error(`Governance blocked: ${gateResult.riskAssessment.reason}`);
      }

      // 4. Execute skill
      const output = await handler.execute(request.input, context);

      // 5. Validate output
      await this.deps.outputValidator.validate(output, contract.outputSchema as Record<string, unknown> | undefined);

      const duration = Date.now() - startTime;
      const outputStr = JSON.stringify(output);
      const inputStr = JSON.stringify(request.input);

      // 6. Create evidence
      const evidence = {
        id: generateId(),
        operation: `skill.${request.skillId}`,
        command: request.skillId,
        args: Object.values(request.input).map(String),
        exitCode: 0,
        stdout: outputStr,
        stdoutHash: hash(outputStr),
        timestamp: new Date(),
        stateRevision: 'current',
        duration,
        metadata: {
          skillId: request.skillId,
          missionId: request.missionId,
          taskId: request.taskId,
          inputHash: hash(inputStr),
          success: true,
        },
      };

      return {
        success: true,
        output,
        evidence,
        duration,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      const duration = Date.now() - startTime;

      return {
        success: false,
        error: {
          code: 'EXECUTION_FAILED',
          message: error.message,
          retryable: true,
        },
        evidence: this.createErrorEvidence(request, error.message, startTime),
        duration,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private createErrorEvidence(request: SkillExecutionRequest, error: string, startTime: number) {
    const inputStr = JSON.stringify(request.input);
    return {
      id: generateId(),
      operation: `skill.${request.skillId}`,
      command: request.skillId,
      exitCode: 1,
      stderr: error,
      stderrHash: hash(error),
      timestamp: new Date(),
      stateRevision: 'current',
      duration: Date.now() - startTime,
      metadata: {
        skillId: request.skillId,
        missionId: request.missionId,
        taskId: request.taskId,
        inputHash: hash(inputStr),
        success: false,
      },
    };
  }
}
