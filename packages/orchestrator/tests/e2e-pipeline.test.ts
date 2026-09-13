import { describe, it, expect, beforeEach } from 'vitest';
import { generateId, now } from '@agi-os/kernel';
import { MissionManager } from '@agi-os/missions';
import { InMemoryMemoryStore, WorkingMemory, SemanticMemory } from '@agi-os/memory';
import { ReflectionEngine } from '@agi-os/reflection';
import { SelfModel } from '@agi-os/self-model';
import { GovernanceGateway, PolicyDecision } from '@agi-os/governance';
import type { ReflectionInput } from '@agi-os/reflection';
import { EventLoop } from '@agi-os/orchestrator';

// ===========================================================================
// E2E Integration Tests — Phases 0-10
// ===========================================================================
describe('AGI OS — End-to-End Pipeline Integration (Phases 0-10)', () => {
  let missionManager: MissionManager;
  let memoryStore: InMemoryMemoryStore;
  let workingMemory: WorkingMemory;
  let semanticMemory: SemanticMemory;
  let reflection: ReflectionEngine;
  let selfModel: SelfModel;
  let governance: GovernanceGateway;

  beforeEach(() => {
    missionManager = new MissionManager();
    memoryStore = new InMemoryMemoryStore();
    workingMemory = new WorkingMemory(memoryStore);
    semanticMemory = new SemanticMemory(memoryStore);
    reflection = new ReflectionEngine();
    selfModel = new SelfModel();
    governance = new GovernanceGateway();
  });

  // -----------------------------------------------------------------------
  // Safe Path: read → ALLOW → execute → reflect → memorize
  // -----------------------------------------------------------------------
  it('Safe path: read → ALLOW → execute → reflect → memorize → telemetry', async () => {
    // 1. Create mission
    const mission = missionManager.createMission('Audit workspace configuration', {
      description: 'Read and verify config.json exists',
    });
    expect(mission.state).toBe('created');

    // 2. Add task
    const task = missionManager.addTask(mission.id, 'Read config', {
      description: 'Read local config.json',
    });
    expect(task).toBeDefined();

    // 3. Start mission
    missionManager.startMission(mission.id);
    const started = missionManager.getMission(mission.id);
    expect(started?.state).toBe('running');

    // 4. Governance interception — safe read
    const intent = {
      id: generateId(),
      module: 'fs',
      operation: 'read',
      target: './config.json',
    };
    const gateResult = governance.intercept(intent);
    expect(gateResult.decision).toBe(PolicyDecision.ALLOW);

    // 5. Simulate tool execution success
    const toolSuccess = true;
    const toolDuration = 25;

    // 6. Reflection
    const reflectionInput: ReflectionInput = {
      missionId: mission.id,
      goalId: mission.id,
      goal: mission.goal,
      planId: 'plan-e2e-1',
      predictedSuccess: 0.9,
      predictedRisk: 0.1,
      expectedOutcome: 'config.json read successfully',
      actualOutcome: 'config.json read successfully',
      success: toolSuccess,
      duration: toolDuration,
      evidenceRefs: [],
      sourceEventIds: [],
      timestamp: now().toISOString(),
    };
    const output = await reflection.reflect(reflectionInput);
    expect(output.reflection).toBeDefined();
    expect(output.reflection.outcome.success).toBe(true);

    // 7. Memorize lesson
    const fact = await semanticMemory.storeFact({
      subject: 'E2E',
      predicate: 'verified',
      object: 'workspace config',
      source: 'e2e-test',
    });
    expect(fact).toBeDefined();

    // 8. Self-model telemetry
    selfModel.processEvent({
      type: 'tool_success',
      timestamp: now().toISOString(),
      data: { toolId: 'fs_read', durationMs: toolDuration },
    });
    const snapshot = selfModel.snapshot();
    expect(snapshot).toBeDefined();

    // 9. Audit trail
    const auditHistory = governance.getAuditHistory();
    expect(auditHistory.length).toBeGreaterThanOrEqual(1);
    expect(auditHistory[0].decision).toBe(PolicyDecision.ALLOW);

    // 10. Complete task then mission (pending → ready → running → completed)
    const taskManager = missionManager.getTaskManager(mission.id);
    if (taskManager) {
      const tasks = taskManager.getTasksByState('pending');
      for (const t of tasks) {
        taskManager.transitionTask(t.id, 'ready');
        taskManager.transitionTask(t.id, 'running');
        taskManager.transitionTask(t.id, 'completed');
      }
    }
    missionManager.completeMission(mission.id);
    const completed = missionManager.getMission(mission.id);
    expect(completed?.state).toBe('completed');
  });

  // -----------------------------------------------------------------------
  // Escalation Path: write → REQUIRE_APPROVAL → no execution
  // -----------------------------------------------------------------------
  it('Escalation path: write → REQUIRE_APPROVAL → queued → no execution', async () => {
    const mission = missionManager.createMission('Update production config', {
      description: 'Write new values to config.json',
    });

    // A workspace-relative file write is now explicitly allowed (POL-009), so
    // it can no longer demonstrate the escalation path. Writing production
    // configuration is the action that genuinely requires a human: no policy
    // permits it, and the fail-closed default queues an approval instead of
    // silently allowing the write.
    const intent = {
      id: generateId(),
      module: 'config',
      operation: 'write',
      target: 'production/config.json',
    };

    const gateResult = governance.intercept(intent);
    expect(gateResult.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    expect(gateResult.approvalRequest).toBeDefined();

    // Verify audit recorded
    const audit = governance.getAuditHistory();
    expect(audit.length).toBe(1);
    expect(audit[0].decision).toBe(PolicyDecision.REQUIRE_APPROVAL);

    // Verify approval is pending
    const pending = governance.getPendingApprovals();
    expect(pending.length).toBe(1);

    // Reflection on the blocked outcome
    const reflectionInput: ReflectionInput = {
      missionId: mission.id,
      goalId: mission.id,
      goal: mission.goal,
      planId: 'plan-e2e-2',
      predictedSuccess: 0.8,
      predictedRisk: 0.2,
      expectedOutcome: 'config.json updated',
      actualOutcome: 'Action requires approval — not executed',
      success: false,
      duration: 0,
      evidenceRefs: [gateResult.auditRecord.id],
      sourceEventIds: [],
      timestamp: now().toISOString(),
    };
    const output = await reflection.reflect(reflectionInput);
    expect(output.reflection.outcome.success).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Blocked Path: .env read → POL-001 BLOCK → no execution
  // -----------------------------------------------------------------------
  it('Blocked path: .env read → POL-001 → BLOCK → audit → lesson', async () => {
    const intent = {
      id: generateId(),
      module: 'fs',
      operation: 'read',
      target: './.env',
    };

    const gateResult = governance.intercept(intent);
    expect(gateResult.decision).toBe(PolicyDecision.BLOCK);
    expect(gateResult.auditRecord.matchedRuleId).toBe('POL-001');

    // Self-model records the failure
    selfModel.processEvent({
      type: 'tool_failure',
      timestamp: now().toISOString(),
      data: { toolId: 'fs_read_env', error: 'POL-001 BLOCK' },
    });

    const snapshot = selfModel.snapshot();
    expect(snapshot).toBeDefined();

    // Reflection generates a lesson
    const reflectionInput: ReflectionInput = {
      missionId: 'mission-blocked',
      goalId: 'goal-blocked',
      goal: 'Read .env file',
      planId: 'plan-blocked',
      predictedSuccess: 0.5,
      predictedRisk: 0.5,
      expectedOutcome: '.env file read',
      actualOutcome: 'BLOCKED by POL-001: sensitive file access denied',
      success: false,
      duration: 0,
      evidenceRefs: [gateResult.auditRecord.id],
      sourceEventIds: [],
      timestamp: now().toISOString(),
    };
    const output = await reflection.reflect(reflectionInput);
    expect(output.reflection.outcome.success).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Invariant: every action goes through governance
  // -----------------------------------------------------------------------
  it('Invariant: every action goes through governance before execution', () => {
    const actions = [
      { module: 'fs', operation: 'read', target: './README.md' },
      { module: 'fs', operation: 'write', target: './output.txt' },
      { module: 'db', operation: 'insert', target: 'users' },
      { module: 'exec', operation: 'execute', target: 'ls -la' },
      { module: 'fs', operation: 'read', target: './.env' },
    ];

    for (const action of actions) {
      const result = governance.intercept({ id: generateId(), ...action });
      expect(result.decision).toBeDefined();
      expect(result.riskAssessment).toBeDefined();
      expect(result.auditRecord).toBeDefined();
    }

    const history = governance.getAuditHistory();
    expect(history.length).toBe(5);
  });

  // -----------------------------------------------------------------------
  // Memory: store and retrieve facts
  // -----------------------------------------------------------------------
  it('Memory: store facts via semantic memory and retrieve', async () => {
    await semanticMemory.storeFact({
      subject: 'AGI-OS',
      predicate: 'has_test_count',
      object: '823',
      source: 'e2e-test',
    });

    await semanticMemory.storeFact({
      subject: 'AGI-OS',
      predicate: 'has_packages',
      object: '11',
      source: 'e2e-test',
    });

    const facts = await semanticMemory.queryBySubject('AGI-OS');
    expect(facts.length).toBe(2);

    const searchResults = await semanticMemory.search('has_test_count');
    expect(searchResults.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Working memory: initialize and track
  // -----------------------------------------------------------------------
  it('Working memory: initialize and track mission context', async () => {
    const record = await workingMemory.initialize('mission-e2e', 'Run full diagnostics');
    expect(record).toBeDefined();

    const goal = await workingMemory.getCurrentGoal();
    expect(goal).toBe('Run full diagnostics');

    await workingMemory.addObservation({
      source: 'e2e-test',
      content: { type: 'diagnostic', value: 'all systems operational' },
      confidence: 1.0,
    });

    const observations = await workingMemory.getObservations();
    expect(observations.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // Self-model: record tool events and get snapshot
  // -----------------------------------------------------------------------
  it('Self-model: track tool reliability across events', () => {
    selfModel.processEvent({
      type: 'tool_success',
      timestamp: now().toISOString(),
      data: { toolId: 'fs_read', durationMs: 10 },
    });
    selfModel.processEvent({
      type: 'tool_success',
      timestamp: now().toISOString(),
      data: { toolId: 'fs_read', durationMs: 12 },
    });
    selfModel.processEvent({
      type: 'tool_failure',
      timestamp: now().toISOString(),
      data: { toolId: 'fs_write', error: 'permission denied' },
    });

    const snapshot = selfModel.snapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot.overallHealth).toBeGreaterThanOrEqual(0);
    expect(snapshot.overallHealth).toBeLessThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // EventLoop: full cycle with adapters
  // -----------------------------------------------------------------------
  it('EventLoop: full perceive → plan → execute → reflect → memorize cycle', async () => {
    const mission = missionManager.createMission('Full pipeline test', {
      description: 'Test the complete cognitive loop',
    });

    // Perceiver adapter
    let perceiveCount = 0;
    const perceiver = {
      perceive: () => {
        if (perceiveCount > 0) return null;
        perceiveCount++;
        const m = missionManager.getMission(mission.id);
        if (!m) return null;
        return { goal: m.goal, goalId: m.id, context: { missionState: m.state } };
      },
    };

    // Plannable adapter
    const plannable = {
      plan: (params: { goal: string; goalId: string; context: unknown }) => ({
        planId: generateId(),
        missionId: params.goalId,
        steps: [{ id: 's1', description: 'Read workspace file' }],
        expectedOutcome: 'File read',
        predictedSuccess: 0.9,
      }),
    };

    // Executable adapter (governance-intercepted)
    const executable = {
      execute: async (params: {
        planId: string;
        missionId: string;
        steps: Array<{ id: string; description: string }>;
      }) => {
        const intent = {
          id: generateId(),
          module: 'fs',
          operation: 'read',
          target: './README.md',
        };
        const gate = governance.intercept(intent);
        return {
          missionId: params.missionId,
          success: gate.decision === PolicyDecision.ALLOW,
          actualOutcome: gate.decision === PolicyDecision.ALLOW
            ? 'File read successfully'
            : `Blocked: ${gate.decision}`,
          duration: 10,
          evidenceRefs: [gate.auditRecord.id],
        };
      },
    };

    // Reflectable adapter
    const reflectable = {
      reflect: async (params: {
        missionId: string;
        goalId: string;
        goal: string;
        planId: string;
        outcome: { success: boolean; actualOutcome: string; duration: number };
      }) => {
        const input: ReflectionInput = {
          missionId: params.missionId,
          goalId: params.goalId,
          goal: params.goal,
          planId: params.planId,
          predictedSuccess: 0.9,
          predictedRisk: 0.1,
          expectedOutcome: 'success',
          actualOutcome: params.outcome.actualOutcome,
          success: params.outcome.success,
          duration: params.outcome.duration,
          evidenceRefs: [],
          sourceEventIds: [],
          timestamp: now().toISOString(),
        };
        const output = await reflection.reflect(input);
        return { lessonsCount: output.lessonsUpdated, memoryWrites: output.memoryWrites };
      },
    };

    // Memorizable adapter
    const memorizable = {
      memorize: async (writes: unknown[]) => {
        for (const w of writes) {
          await memoryStore.save({
            id: generateId(),
            type: 'semantic',
            content: w as Record<string, unknown>,
            createdAt: now().toISOString(),
            updatedAt: now().toISOString(),
          });
        }
      },
    };

    const eventLoop = new EventLoop({
      perceivable: perceiver,
      plannable,
      executable,
      reflectable,
      memorizable,
      config: {
        maxIterations: 2,
        idleDelayMs: 1,
        enableReflection: true,
        enableMemoryWrite: true,
      },
    });

    const stats = await eventLoop.run();

    expect(stats.totalIterations).toBe(2);
    expect(stats.successfulIterations).toBeGreaterThanOrEqual(1);

    // Governance produced audit records
    const audit = governance.getAuditHistory();
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Governance: consistent policy enforcement across domains
  // -----------------------------------------------------------------------
  it('Governance: consistent policy enforcement across all domains', () => {
    const testCases = [
      { intent: { id: '1', module: 'fs', operation: 'read', target: './README.md' }, expected: PolicyDecision.ALLOW },
      { intent: { id: '2', module: 'fs', operation: 'read', target: './.env' }, expected: PolicyDecision.BLOCK },
      { intent: { id: '3', module: 'fs', operation: 'read', target: '~/.ssh/id_rsa' }, expected: PolicyDecision.BLOCK },
      { intent: { id: '4', module: 'db', operation: 'insert', target: 'users' }, expected: PolicyDecision.REQUIRE_APPROVAL },
      { intent: { id: '5', module: 'db', operation: 'drop', target: 'sessions' }, expected: PolicyDecision.REQUIRE_APPROVAL },
      { intent: { id: '6', module: 'exec', operation: 'execute', target: 'rm -rf /' }, expected: PolicyDecision.BLOCK },
      { intent: { id: '7', module: 'fs', operation: 'write', target: '/usr/bin/custom' }, expected: PolicyDecision.BLOCK },
    ];

    for (const tc of testCases) {
      const result = governance.intercept(tc.intent);
      expect(result.decision).toBe(tc.expected);
    }
  });

  // -----------------------------------------------------------------------
  // Audit ledger: append-only across mixed workload
  // -----------------------------------------------------------------------
  it('Audit ledger: append-only and queryable across mixed workload', async () => {
    governance.intercept({ id: 'a1', module: 'fs', operation: 'read', target: './README.md' });
    governance.intercept({ id: 'a2', module: 'fs', operation: 'read', target: './.env' });
    governance.intercept({ id: 'a3', module: 'db', operation: 'insert', target: 'users' });
    governance.intercept({ id: 'a4', module: 'exec', operation: 'execute', target: 'ls' });

    const history = governance.getAuditHistory();
    expect(history.length).toBe(4);

    const stats = governance.getAuditStats();
    expect(stats.total).toBe(4);
  });
});
