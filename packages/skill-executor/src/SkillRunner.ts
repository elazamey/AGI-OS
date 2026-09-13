import type { SkillExecutionRequest, SkillExecutionResult, SkillHandler, SkillExecutionContext } from './types.js';
import type { SkillContract } from '@agi-os/skills';
import { generateId, hash } from '@agi-os/kernel';
import { normalizeModule, normalizeOperation } from '@agi-os/governance';
import { GovernanceRejectedError, checkScopes, extractGovernanceTarget } from './scope-guard.js';
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

      // 3. Governance intercept.
      //
      // This used to send `module: contract.category` ('filesystem') and
      // `operation: request.skillId` ('filesystem.read'). Every filesystem
      // policy tests `module === 'fs'`, so none of them ever fired and reading
      // /etc/passwd through a "governed" skill returned ALLOW. The gateway now
      // canonicalises its vocabulary, and this call site sends the canonical
      // values explicitly so the audit record is unambiguous.
      //
      // The target is the primary resource, not the whole serialised input:
      // path/URL/table policies match against real values instead of JSON noise.
      const governanceTarget = extractGovernanceTarget(request.input, request.skillId);
      const gateResult = context.governance.intercept({
        id: generateId(),
        module: normalizeModule(contract.category),
        operation: normalizeOperation(request.skillId),
        target: governanceTarget,
        payload: request.input,
        metadata: { skillId: request.skillId, category: contract.category },
      });

      if (gateResult.decision === 'BLOCK') {
        throw new GovernanceRejectedError(
          'BLOCK',
          `Governance blocked ${request.skillId}: ${gateResult.riskAssessment?.reason ?? 'policy denied'}`,
          gateResult.auditRecord?.matchedRuleId ?? null
        );
      }

      if (gateResult.decision === 'REQUIRE_APPROVAL') {
        // Fail closed: an unapproved mutating skill must not execute. The
        // approval request id is surfaced so a caller can approve and retry.
        throw new GovernanceRejectedError(
          'REQUIRE_APPROVAL',
          `Governance requires approval for ${request.skillId}: ${gateResult.riskAssessment?.reason ?? 'policy requires approval'}`,
          gateResult.auditRecord?.matchedRuleId ?? null,
          gateResult.approvalRequest?.id
        );
      }

      // 3b. Capability scopes declared on the contract are enforced here.
      //     They were previously declared on every contract and checked nowhere.
      const scopeViolation = checkScopes(contract, request.input, context.workingDir);
      if (scopeViolation) {
        throw new GovernanceRejectedError('SCOPE_VIOLATION', scopeViolation, 'ALLOWED_SCOPES');
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

      // A governance refusal is a verdict, not a fault. Give it its own code and
      // mark it non-retryable: re-running the identical intent cannot change the
      // decision, and "retryable: true" turned policy denials into retry storms.
      if (err instanceof GovernanceRejectedError) {
        const codeByKind: Record<GovernanceRejectedError['code'], string> = {
          BLOCK: 'GOVERNANCE_BLOCKED',
          REQUIRE_APPROVAL: 'GOVERNANCE_APPROVAL_REQUIRED',
          SCOPE_VIOLATION: 'GOVERNANCE_SCOPE_VIOLATION',
        };
        return {
          success: false,
          error: {
            code: codeByKind[err.code],
            message: error.message,
            retryable: false,
            metadata: { ruleId: err.ruleId, approvalRequestId: err.approvalRequestId },
          },
          evidence: this.createErrorEvidence(request, error.message, startTime),
          duration,
          timestamp: new Date().toISOString(),
        };
      }

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
