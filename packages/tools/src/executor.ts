// ============================================================================
// AGI OS - Tool Executor
// Orchestrates tool execution with governance
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  ToolExecutionRequest,
  ToolExecutionResult,
  ToolContext,
  ToolConfig,
} from './types.js';
import type { ToolRegistry } from './tool-registry.js';
import type { CapabilityRegistry } from './capability.js';
import type { PolicyEngine } from './policy.js';
import type { AuthorizationManager } from './authorization.js';
import type { ApprovalGate } from './approval.js';

// ---------------------------------------------------------------------------
// Tool Executor
// ---------------------------------------------------------------------------
export class ToolExecutor {
  private toolRegistry: ToolRegistry;
  private capabilityRegistry: CapabilityRegistry;
  private policyEngine: PolicyEngine;
  private authorizationManager: AuthorizationManager;
  private approvalGate: ApprovalGate;
  private config: ToolConfig;
  private executionHistory: Array<{
    request: ToolExecutionRequest;
    result: ToolExecutionResult;
  }> = [];

  constructor(params: {
    toolRegistry: ToolRegistry;
    capabilityRegistry: CapabilityRegistry;
    policyEngine: PolicyEngine;
    authorizationManager: AuthorizationManager;
    approvalGate: ApprovalGate;
    config?: Partial<ToolConfig>;
  }) {
    this.toolRegistry = params.toolRegistry;
    this.capabilityRegistry = params.capabilityRegistry;
    this.policyEngine = params.policyEngine;
    this.authorizationManager = params.authorizationManager;
    this.approvalGate = params.approvalGate;
    this.config = {
      defaultTimeout: 30000,
      maxConcurrentExecutions: 5,
      requireApprovalForCritical: true,
      auditEnabled: true,
      rateLimitEnabled: false,
      rateLimitWindow: 60000,
      rateLimitMax: 100,
      ...params.config
    };
  }

  /**
   * Execute a tool
   */
  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // 1. Check tool exists
    const tool = this.toolRegistry.getTool(request.toolId);
    if (!tool) {
      return this.createErrorResult(
        request,
        'TOOL_NOT_FOUND',
        `Tool not found: ${request.toolId}`,
        startTime
      );
    }

    // 2. Check tool is enabled
    if (!this.toolRegistry.isToolEnabled(request.toolId)) {
      return this.createErrorResult(
        request,
        'TOOL_UNAVAILABLE',
        `Tool is disabled: ${request.toolId}`,
        startTime
      );
    }

    // 3. Validate input
    const handler = this.toolRegistry.getHandler(request.toolId);
    if (handler?.validate) {
      const validation = handler.validate(request.input);
      if (!validation.valid) {
        return this.createErrorResult(
          request,
          'INPUT_VALIDATION_ERROR',
          `Input validation failed: ${validation.errors.join(', ')}`,
          startTime
        );
      }
    }

    // 4. Check capabilities
    const hasCapability = this.capabilityRegistry.hasCapability(request.toolId);
    if (!hasCapability) {
      return this.createErrorResult(
        request,
        'CAPABILITY_DENIED',
        `No capability granted for tool: ${request.toolId}`,
        startTime
      );
    }

    // 5. Evaluate policy
    const policyDecision = this.policyEngine.evaluate(
      request.toolId,
      request.input,
      {
        missionId: request.missionId,
        taskId: request.taskId
      }
    );

    if (policyDecision.effect === 'deny') {
      return this.createErrorResult(
        request,
        'POLICY_DENIED',
        `Policy denied: ${policyDecision.reason}`,
        startTime
      );
    }

    if (policyDecision.effect === 'approval_required') {
      // Check if we have existing approval
      const existingApproval = this.findExistingApproval(request);
      if (!existingApproval) {
        // Request approval
        const approvalRequest = this.approvalGate.requestApproval({
          toolId: request.toolId,
          missionId: request.missionId,
          taskId: request.taskId,
          input: request.input,
          risk: tool.risk,
          reason: `Policy requires approval: ${policyDecision.reason}`
        });

        return this.createErrorResult(
          request,
          'APPROVAL_REQUIRED',
          `Approval required. Request ID: ${approvalRequest.id}`,
          startTime,
          undefined,
          approvalRequest.id
        );
      }

      if (existingApproval.status !== 'approved') {
        return this.createErrorResult(
          request,
          'APPROVAL_DENIED',
          `Approval denied: ${existingApproval.resolution?.reason}`,
          startTime
        );
      }
    }

    // 6. Check authorization
    const auth = this.findValidAuthorization(request);
    if (!auth) {
      // Create temporary authorization
      const capability = this.capabilityRegistry.findMatchingCapabilities(
        request.toolId,
        this.getTargetFromInput(request.input)
      )[0];

      if (capability) {
        const newAuth = this.authorizationManager.grant({
          capabilityId: capability.id,
          toolId: request.toolId,
          scope: capability.scope,
          missionId: request.missionId,
          grantedBy: 'system',
          ttl: this.config.defaultTimeout
        });

        // Continue with new authorization
        return this.executeWithHandler(request, handler, newAuth.id, startTime);
      }

      return this.createErrorResult(
        request,
        'AUTHORIZATION_DENIED',
        `No valid authorization for tool: ${request.toolId}`,
        startTime
      );
    }

    // 7. Execute tool
    return this.executeWithHandler(request, handler, auth.id, startTime);
  }

  /**
   * Execute tool with handler
   */
  private async executeWithHandler(
    request: ToolExecutionRequest,
    handler: any,
    authorizationId: string | undefined,
    startTime: number
  ): Promise<ToolExecutionResult> {
    try {
      const context: ToolContext = {
        missionId: request.missionId,
        taskId: request.taskId,
        authorizationId,
        metadata: request.metadata
      };

      const result = await handler.execute(request.input, context);

      // Record execution
      this.toolRegistry.recordExecution(
        request.toolId,
        result.duration,
        result.success
      );

      // Add to history
      this.executionHistory.push({ request, result });

      return {
        ...result,
        authorizationId
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Record failed execution
      this.toolRegistry.recordExecution(request.toolId, duration, false);

      return this.createErrorResult(
        request,
        'EXECUTION_ERROR',
        error instanceof Error ? error.message : 'Unknown execution error',
        startTime
      );
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(): Array<{
    request: ToolExecutionRequest;
    result: ToolExecutionResult;
  }> {
    return [...this.executionHistory];
  }

  /**
   * Get config
   */
  getConfig(): ToolConfig {
    return { ...this.config };
  }

  /**
   * Get tool registry
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Get capability registry
   */
  getCapabilityRegistry(): CapabilityRegistry {
    return this.capabilityRegistry;
  }

  /**
   * Get policy engine
   */
  getPolicyEngine(): PolicyEngine {
    return this.policyEngine;
  }

  /**
   * Get authorization manager
   */
  getAuthorizationManager(): AuthorizationManager {
    return this.authorizationManager;
  }

  /**
   * Get approval gate
   */
  getApprovalGate(): ApprovalGate {
    return this.approvalGate;
  }

  /**
   * Find existing approval for request
   */
  private findExistingApproval(request: ToolExecutionRequest) {
    const allApprovals = this.approvalGate.getAllRequests();
    return allApprovals.find(
      (a) =>
        a.toolId === request.toolId &&
        a.missionId === request.missionId &&
        JSON.stringify(a.input) === JSON.stringify(request.input)
    );
  }

  /**
   * Find valid authorization
   */
  private findValidAuthorization(request: ToolExecutionRequest) {
    const auths = this.authorizationManager.getAuthorizationsForMission(
      request.missionId
    );
    return auths.find(
      (a) => a.toolId === request.toolId && this.authorizationManager.isValid(a.id)
    );
  }

  /**
   * Get target from input
   */
  private getTargetFromInput(input: Record<string, unknown>): string {
    if (input.path) return String(input.path);
    if (input.url) return String(input.url);
    if (input.command) return String(input.command);
    return '*';
  }

  /**
   * Create error result
   */
  private createErrorResult(
    _request: ToolExecutionRequest,
    code: string,
    message: string,
    startTime: number,
    details?: Record<string, unknown>,
    _approvalId?: string
  ): ToolExecutionResult {
    return {
      success: false,
      error: {
        code: code as any,
        message,
        details,
        retryable: false
      },
      authorizationId: undefined,
      duration: Date.now() - startTime,
      timestamp: now()
    };
  }

}

// ---------------------------------------------------------------------------
// Tool Executor Factory
// ---------------------------------------------------------------------------
export function createToolExecutor(params: {
  toolRegistry: ToolRegistry;
  capabilityRegistry: CapabilityRegistry;
  policyEngine: PolicyEngine;
  authorizationManager: AuthorizationManager;
  approvalGate: ApprovalGate;
  config?: Partial<ToolConfig>;
}): ToolExecutor {
  return new ToolExecutor(params);
}

// ---------------------------------------------------------------------------
// Tool Request Builder
// ---------------------------------------------------------------------------
export class ToolRequestBuilder {
  private toolId: string = '';
  private missionId: string = '';
  private taskId?: string;
  private input: Record<string, unknown> = {};
  private requester: string = 'system';
  private metadata: Record<string, unknown> = {};

  setToolId(toolId: string): this {
    this.toolId = toolId;
    return this;
  }

  setMissionId(missionId: string): this {
    this.missionId = missionId;
    return this;
  }

  setTaskId(taskId: string): this {
    this.taskId = taskId;
    return this;
  }

  setInput(input: Record<string, unknown>): this {
    this.input = input;
    return this;
  }

  setRequester(requester: string): this {
    this.requester = requester;
    return this;
  }

  setMetadata(metadata: Record<string, unknown>): this {
    this.metadata = metadata;
    return this;
  }

  build(): ToolExecutionRequest {
    return {
      id: generateId(),
      toolId: this.toolId,
      missionId: this.missionId,
      taskId: this.taskId,
      input: this.input,
      timestamp: now(),
      requester: this.requester,
      metadata: this.metadata
    };
  }
}

export function createToolRequest(): ToolRequestBuilder {
  return new ToolRequestBuilder();
}
