import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolRegistry,
  CapabilityRegistry,
  PolicyEngine,
  AuthorizationManager,
  ApprovalGate,
  ToolExecutor,
  createToolRegistry,
  createCapabilityRegistry,
  createPolicyEngine,
  createAuthorizationManager,
  createApprovalGate,
  createToolExecutor,
  createToolRequest,
  FILESYSTEM_READ_TOOL,
  FILESYSTEM_WRITE_TOOL,
  FILESYSTEM_READ_CAPABILITY,
  FILESYSTEM_WRITE_CAPABILITY,
  READ_ONLY_POLICY,
  WRITE_REQUIRES_APPROVAL_POLICY,
  DANGEROUS_PATHS_DENY_POLICY
} from '../src/index.js';
import type { ToolHandler, ToolExecutionRequest } from '../src/types.js';

// ---------------------------------------------------------------------------
// Mock Tool Handler
// ---------------------------------------------------------------------------
class MockFileReadHandler implements ToolHandler {
  async execute(input: Record<string, unknown>) {
    const path = input.path as string;
    return {
      success: true,
      data: { content: `Content of ${path}`, size: 100 },
      duration: 50,
      timestamp: new Date()
    };
  }
}

class MockFileWriteHandler implements ToolHandler {
  async execute(input: Record<string, unknown>) {
    const path = input.path as string;
    const content = input.content as string;
    return {
      success: true,
      data: { bytesWritten: content.length },
      duration: 100,
      timestamp: new Date()
    };
  }
}

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------
describe('Tool System Integration', () => {
  let toolRegistry: ToolRegistry;
  let capabilityRegistry: CapabilityRegistry;
  let policyEngine: PolicyEngine;
  let authorizationManager: AuthorizationManager;
  let approvalGate: ApprovalGate;
  let executor: ToolExecutor;

  beforeEach(() => {
    toolRegistry = createToolRegistry();
    capabilityRegistry = createCapabilityRegistry();
    policyEngine = createPolicyEngine();
    authorizationManager = createAuthorizationManager();
    approvalGate = createApprovalGate();

    // Register tools
    toolRegistry.register(FILESYSTEM_READ_TOOL, new MockFileReadHandler());
    toolRegistry.register(FILESYSTEM_WRITE_TOOL, new MockFileWriteHandler());

    // Grant capabilities
    capabilityRegistry.grant(FILESYSTEM_READ_CAPABILITY);
    capabilityRegistry.grant(FILESYSTEM_WRITE_CAPABILITY);

    // Add policies
    policyEngine.addPolicy(READ_ONLY_POLICY);
    policyEngine.addPolicy(WRITE_REQUIRES_APPROVAL_POLICY);
    policyEngine.addPolicy(DANGEROUS_PATHS_DENY_POLICY);

    // Create executor
    executor = createToolExecutor({
      toolRegistry,
      capabilityRegistry,
      policyEngine,
      authorizationManager,
      approvalGate
    });
  });

  describe('READ-ONLY Tool Execution', () => {
    it('should execute read tool successfully', async () => {
      const request = createToolRequest()
        .setToolId('filesystem.read')
        .setMissionId('mission-1')
        .setInput({ path: '/workspace/file.txt' })
        .build();

      const result = await executor.execute(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.authorizationId).toBeDefined();
    });

    it('should deny read to dangerous paths', async () => {
      const request = createToolRequest()
        .setToolId('filesystem.read')
        .setMissionId('mission-1')
        .setInput({ path: '/etc/passwd' })
        .build();

      const result = await executor.execute(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('POLICY_DENIED');
    });

    it('should deny read to .env files', async () => {
      const request = createToolRequest()
        .setToolId('filesystem.read')
        .setMissionId('mission-1')
        .setInput({ path: '/workspace/.env' })
        .build();

      const result = await executor.execute(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('POLICY_DENIED');
    });
  });

  describe('WRITE Tool Execution', () => {
    it('should require approval for write tool', async () => {
      const request = createToolRequest()
        .setToolId('filesystem.write')
        .setMissionId('mission-1')
        .setInput({ path: '/workspace/file.txt', content: 'Hello' })
        .build();

      const result = await executor.execute(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('APPROVAL_REQUIRED');
    });

    it('should execute write after approval', async () => {
      const request = createToolRequest()
        .setToolId('filesystem.write')
        .setMissionId('mission-1')
        .setInput({ path: '/workspace/file.txt', content: 'Hello' })
        .build();

      // First request - needs approval
      const result1 = await executor.execute(request);
      expect(result1.success).toBe(false);
      expect(result1.error?.code).toBe('APPROVAL_REQUIRED');

      // Get the pending approval
      const pendingApprovals = approvalGate.getPendingRequests();
      expect(pendingApprovals.length).toBeGreaterThan(0);

      // Approve
      approvalGate.approve(pendingApprovals[0].id, 'Approved for testing');

      // Retry request
      const result2 = await executor.execute(request);
      expect(result2.success).toBe(true);
    });

    it('should deny write after approval denied', async () => {
      const request = createToolRequest()
        .setToolId('filesystem.write')
        .setMissionId('mission-1')
        .setInput({ path: '/workspace/file.txt', content: 'Hello' })
        .build();

      // First request - needs approval
      await executor.execute(request);

      // Get the pending approval
      const pendingApprovals = approvalGate.getPendingRequests();

      // Deny
      approvalGate.deny(pendingApprovals[0].id, 'Not approved');

      // Retry request
      const result = await executor.execute(request);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('APPROVAL_DENIED');
    });
  });

  describe('Tool Not Found', () => {
    it('should return error for non-existent tool', async () => {
      const request = createToolRequest()
        .setToolId('non.existent')
        .setMissionId('mission-1')
        .setInput({})
        .build();

      const result = await executor.execute(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_NOT_FOUND');
    });
  });

  describe('Tool Disabled', () => {
    it('should return error for disabled tool', async () => {
      toolRegistry.disableTool('filesystem.read');

      const request = createToolRequest()
        .setToolId('filesystem.read')
        .setMissionId('mission-1')
        .setInput({ path: '/workspace/file.txt' })
        .build();

      const result = await executor.execute(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_UNAVAILABLE');
    });
  });

  describe('Capability Check', () => {
    it('should deny tool without capability', async () => {
      // Remove all capabilities
      const caps = capabilityRegistry.getAllCapabilities();
      for (const cap of caps) {
        capabilityRegistry.revoke(cap.id);
      }

      const request = createToolRequest()
        .setToolId('filesystem.read')
        .setMissionId('mission-1')
        .setInput({ path: '/workspace/file.txt' })
        .build();

      const result = await executor.execute(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CAPABILITY_DENIED');
    });
  });

  describe('Execution History', () => {
    it('should track execution history', async () => {
      const request = createToolRequest()
        .setToolId('filesystem.read')
        .setMissionId('mission-1')
        .setInput({ path: '/workspace/file.txt' })
        .build();

      await executor.execute(request);
      await executor.execute(request);

      const history = executor.getExecutionHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('Authorization Flow', () => {
    it('should create authorization on first execution', async () => {
      const request = createToolRequest()
        .setToolId('filesystem.read')
        .setMissionId('mission-1')
        .setInput({ path: '/workspace/file.txt' })
        .build();

      const result = await executor.execute(request);

      expect(result.authorizationId).toBeDefined();

      // Check authorization exists
      const auth = authorizationManager.getAuthorization(result.authorizationId!);
      expect(auth).toBeDefined();
      expect(auth!.toolId).toBe('filesystem.read');
      expect(auth!.missionId).toBe('mission-1');
    });

    it('should reuse existing authorization', async () => {
      const request = createToolRequest()
        .setToolId('filesystem.read')
        .setMissionId('mission-1')
        .setInput({ path: '/workspace/file.txt' })
        .build();

      const result1 = await executor.execute(request);
      const result2 = await executor.execute(request);

      // Should use same authorization
      expect(result1.authorizationId).toBe(result2.authorizationId);
    });
  });

  describe('Mission Integration', () => {
    it('should isolate authorizations by mission', async () => {
      const request1 = createToolRequest()
        .setToolId('filesystem.read')
        .setMissionId('mission-1')
        .setInput({ path: '/workspace/file.txt' })
        .build();

      const request2 = createToolRequest()
        .setToolId('filesystem.read')
        .setMissionId('mission-2')
        .setInput({ path: '/workspace/file.txt' })
        .build();

      const result1 = await executor.execute(request1);
      const result2 = await executor.execute(request2);

      // Different missions should have different authorizations
      expect(result1.authorizationId).not.toBe(result2.authorizationId);
    });
  });
});
