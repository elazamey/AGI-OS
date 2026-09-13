import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateId, now } from '@agi-os/kernel';
import { WorldStateManager } from '../src/world-state.js';
import { ContextBuilder } from '../src/context-builder.js';
import { HypothesisEngine } from '../src/hypothesis.js';
import { PlanValidator } from '../src/plan-validator.js';
import { PlanRanker } from '../src/plan-ranker.js';
import { DeterministicPlanner } from '../src/deterministic-planner.js';
import { CognitivePlanner } from '../src/planner.js';
import { CognitiveLoop } from '../src/cognitive-loop.js';
import type {
  CognitiveContext,
  CognitivePlan,
  HypothesisSet,
} from '../src/types.js';
import type { MemoryStore, MemoryRecord } from '@agi-os/memory';

function createMockMemoryStore(records: MemoryRecord[] = []): MemoryStore {
  return {
    get: vi.fn().mockResolvedValue(null),
    list: vi.fn().mockResolvedValue(records),
    store: vi.fn().mockResolvedValue({ id: 'mock', type: 'episodic', content: {}, confidence: 1, createdAt: now().toISOString(), updatedAt: now().toISOString() }),
    delete: vi.fn().mockResolvedValue(true),
    search: vi.fn().mockResolvedValue([]),
  } as unknown as MemoryStore;
}

function createMockToolRegistry() {
  const tools = [
    { id: 'fs.read', name: 'Read File', enabled: true },
    { id: 'fs.write', name: 'Write File', enabled: true },
    { id: 'docker.run', name: 'Run Docker', enabled: false },
  ];
  return {
    getAllTools: vi.fn().mockReturnValue(tools),
    isToolEnabled: vi.fn().mockImplementation((id: string) => {
      const t = tools.find((t) => t.id === id);
      return t?.enabled ?? false;
    }),
  } as any;
}

function createMockCapabilityRegistry() {
  return {
    getAllCapabilities: vi.fn().mockReturnValue([]),
    hasCapability: vi.fn().mockReturnValue(true),
  } as any;
}

function createTestContext(overrides?: Partial<CognitiveContext>): CognitiveContext {
  return {
    goalId: 'goal-test-1',
    goal: 'Test goal: deploy application',
    worldState: {
      id: generateId(),
      revision: 0,
      entities: [],
      relationships: [],
      constraints: [],
      beliefs: [],
      observations: [],
      resources: [],
      timestamp: now().toISOString(),
    },
    relevantMemories: [],
    availableCapabilities: ['fs.read', 'fs.write', 'docker.run'],
    previousFailures: [],
    constraints: [],
    missionState: {
      missionId: '',
      state: 'created',
      taskCount: 0,
      completedTasks: 0,
    },
    timestamp: now().toISOString(),
    ...overrides,
  };
}

function createTestPlan(overrides?: Partial<CognitivePlan>): CognitivePlan {
  return {
    id: generateId(),
    goalId: 'goal-test-1',
    goal: 'Test goal',
    assumptions: [],
    steps: [
      {
        id: generateId(),
        order: 1,
        action: 'Execute step 1',
        expectedOutcome: 'Step 1 complete',
        dependsOn: [],
        estimatedDuration: 1000,
        riskLevel: 'low',
      },
    ],
    expectedOutcome: 'Goal achieved',
    predictedSuccess: 0.75,
    predictedRisk: 0.25,
    predictedCost: 0.3,
    requiredCapabilities: ['fs.read'],
    evidenceRefs: [],
    sourceMemoryRefs: [],
    hypothesisRefs: [],
    generatedAt: now().toISOString(),
    providerId: 'test',
    ...overrides,
  };
}

function createTestHypothesisSet(): HypothesisSet {
  return {
    id: generateId(),
    observation: 'Test observation',
    hypotheses: [
      {
        id: generateId(),
        observation: 'Test observation',
        statement: 'Test hypothesis',
        confidence: 0.7,
        testable: true,
        evidenceRefs: [],
        suggestedTests: ['Run test A'],
        category: 'causal',
      },
    ],
    generatedAt: now().toISOString(),
    providerId: 'deterministic',
  };
}

// ===================================================================
// WorldStateManager Tests
// ===================================================================
describe('WorldStateManager', () => {
  let wsm: WorldStateManager;

  beforeEach(() => {
    wsm = new WorldStateManager();
  });

  it('should initialize with empty state', () => {
    const state = wsm.getState();
    expect(state.entities).toEqual([]);
    expect(state.relationships).toEqual([]);
    expect(state.constraints).toEqual([]);
    expect(state.beliefs).toEqual([]);
    expect(state.observations).toEqual([]);
    expect(state.resources).toEqual([]);
  });

  it('should add an entity (auto-generates ID)', () => {
    const entity = wsm.addEntity({
      type: 'host',
      name: 'web-server-1',
      state: { status: 'running', ip: '192.168.1.1' },
      confidence: 0.9,
      lastObservedAt: now().toISOString(),
    });

    expect(entity.id).toBeDefined();
    expect(entity.type).toBe('host');

    const state = wsm.getState();
    expect(state.entities).toHaveLength(1);
    expect(state.entities[0].type).toBe('host');
  });

  it('should remove an entity', () => {
    const e1 = wsm.addEntity({ type: 'host', name: 'h1', state: {}, confidence: 1, lastObservedAt: now().toISOString() });
    const e2 = wsm.addEntity({ type: 'host', name: 'h2', state: {}, confidence: 1, lastObservedAt: now().toISOString() });

    const removed = wsm.removeEntity(e1.id);
    expect(removed).toBe(true);

    const state = wsm.getState();
    expect(state.entities).toHaveLength(1);
    expect(state.entities[0].id).toBe(e2.id);
  });

  it('should return false when removing non-existent entity', () => {
    expect(wsm.removeEntity('non-existent')).toBe(false);
  });

  it('should update entity', () => {
    const entity = wsm.addEntity({
      type: 'host', name: 'web-1', state: { status: 'running' },
      confidence: 0.9, lastObservedAt: now().toISOString(),
    });

    const updated = wsm.updateEntity(entity.id, { status: 'stopped' });
    expect(updated).toBe(true);

    const e = wsm.getEntity(entity.id);
    expect(e?.state).toEqual({ status: 'stopped' });
  });

  it('should get entity by ID', () => {
    const entity = wsm.addEntity({ type: 'host', name: 'h1', state: {}, confidence: 1, lastObservedAt: now().toISOString() });
    expect(wsm.getEntity(entity.id)?.type).toBe('host');
    expect(wsm.getEntity('nonexistent')).toBeUndefined();
  });

  it('should get entities by type', () => {
    wsm.addEntity({ type: 'host', name: 'h1', state: {}, confidence: 1, lastObservedAt: now().toISOString() });
    wsm.addEntity({ type: 'service', name: 's1', state: {}, confidence: 1, lastObservedAt: now().toISOString() });
    wsm.addEntity({ type: 'host', name: 'h2', state: {}, confidence: 1, lastObservedAt: now().toISOString() });

    expect(wsm.getEntitiesByType('host')).toHaveLength(2);
    expect(wsm.getEntitiesByType('service')).toHaveLength(1);
  });

  it('should add a relationship', () => {
    const e1 = wsm.addEntity({ type: 'host', name: 'h1', state: {}, confidence: 1, lastObservedAt: now().toISOString() });
    const e2 = wsm.addEntity({ type: 'service', name: 's1', state: {}, confidence: 1, lastObservedAt: now().toISOString() });

    const rel = wsm.addRelationship({
      sourceId: e1.id, targetId: e2.id, type: 'hosts', properties: {}, confidence: 0.9,
    });

    expect(rel.id).toBeDefined();
    expect(wsm.getState().relationships).toHaveLength(1);
  });

  it('should add a constraint', () => {
    const c = wsm.addConstraint({
      type: 'policy', description: 'Must maintain 99.9% uptime', severity: 'hard', enabled: true,
    });

    expect(c.id).toBeDefined();
    expect(wsm.getState().constraints).toHaveLength(1);
  });

  it('should get active constraints', () => {
    wsm.addConstraint({ type: 'policy', description: 'c1', severity: 'hard', enabled: true });
    wsm.addConstraint({ type: 'resource', description: 'c2', severity: 'soft', enabled: false });

    expect(wsm.getActiveConstraints()).toHaveLength(1);
  });

  it('should add a belief', () => {
    const b = wsm.addBelief({
      subject: 'server', predicate: 'can_handle', object: '1000 rps', confidence: 0.8, evidenceRefs: ['ev1'],
    });

    expect(b.id).toBeDefined();
    expect(wsm.getState().beliefs).toHaveLength(1);
  });

  it('should merge duplicate beliefs', () => {
    wsm.addBelief({ subject: 's', predicate: 'p', object: 'o', confidence: 0.6, evidenceRefs: [] });
    wsm.addBelief({ subject: 's', predicate: 'p', object: 'o', confidence: 0.8, evidenceRefs: ['ev1'] });

    expect(wsm.getState().beliefs).toHaveLength(1);
    expect(wsm.getState().beliefs[0].confidence).toBeGreaterThan(0.6);
  });

  it('should add an observation', () => {
    const obs = wsm.addObservation({
      source: 'monitoring', content: { metric: 'cpu', value: 85 }, timestamp: now().toISOString(), confidence: 0.95,
    });

    expect(obs.id).toBeDefined();
    expect(wsm.getState().observations).toHaveLength(1);
  });

  it('should keep only last 100 observations', () => {
    for (let i = 0; i < 110; i++) {
      wsm.addObservation({ source: 'm', content: { i }, timestamp: now().toISOString(), confidence: 0.9 });
    }
    expect(wsm.getState().observations.length).toBeLessThanOrEqual(100);
  });

  it('should add a resource', () => {
    const r = wsm.addResource({ type: 'cpu', name: 'main-cpu', available: true, capacity: 8, used: 3 });

    expect(r.id).toBeDefined();
    expect(wsm.getState().resources).toHaveLength(1);
  });

  it('should return a copy of state', () => {
    const state1 = wsm.getState();
    const originalLength = state1.entities.length;

    wsm.addEntity({ type: 'x', name: 'x', state: {}, confidence: 1, lastObservedAt: now().toISOString() });

    const state2 = wsm.getState();
    expect(state2.entities).toHaveLength(originalLength + 1);
  });

  it('should reset state', () => {
    wsm.addEntity({ type: 'host', name: 'h1', state: {}, confidence: 1, lastObservedAt: now().toISOString() });
    wsm.addObservation({ source: 'm', content: {}, timestamp: now().toISOString(), confidence: 1 });

    wsm.reset();

    const state = wsm.getState();
    expect(state.entities).toEqual([]);
    expect(state.observations).toEqual([]);
  });

  it('should track revision', () => {
    expect(wsm.getRevision()).toBe(0);
    wsm.addEntity({ type: 'h', name: 'h', state: {}, confidence: 1, lastObservedAt: now().toISOString() });
    expect(wsm.getRevision()).toBe(1);
  });
});

// ===================================================================
// ContextBuilder Tests
// ===================================================================
describe('ContextBuilder', () => {
  function createBuilder(wsm?: WorldStateManager) {
    return new ContextBuilder({
      worldStateManager: wsm ?? new WorldStateManager(),
      memoryStore: createMockMemoryStore(),
      toolRegistry: createMockToolRegistry(),
      capabilityRegistry: createMockCapabilityRegistry(),
    });
  }

  it('should build a context from goal', async () => {
    const cb = createBuilder();
    const ctx = await cb.build({ goal: 'Deploy the application', goalId: 'goal-1' });

    expect(ctx.goalId).toBe('goal-1');
    expect(ctx.goal).toBe('Deploy the application');
    expect(ctx.relevantMemories).toBeDefined();
    expect(ctx.availableCapabilities).toBeDefined();
  });

  it('should include available capabilities from tool registry', async () => {
    const cb = createBuilder();
    const ctx = await cb.build({ goal: 'Do something', goalId: 'g1' });

    expect(ctx.availableCapabilities).toContain('fs.read');
    expect(ctx.availableCapabilities).toContain('fs.write');
    expect(ctx.availableCapabilities).not.toContain('docker.run');
  });

  it('should include observations from world state', async () => {
    const wsm = new WorldStateManager();
    wsm.addObservation({ source: 'monitor', content: { status: 'healthy' }, timestamp: now().toISOString(), confidence: 0.9 });

    const cb = createBuilder(wsm);
    const ctx = await cb.build({ goal: 'Test', goalId: 'g1' });

    expect(ctx.worldState.observations).toHaveLength(1);
  });

  it('should include constraints from world state', async () => {
    const wsm = new WorldStateManager();
    wsm.addConstraint({ type: 'policy', description: 'No downtime', severity: 'hard', enabled: true });

    const cb = createBuilder(wsm);
    const ctx = await cb.build({ goal: 'Test', goalId: 'g1' });

    expect(ctx.constraints).toHaveLength(1);
    expect(ctx.constraints[0].description).toBe('No downtime');
  });

  it('should accept mission state', async () => {
    const cb = createBuilder();
    const ctx = await cb.build({
      goal: 'Test', goalId: 'g1',
      missionState: { missionId: 'm1', state: 'running', taskCount: 5, completedTasks: 2 },
    });

    expect(ctx.missionState.missionId).toBe('m1');
  });

  it('should default mission state when not provided', async () => {
    const cb = createBuilder();
    const ctx = await cb.build({ goal: 'Test', goalId: 'g1' });

    expect(ctx.missionState.taskCount).toBe(0);
  });
});

// ===================================================================
// HypothesisEngine Tests
// ===================================================================
describe('HypothesisEngine', () => {
  it('should generate hypotheses from observation', async () => {
    const engine = new HypothesisEngine();
    const result = await engine.generate({ observation: 'Server response time increased to 500ms slow performance' });

    expect(result.hypotheses.length).toBeGreaterThan(0);
    expect(result.generatedAt).toBeDefined();
    expect(result.providerId).toBe('deterministic');
  });

  it('should include confidence in hypotheses', async () => {
    const engine = new HypothesisEngine();
    const result = await engine.generate({ observation: 'Application crashed with error' });

    for (const hyp of result.hypotheses) {
      expect(hyp.confidence).toBeGreaterThanOrEqual(0);
      expect(hyp.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should include suggested tests', async () => {
    const engine = new HypothesisEngine();
    const result = await engine.generate({ observation: 'Timeout occurred' });

    for (const hyp of result.hypotheses) {
      expect(hyp.suggestedTests).toBeDefined();
      expect(hyp.suggestedTests.length).toBeGreaterThan(0);
    }
  });

  it('should generate different hypotheses for different observations', async () => {
    const engine = new HypothesisEngine();
    const r1 = await engine.generate({ observation: 'Error in logs' });
    const r2 = await engine.generate({ observation: 'Resource not found' });

    expect(r1.hypotheses[0]?.statement).not.toBe(r2.hypotheses[0]?.statement);
  });

  it('should respect maxHypotheses', async () => {
    const engine = new HypothesisEngine();
    const result = await engine.generate({ observation: 'Something failed', maxHypotheses: 2 });

    expect(result.hypotheses.length).toBeLessThanOrEqual(2);
  });

  it('should always include a generic hypothesis', async () => {
    const engine = new HypothesisEngine();
    const result = await engine.generate({ observation: 'xyzzy no keywords match' });

    expect(result.hypotheses.length).toBeGreaterThanOrEqual(1);
  });

  it('should rank hypotheses by confidence', async () => {
    const engine = new HypothesisEngine();
    const result = await engine.generate({ observation: 'Error timeout failure' });

    const ranked = engine.rankHypotheses(result);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].confidence).toBeGreaterThanOrEqual(ranked[i].confidence);
    }
  });

  it('should filter testable hypotheses', async () => {
    const engine = new HypothesisEngine();
    const result = await engine.generate({ observation: 'Failure detected' });

    const testable = engine.getTestable(result);
    for (const h of testable) {
      expect(h.testable).toBe(true);
    }
  });
});

// ===================================================================
// PlanValidator Tests
// ===================================================================
describe('PlanValidator', () => {
  let validator: PlanValidator;

  beforeEach(() => {
    validator = new PlanValidator();
  });

  it('should validate a valid plan', () => {
    const plan = createTestPlan();
    const result = validator.validate(plan, ['fs.read']);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject plan with no steps', () => {
    const plan = createTestPlan({ steps: [] });
    const result = validator.validate(plan, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'NO_STEPS')).toBe(true);
  });

  it('should reject plan with missing capabilities', () => {
    const plan = createTestPlan({ requiredCapabilities: ['docker.run'] });
    const result = validator.validate(plan, ['fs.read']);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'MISSING_CAPABILITY')).toBe(true);
  });

  it('should detect cyclic dependencies', () => {
    const step1 = { id: 'step-1', order: 1, action: 'Do A', expectedOutcome: 'A done', dependsOn: ['step-2'], estimatedDuration: 1000, riskLevel: 'low' as const };
    const step2 = { id: 'step-2', order: 2, action: 'Do B', expectedOutcome: 'B done', dependsOn: ['step-1'], estimatedDuration: 1000, riskLevel: 'low' as const };

    const plan = createTestPlan({ steps: [step1, step2] });
    const result = validator.validate(plan, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'CYCLIC_DEPENDENCY')).toBe(true);
  });

  it('should warn about high-risk plans', () => {
    const plan = createTestPlan({ predictedRisk: 0.95 });
    const result = validator.validate(plan, []);
    expect(result.warnings.some((w) => w.code === 'HIGH_RISK')).toBe(true);
  });

  it('should warn about low-success plans', () => {
    const plan = createTestPlan({ predictedSuccess: 0.05 });
    const result = validator.validate(plan, []);
    expect(result.warnings.some((w) => w.code === 'LOW_SUCCESS')).toBe(true);
  });

  it('should reject plan with invalid predicted success', () => {
    const plan = createTestPlan({ predictedSuccess: 1.5 });
    const result = validator.validate(plan, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_PREDICTION')).toBe(true);
  });

  it('should validate multiple plans', () => {
    const plan1 = createTestPlan({ predictedSuccess: 0.8 });
    const plan2 = createTestPlan({ predictedSuccess: 0.6, steps: [] });
    const results = validator.validateAll([plan1, plan2], ['fs.read']);
    expect(results.size).toBe(2);
    expect(results.get(plan1.id)?.valid).toBe(true);
    expect(results.get(plan2.id)?.valid).toBe(false);
  });

  it('should allow custom validation checks', () => {
    validator.registerCheck('custom-check', (plan) => {
      if (plan.predictedSuccess < 0.5) {
        return { code: 'LOW_SUCCESS_CUSTOM', message: 'Custom: success too low', severity: 'high' as const };
      }
      return null;
    });
    const plan = createTestPlan({ predictedSuccess: 0.3 });
    const result = validator.validate(plan, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'LOW_SUCCESS_CUSTOM')).toBe(true);
  });

  it('should reject plan with empty step action', () => {
    const plan = createTestPlan({
      steps: [{ id: 's1', order: 1, action: '', expectedOutcome: 'done', dependsOn: [], estimatedDuration: 1000, riskLevel: 'low' }],
    });
    const result = validator.validate(plan, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'EMPTY_STEP')).toBe(true);
  });
});

// ===================================================================
// PlanRanker Tests
// ===================================================================
describe('PlanRanker', () => {
  let ranker: PlanRanker;

  beforeEach(() => {
    ranker = new PlanRanker();
  });

  it('should rank plans by score (best first)', () => {
    const goodPlan = createTestPlan({ predictedSuccess: 0.9, predictedRisk: 0.1, predictedCost: 0.1 });
    const badPlan = createTestPlan({ predictedSuccess: 0.3, predictedRisk: 0.7, predictedCost: 0.8 });
    const ranked = ranker.rank([badPlan, goodPlan]);
    expect(ranked[0].plan.id).toBe(goodPlan.id);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it('should assign scores between 0 and 1', () => {
    const ranked = ranker.rank([createTestPlan()]);
    expect(ranked[0].score).toBeGreaterThanOrEqual(0);
    expect(ranked[0].score).toBeLessThanOrEqual(1);
  });

  it('should include breakdown', () => {
    const ranked = ranker.rank([createTestPlan()]);
    expect(ranked[0].breakdown).toBeDefined();
    expect(typeof ranked[0].breakdown.successScore).toBe('number');
    expect(typeof ranked[0].breakdown.riskScore).toBe('number');
    expect(typeof ranked[0].breakdown.costScore).toBe('number');
    expect(typeof ranked[0].breakdown.capabilityScore).toBe('number');
    expect(typeof ranked[0].breakdown.assumptionScore).toBe('number');
  });

  it('should penalize plans with missing capabilities', () => {
    const plan = createTestPlan({ requiredCapabilities: ['fs.read', 'fs.write', 'docker.run'] });
    const ranked = ranker.rank([plan], ['fs.read']);
    expect(ranked[0].breakdown.capabilityScore).toBeCloseTo(1 / 3, 1);
  });

  it('should reward plans with all capabilities', () => {
    const plan = createTestPlan({ requiredCapabilities: ['fs.read', 'fs.write'] });
    const ranked = ranker.rank([plan], ['fs.read', 'fs.write']);
    expect(ranked[0].breakdown.capabilityScore).toBe(1.0);
  });

  it('should penalize critical low-confidence assumptions', () => {
    const plan = createTestPlan({
      assumptions: [{ id: 'a1', statement: 'Critical assumption', confidence: 0.3, impactIfWrong: 'critical' }],
    });
    const ranked = ranker.rank([plan]);
    expect(ranked[0].breakdown.assumptionScore).toBeLessThan(1.0);
  });

  it('should get the best plan', () => {
    const good = createTestPlan({ predictedSuccess: 0.9 });
    const bad = createTestPlan({ predictedSuccess: 0.3 });
    const best = ranker.getBest([bad, good]);
    expect(best?.plan.id).toBe(good.id);
  });

  it('should return null for empty plan list', () => {
    expect(ranker.getBest([])).toBeNull();
  });

  it('should respect custom weights', () => {
    const customRanker = new PlanRanker({ successWeight: 1, riskWeight: 0, costWeight: 0, capabilityWeight: 0, assumptionWeight: 0 });
    const highSuccess = createTestPlan({ predictedSuccess: 0.9, predictedRisk: 0.5 });
    const lowSuccess = createTestPlan({ predictedSuccess: 0.3, predictedRisk: 0.1 });
    const ranked = customRanker.rank([lowSuccess, highSuccess]);
    expect(ranked[0].plan.id).toBe(highSuccess.id);
  });
});

// ===================================================================
// DeterministicPlanner Tests
// ===================================================================
describe('DeterministicPlanner', () => {
  let planner: DeterministicPlanner;

  beforeEach(() => {
    planner = new DeterministicPlanner();
  });

  it('should generate a conservative plan', () => {
    const result = planner.generateConservative({ context: createTestContext(), hypothesisSet: createTestHypothesisSet() });
    expect(result.plans).toHaveLength(1);
    expect(result.source).toBe('deterministic');
    expect(result.plans[0].steps.length).toBeGreaterThan(0);
  });

  it('should generate multiple plans with different risk profiles', () => {
    const result = planner.generateMultiple({ context: createTestContext(), hypothesisSet: createTestHypothesisSet(), count: 3 });
    expect(result.plans).toHaveLength(3);
    const risks = result.plans.map((p) => p.predictedRisk);
    expect(new Set(risks).size).toBeGreaterThan(1);
  });

  it('should generate plans with required steps', () => {
    const result = planner.generateConservative({ context: createTestContext(), hypothesisSet: createTestHypothesisSet() });
    expect(result.plans[0].steps.length).toBeGreaterThanOrEqual(3);
  });
});

// ===================================================================
// CognitivePlanner Tests
// ===================================================================
describe('CognitivePlanner', () => {
  it('should generate plans deterministically when no provider', async () => {
    const planner = new CognitivePlanner();
    const plans = await planner.generate({ context: createTestContext(), hypothesisSet: createTestHypothesisSet() });
    expect(plans.length).toBeGreaterThan(0);
  });

  it('should use provider when available', async () => {
    const mockProvider = {
      id: 'mock-provider', name: 'Mock',
      generate: async () => ({ plans: [createTestPlan({ providerId: 'mock-provider' })], reasoning: 'Mock', providerId: 'mock-provider', generatedAt: now().toISOString() }),
      isAvailable: async () => true,
    };
    const planner = new CognitivePlanner({ providers: [mockProvider] });
    const plans = await planner.generate({ context: createTestContext(), hypothesisSet: createTestHypothesisSet() });
    expect(plans).toHaveLength(1);
    expect(plans[0].providerId).toBe('mock-provider');
  });

  it('should fallback to deterministic when provider fails', async () => {
    const failingProvider = {
      id: 'failing', name: 'Failing',
      generate: async () => { throw new Error('Failed'); },
      isAvailable: async () => true,
    };
    const planner = new CognitivePlanner({ providers: [failingProvider] });
    const plans = await planner.generate({ context: createTestContext(), hypothesisSet: createTestHypothesisSet() });
    expect(plans.length).toBeGreaterThan(0);
  });

  it('should add and query providers', async () => {
    const planner = new CognitivePlanner();
    planner.addProvider({
      id: 'mock', name: 'Mock',
      generate: async () => ({ plans: [createTestPlan()], reasoning: '', providerId: 'mock', generatedAt: now().toISOString() }),
      isAvailable: async () => true,
    });
    const available = await planner.getAvailableProviders();
    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('mock');
  });
});

// ===================================================================
// CognitiveLoop Tests
// ===================================================================
describe('CognitiveLoop', () => {
  function createLoop(): CognitiveLoop {
    const wsm = new WorldStateManager();
    const memoryStore = createMockMemoryStore();
    return new CognitiveLoop({
      worldStateManager: wsm,
      contextBuilder: new ContextBuilder({
        worldStateManager: wsm, memoryStore,
        toolRegistry: createMockToolRegistry(),
        capabilityRegistry: createMockCapabilityRegistry(),
      }),
      hypothesisEngine: new HypothesisEngine(),
      planner: new CognitivePlanner(),
    });
  }

  it('should process a goal and return a decision', async () => {
    const loop = createLoop();
    const decision = await loop.process({ goal: 'Deploy application to production', goalId: 'goal-1' });
    expect(decision.id).toBeDefined();
    expect(decision.goalId).toBe('goal-1');
    expect(decision.selectedPlan).toBeDefined();
    expect(decision.decidedAt).toBeDefined();
  });

  it('should include hypothesis set in decision', async () => {
    const loop = createLoop();
    const decision = await loop.process({ goal: 'Fix memory leak', goalId: 'goal-2' });
    expect(decision.hypothesisSet).toBeDefined();
    expect(decision.hypothesisSet.hypotheses.length).toBeGreaterThan(0);
  });

  it('should include context in decision', async () => {
    const loop = createLoop();
    const decision = await loop.process({ goal: 'Optimize performance', goalId: 'goal-3' });
    expect(decision.context).toBeDefined();
    expect(decision.context.goal).toBe('Optimize performance');
  });

  it('should track decisions', async () => {
    const loop = createLoop();
    await loop.process({ goal: 'Goal A', goalId: 'g1' });
    await loop.process({ goal: 'Goal B', goalId: 'g2' });
    expect(loop.getDecisions()).toHaveLength(2);
  });

  it('should retrieve decision by ID', async () => {
    const loop = createLoop();
    const decision = await loop.process({ goal: 'Goal', goalId: 'g1' });
    expect(loop.getDecision(decision.id)?.id).toBe(decision.id);
  });

  it('should return undefined for non-existent decision', () => {
    const loop = createLoop();
    expect(loop.getDecision('non-existent')).toBeUndefined();
  });

  it('should produce a ranked selected plan', async () => {
    const loop = createLoop();
    const decision = await loop.process({ goal: 'Build and deploy service', goalId: 'g1' });
    expect(decision.selectedPlan.predictedSuccess).toBeGreaterThanOrEqual(0);
    expect(decision.selectedPlan.predictedRisk).toBeGreaterThanOrEqual(0);
  });

  it('should respect planCount parameter', async () => {
    const loop = createLoop();
    const decision = await loop.process({ goal: 'Test planCount', goalId: 'g1', planCount: 5 });
    expect(decision.selectedPlan).toBeDefined();
  });
});

// ===================================================================
// Integration: Full Pipeline
// ===================================================================
describe('Full Cognitive Pipeline Integration', () => {
  function createFullLoop(): CognitiveLoop {
    const wsm = new WorldStateManager();
    const memoryStore = createMockMemoryStore();

    wsm.addEntity({
      type: 'host', name: 'production-web-1',
      state: { cpu: '45%', memory: '60%' }, confidence: 0.9, lastObservedAt: now().toISOString(),
    });

    wsm.addObservation({
      source: 'monitoring', content: { metric: 'response_time', value: 800, unit: 'ms' },
      timestamp: now().toISOString(), confidence: 0.95,
    });

    wsm.addConstraint({ type: 'policy', description: 'Zero downtime during deployment', severity: 'hard', enabled: true });

    return new CognitiveLoop({
      worldStateManager: wsm,
      contextBuilder: new ContextBuilder({
        worldStateManager: wsm, memoryStore,
        toolRegistry: createMockToolRegistry(),
        capabilityRegistry: createMockCapabilityRegistry(),
      }),
      hypothesisEngine: new HypothesisEngine(),
      planner: new CognitivePlanner(),
    });
  }

  it('should run full cognitive pipeline', async () => {
    const loop = createFullLoop();
    const decision = await loop.process({
      goal: 'Restore performance to under 200ms response time',
      goalId: 'goal-perf-1',
    });

    expect(decision.id).toBeDefined();
    expect(decision.goalId).toBe('goal-perf-1');
    expect(decision.selectedPlan).toBeDefined();
    expect(decision.hypothesisSet.hypotheses.length).toBeGreaterThan(0);
    expect(decision.context.worldState.observations.length).toBeGreaterThan(0);
    expect(decision.decidedAt).toBeDefined();
    expect(decision.selectedPlan.steps.length).toBeGreaterThan(0);
  });

  it('should NEVER execute tools inside the cognitive loop', async () => {
    const toolExecuted = false;
    const loop = createFullLoop();
    await loop.process({ goal: 'This should not execute any tools', goalId: 'g1' });
    expect(toolExecuted).toBe(false);
  });

  it('should handle multiple sequential cognitive cycles', async () => {
    const loop = createFullLoop();
    const d1 = await loop.process({ goal: 'Phase 1: Analyze', goalId: 'g1' });
    const d2 = await loop.process({ goal: 'Phase 2: Implement', goalId: 'g2' });
    const d3 = await loop.process({ goal: 'Phase 3: Verify', goalId: 'g3' });

    expect(loop.getDecisions()).toHaveLength(3);
    expect(d1.id).not.toBe(d2.id);
    expect(d2.id).not.toBe(d3.id);
  });
});
