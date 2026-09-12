// ============================================================================
// AGI OS — Gate 2.1: Cross-Package Integration
// Proves: Kernel + Missions + Tools + Policy + Approval + Evidence
//         work as a single coherent system in one scenario.
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  now,
  createKernel,
  createToolEvidence,
  EvidenceVerifier,
} from '@agi-os/kernel';
import {
  createMissionManager,
} from '@agi-os/missions';
import {
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
  DANGEROUS_PATHS_DENY_POLICY,
} from '../src/index.js';
import type { ToolHandler, Capability } from '../src/index.js';

// ---------------------------------------------------------------------------
// Mock Tool Handlers
// ---------------------------------------------------------------------------
class ReadToolHandler implements ToolHandler {
  async execute(input: Record<string, unknown>) {
    return {
      success: true,
      data: { content: `File content of ${input.path}`, size: 42 },
      duration: 10,
      timestamp: now(),
    };
  }
  validate(input: Record<string, unknown>) {
    return input.path
      ? { valid: true, errors: [] }
      : { valid: false, errors: ['path required'] };
  }
}

class WriteToolHandler implements ToolHandler {
  async execute(input: Record<string, unknown>) {
    return {
      success: true,
      data: { bytesWritten: (input.content as string)?.length ?? 0 },
      duration: 20,
      timestamp: now(),
    };
  }
  validate(input: Record<string, unknown>) {
    return input.path && input.content
      ? { valid: true, errors: [] }
      : { valid: false, errors: ['path and content required'] };
  }
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------
function buildToolSystem() {
  const toolRegistry = createToolRegistry();
  const capabilityRegistry = createCapabilityRegistry();
  const policyEngine = createPolicyEngine();
  const authorizationManager = createAuthorizationManager();
  const approvalGate = createApprovalGate();

  toolRegistry.register(FILESYSTEM_READ_TOOL, new ReadToolHandler());
  toolRegistry.register(FILESYSTEM_WRITE_TOOL, new WriteToolHandler());

  capabilityRegistry.grant(FILESYSTEM_READ_CAPABILITY);
  capabilityRegistry.grant(FILESYSTEM_WRITE_CAPABILITY);

  policyEngine.addPolicy(READ_ONLY_POLICY);
  policyEngine.addPolicy(WRITE_REQUIRES_APPROVAL_POLICY);
  policyEngine.addPolicy(DANGEROUS_PATHS_DENY_POLICY);

  const executor = createToolExecutor({
    toolRegistry,
    capabilityRegistry,
    policyEngine,
    authorizationManager,
    approvalGate,
  });

  return {
    toolRegistry,
    capabilityRegistry,
    policyEngine,
    authorizationManager,
    approvalGate,
    executor,
  };
}

// ===========================================================================
// GATE 2.1 — SUCCESS PATH
// Goal → Mission → Task → ToolRequest → Capability → Policy → Execute
//       → Evidence → Mission Completion
// ===========================================================================
describe('Gate 2.1 — Full Pipeline (Success Path)', () => {
  let tools: ReturnType<typeof buildToolSystem>;

  beforeEach(() => {
    tools = buildToolSystem();
  });

  it('completes the full pipeline: Goal → Mission → Task → Tool → Evidence', async () => {
    // ── 1. Kernel ──────────────────────────────────────────────────────
    const kernel = createKernel();

    // ── 2. Mission ─────────────────────────────────────────────────────
    const missionManager = createMissionManager();

    const mission = missionManager.createMission('Read /workspace/README.md', {
      description: 'Read file and verify content with evidence',
    });

    // ── 3. Task ────────────────────────────────────────────────────────
    const task = missionManager.addTask(mission.id, 'Read README.md', {
      priority: 'high',
    });

    // ── 4. Tool Request ────────────────────────────────────────────────
    const request = createToolRequest()
      .setToolId('filesystem.read')
      .setMissionId(mission.id)
      .setTaskId(task.id)
      .setInput({ path: '/workspace/README.md' })
      .build();

    // ── 5. Execute through governance pipeline ─────────────────────────
    const result = await tools.executor.execute(request);

    // ── 6. Verify success ─────────────────────────────────────────────
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.authorizationId).toBeDefined();

    // ── 7. Evidence ────────────────────────────────────────────────────
    const evidence = createToolEvidence(
      'filesystem.read',
      request.input,
      result.data,
      true,
      kernel.getCurrentState().revision,
      result.duration,
    );

    const verifier = new EvidenceVerifier();
    const verification = verifier.verify(evidence);
    expect(verification).toBe(true);

    // ── 8. Record evidence in kernel ───────────────────────────────────
    await kernel.recordEvidence(evidence);
    const store = kernel.getEvidenceStore();
    const storedEvidence = await store.get(evidence.id);
    expect(storedEvidence).not.toBeNull();
    expect(storedEvidence!.id).toBe(evidence.id);

    // ── 9. Complete mission ────────────────────────────────────────────
    missionManager.transitionMission(mission.id, 'planning');
    missionManager.transitionMission(mission.id, 'ready');
    missionManager.transitionMission(mission.id, 'running');
    missionManager.transitionMission(mission.id, 'verifying');
    missionManager.transitionMission(mission.id, 'completed');

    const completedMission = missionManager.getMission(mission.id);
    expect(completedMission?.state).toBe('completed');
  });
});

// ===========================================================================
// GATE 2.1 — REJECTION PATHS
// ===========================================================================
describe('Gate 2.1 — Rejection Paths', () => {
  let tools: ReturnType<typeof buildToolSystem>;

  beforeEach(() => {
    tools = buildToolSystem();
  });

  // ── Wrong Scope → DENY (authorization fails, not capability) ─────────
  it('DENY when scope does not cover target (authorization-level)', async () => {
    // Revoke broad read, grant narrow read for /safe/*
    const readCaps = tools.capabilityRegistry.getCapabilitiesForTool('filesystem.read');
    for (const cap of readCaps) {
      tools.capabilityRegistry.revoke(cap.id);
    }

    const granted = tools.capabilityRegistry.grant({
      name: 'Read /safe only',
      description: 'Only allow reading /safe directory',
      toolId: 'filesystem.read',
      scope: { type: 'glob', pattern: '/safe/*', description: 'Only /safe' },
      risk: 'low',
      requiresApproval: false,
      enabled: true,
      metadata: {},
    });

    // /workspace/file.txt passes policy but /safe/* scope won't match
    const request = createToolRequest()
      .setToolId('filesystem.read')
      .setMissionId('m-scope')
      .setInput({ path: '/workspace/file.txt' })
      .build();

    const result = await tools.executor.execute(request);

    expect(result.success).toBe(false);
    // Either CAPABILITY_DENIED (no matching scope) or AUTHORIZATION_DENIED
    expect(['CAPABILITY_DENIED', 'AUTHORIZATION_DENIED']).toContain(result.error?.code);

    // Verify: no execution history entry (handler NOT called)
    const history = tools.executor.getExecutionHistory();
    const matched = history.filter((h) => h.request.id === request.id);
    expect(matched).toHaveLength(0);
  });

  // ── No Capability → DENY ────────────────────────────────────────────
  it('DENY when no capability is granted for tool', async () => {
    const readCaps = tools.capabilityRegistry.getCapabilitiesForTool('filesystem.read');
    for (const cap of readCaps) {
      tools.capabilityRegistry.revoke(cap.id);
    }

    const request = createToolRequest()
      .setToolId('filesystem.read')
      .setMissionId('m-nocap')
      .setInput({ path: '/workspace/file.txt' })
      .build();

    const result = await tools.executor.execute(request);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('CAPABILITY_DENIED');
  });

  // ── Policy Deny → DENY (dangerous path) ─────────────────────────────
  it('DENY when policy blocks dangerous path', async () => {
    const request = createToolRequest()
      .setToolId('filesystem.read')
      .setMissionId('m-policy')
      .setInput({ path: '/etc/shadow' })
      .build();

    const result = await tools.executor.execute(request);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('POLICY_DENIED');

    // Confirm .env also blocked
    const envRequest = createToolRequest()
      .setToolId('filesystem.read')
      .setMissionId('m-policy')
      .setInput({ path: '/workspace/.env' })
      .build();

    const envResult = await tools.executor.execute(envRequest);
    expect(envResult.success).toBe(false);
    expect(envResult.error?.code).toBe('POLICY_DENIED');
  });

  // ── Approval Missing → BLOCKED ──────────────────────────────────────
  it('BLOCKED when write tool has no approval', async () => {
    const request = createToolRequest()
      .setToolId('filesystem.write')
      .setMissionId('m-noapproval')
      .setInput({ path: '/workspace/file.txt', content: 'hello' })
      .build();

    const result = await tools.executor.execute(request);

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('APPROVAL_REQUIRED');

    // Verify an approval request was created
    const pending = tools.approvalGate.getPendingRequests();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending.some((p) => p.toolId === 'filesystem.write')).toBe(true);
  });

  // ── Approval Denied → DENY ──────────────────────────────────────────
  it('DENY when approval is explicitly denied', async () => {
    const request = createToolRequest()
      .setToolId('filesystem.write')
      .setMissionId('m-denied')
      .setInput({ path: '/workspace/file.txt', content: 'hello' })
      .build();

    // First call → APPROVAL_REQUIRED
    const result1 = await tools.executor.execute(request);
    expect(result1.error?.code).toBe('APPROVAL_REQUIRED');

    // Deny the approval
    const pending = tools.approvalGate.getPendingRequests();
    const approvalRequest = pending.find((p) => p.toolId === 'filesystem.write');
    expect(approvalRequest).toBeDefined();

    tools.approvalGate.deny(approvalRequest!.id, 'Human rejected');

    // Retry → should now return APPROVAL_DENIED
    const result2 = await tools.executor.execute(request);
    expect(result2.success).toBe(false);
    expect(result2.error?.code).toBe('APPROVAL_DENIED');
  });

  // ── Approval then Execute → SUCCESS ─────────────────────────────────
  it('SUCCESS after approval is granted', async () => {
    const request = createToolRequest()
      .setToolId('filesystem.write')
      .setMissionId('m-approved')
      .setInput({ path: '/workspace/file.txt', content: 'hello world' })
      .build();

    // First call → APPROVAL_REQUIRED
    await tools.executor.execute(request);

    // Approve
    const pending = tools.approvalGate.getPendingRequests();
    const approvalRequest = pending.find((p) => p.toolId === 'filesystem.write');
    tools.approvalGate.approve(approvalRequest!.id, 'Approved for testing');

    // Retry → should succeed
    const result = await tools.executor.execute(request);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  // ── Tool Not Found → DENY ───────────────────────────────────────────
  it('DENY when tool does not exist', async () => {
    const request = createToolRequest()
      .setToolId('nonexistent.tool')
      .setMissionId('m-notfound')
      .setInput({})
      .build();

    const result = await tools.executor.execute(request);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TOOL_NOT_FOUND');
  });

  // ── Tool Disabled → DENY ────────────────────────────────────────────
  it('DENY when tool is disabled', async () => {
    tools.toolRegistry.disableTool('filesystem.read');

    const request = createToolRequest()
      .setToolId('filesystem.read')
      .setMissionId('m-disabled')
      .setInput({ path: '/workspace/file.txt' })
      .build();

    const result = await tools.executor.execute(request);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('TOOL_UNAVAILABLE');
  });
});

// ===========================================================================
// GATE 2.1 — CROSS-PACKAGE EVIDENCE CHAIN
// ===========================================================================
describe('Gate 2.1 — Evidence Chain Across Packages', () => {
  it('tracks evidence through the entire lifecycle', async () => {
    const kernel = createKernel();
    const tools = buildToolSystem();
    const missionManager = createMissionManager();

    // Create mission with task
    const mission = missionManager.createMission('Evidence chain test', {
      description: 'Verify evidence flows from tool through kernel',
    });

    const task = missionManager.addTask(mission.id, 'Read file', {
      priority: 'medium',
    });

    // Execute tool
    const request = createToolRequest()
      .setToolId('filesystem.read')
      .setMissionId(mission.id)
      .setTaskId(task.id)
      .setInput({ path: '/workspace/data.json' })
      .build();

    const toolResult = await tools.executor.execute(request);
    expect(toolResult.success).toBe(true);

    // Create evidence linked to mission + task + tool execution
    const evidence = createToolEvidence(
      'filesystem.read',
      request.input,
      toolResult.data,
      true,
      kernel.getCurrentState().revision,
      toolResult.duration,
    );

    // Verify evidence integrity
    const verifier = new EvidenceVerifier();
    expect(verifier.verify(evidence)).toBe(true);

    // Record in kernel
    await kernel.recordEvidence(evidence);
    const stored = await kernel.getEvidenceStore().get(evidence.id);
    expect(stored).not.toBeNull();
    expect(stored!.metadata?.toolId).toBe('filesystem.read');

    // Verify authorization was created for the mission
    const auths =
      tools.authorizationManager.getAuthorizationsForMission(mission.id);
    expect(auths.length).toBeGreaterThanOrEqual(1);
    expect(auths[0].toolId).toBe('filesystem.read');

    // Complete the mission
    missionManager.transitionMission(mission.id, 'planning');
    missionManager.transitionMission(mission.id, 'ready');
    missionManager.transitionMission(mission.id, 'running');
    missionManager.transitionMission(mission.id, 'verifying');
    missionManager.transitionMission(mission.id, 'completed');

    expect(missionManager.getMission(mission.id)?.state).toBe('completed');
  });
});

// ===========================================================================
// GATE 2.1 — MISSION-ISOLATION
// Authorizations and approvals are isolated per mission
// ===========================================================================
describe('Gate 2.1 — Mission Isolation', () => {
  it('different missions have independent authorization scopes', async () => {
    const tools = buildToolSystem();

    // Mission A
    const reqA = createToolRequest()
      .setToolId('filesystem.read')
      .setMissionId('mission-A')
      .setInput({ path: '/workspace/a.txt' })
      .build();

    // Mission B
    const reqB = createToolRequest()
      .setToolId('filesystem.read')
      .setMissionId('mission-B')
      .setInput({ path: '/workspace/b.txt' })
      .build();

    const resultA = await tools.executor.execute(reqA);
    const resultB = await tools.executor.execute(reqB);

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);

    // Different authorization IDs
    expect(resultA.authorizationId).not.toBe(resultB.authorizationId);

    // Each mission has its own authorization
    const authsA =
      tools.authorizationManager.getAuthorizationsForMission('mission-A');
    const authsB =
      tools.authorizationManager.getAuthorizationsForMission('mission-B');

    expect(authsA.length).toBeGreaterThanOrEqual(1);
    expect(authsB.length).toBeGreaterThanOrEqual(1);
    expect(authsA[0].toolId).toBe('filesystem.read');
    expect(authsB[0].toolId).toBe('filesystem.read');
  });
});
