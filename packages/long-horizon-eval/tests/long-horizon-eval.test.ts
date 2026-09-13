import { describe, it, expect } from 'vitest';
import {
  TrajectoryRecorder, TrajectoryScorer,
  DelayedAttackTester, AdaptiveAdversary,
  MemoryDriftTester, MemoryInterferenceTester,
  UncertaintyPropagator, InteractiveUserSimulator,
  ScaffoldSensitivityTester,
} from '../src/index.js';

// ============================================================================
// G15 — Long-Horizon / 2026 Evaluation (40 tests)
// ============================================================================

// Trajectory Recording & Scoring (7 tests)
describe('G15 — Long-Horizon: Trajectory', () => {
  it('TRJ-001: recorder loads', () => { expect(TrajectoryRecorder).toBeDefined(); });
  it('TRJ-002: records steps', () => { const r = new TrajectoryRecorder(); r.record({ id: '1', goal: 'fix bug', observation: 'found', decision: 'patch', action: 'write', result: 'ok', timestamp: '', risk: 0.2 }); expect(r.getStepCount()).toBe(1); });
  it('TRJ-003: scorer loads', () => { expect(TrajectoryScorer).toBeDefined(); });
  it('TRJ-004: empty trajectory scores zero', () => { const s = new TrajectoryScorer(); const r = s.score([], 'goal'); expect(r.goalAdherence).toBe(0); expect(r.completed).toBe(false); });
  it('TRJ-005: aligned trajectory scores high', () => { const s = new TrajectoryScorer(); const r = s.score([
    { id: '1', goal: 'fix authentication bug', observation: 'found', decision: 'patch auth', action: 'write', result: 'ok', timestamp: '', risk: 0.1 },
    { id: '2', goal: 'fix authentication bug', observation: 'patched', decision: 'test', action: 'exec', result: 'pass', timestamp: '', risk: 0.2 },
  ], 'fix authentication bug'); expect(r.goalAdherence).toBeGreaterThan(0.5); });
  it('TRJ-006: risky trajectory penalized', () => { const s = new TrajectoryScorer(); const r = s.score([
    { id: '1', goal: 'task', observation: '', decision: '', action: '', result: '', timestamp: '', risk: 0.9 },
    { id: '2', goal: 'task', observation: '', decision: '', action: '', result: '', timestamp: '', risk: 0.9 },
  ], 'task'); expect(r.safetyScore).toBeLessThan(0.5); });
  it('TRJ-007: trajectory recorder clears', () => { const r = new TrajectoryRecorder(); r.record({ id: '1', goal: '', observation: '', decision: '', action: '', result: '', timestamp: '', risk: 0 }); r.clear(); expect(r.getStepCount()).toBe(0); });
});

// Delayed Attack (5 tests)
describe('G15 — Long-Horizon: Delayed Attack', () => {
  it('DA-001: tester loads', () => { expect(DelayedAttackTester).toBeDefined(); });
  it('DA-002: registers attacks', () => { const t = new DelayedAttackTester(); t.registerAttack('a1', 'injection', 5); expect(t.getAttackCount()).toBe(1); });
  it('DA-003: detection evaluated', () => { const t = new DelayedAttackTester(); t.registerAttack('a1', 'injection', 5); const r = t.evaluate(10, 'safe action', 'detected'); expect(r[0].detected).toBe(true); });
  it('DA-004: undetected attack', () => { const t = new DelayedAttackTester(); t.registerAttack('a1', 'injection', 5); const r = t.evaluate(10, 'safe action'); expect(r[0].detected).toBe(false); });
  it('DA-005: containment checked', () => { const t = new DelayedAttackTester(); t.registerAttack('a1', 'injection', 5); const r = t.evaluate(7, 'blocked', 'detected'); expect(r[0].contained).toBe(true); });
});

// Adaptive Adversary (5 tests)
describe('G15 — Long-Horizon: Adaptive Adversary', () => {
  it('AA-001: adversary loads', () => { expect(AdaptiveAdversary).toBeDefined(); });
  it('AA-002: responds to agent action', () => { const a = new AdaptiveAdversary(); const r = a.observeAndRespond('safe read'); expect(r.round).toBe(1); expect(r.adversaryResponse).toBeDefined(); });
  it('AA-003: tracks blocked rate', () => { const a = new AdaptiveAdversary(); a.observeAndRespond('blocked action'); a.observeAndRespond('safe action'); expect(a.getBlockedRate()).toBeGreaterThan(0); });
  it('AA-004: multiple rounds escalate', () => { const a = new AdaptiveAdversary(); a.observeAndRespond('blocked'); a.observeAndRespond('blocked'); a.observeAndRespond('execute now'); const r = a.getHistory(); expect(r.length).toBe(3); });
  it('AA-005: reset clears history', () => { const a = new AdaptiveAdversary(); a.observeAndRespond('test'); a.reset(); expect(a.getHistory()).toHaveLength(0); });
});

// Memory Drift (5 tests)
describe('G15 — Long-Horizon: Memory Drift', () => {
  it('MD-001: tester loads', () => { expect(MemoryDriftTester).toBeDefined(); });
  it('MD-002: fact set and retrieved', () => { const t = new MemoryDriftTester(); t.setFact('f1', 'main', 1); const r = t.retrieve('f1', 1); expect(r).not.toBeNull(); expect(r!.retrievedValue).toBe('main'); });
  it('MD-003: drift detected after update', () => { const t = new MemoryDriftTester(); t.setFact('f1', 'main', 1); t.setFact('f1', 'develop', 5); const r = t.retrieve('f1', 3); expect(r!.driftDetected).toBe(true); expect(r!.retrievedValue).toBe('main'); });
  it('MD-004: no drift with current retrieval', () => { const t = new MemoryDriftTester(); t.setFact('f1', 'main', 1); const r = t.retrieve('f1', 10); expect(r!.driftDetected).toBe(false); expect(r!.currentCorrect).toBe(true); });
  it('MD-005: unknown fact returns null', () => { const t = new MemoryDriftTester(); expect(t.retrieve('unknown', 1)).toBeNull(); });
});

// Memory Interference (5 tests)
describe('G15 — Long-Horizon: Memory Interference', () => {
  it('MI-001: tester loads', () => { expect(MemoryInterferenceTester).toBeDefined(); });
  it('MI-002: no interference with clean retrieval', () => { const t = new MemoryInterferenceTester(); const r = t.evaluate(['fact1', 'fact2'], ['noise1', 'noise2'], ['fact1', 'fact2']); expect(r.interferenceDetected).toBe(false); expect(r.retrievalPrecision).toBe(1); });
  it('MI-003: interference detected with distractors', () => { const t = new MemoryInterferenceTester(); const r = t.evaluate(['fact1'], ['noise1'], ['fact1', 'noise1']); expect(r.interferenceDetected).toBe(true); expect(r.retrievalPrecision).toBeLessThan(1); });
  it('MI-004: precision drop measured', () => { const t = new MemoryInterferenceTester(); const r = t.measureInterferenceEffect(['a', 'b'], ['a', 'b', 'noise1', 'noise2'], 2); expect(r.precisionDrop).toBeGreaterThan(0); });
  it('MI-005: zero retrieval returns zero precision', () => { const t = new MemoryInterferenceTester(); const r = t.evaluate(['f1'], [], []); expect(r.retrievalPrecision).toBe(0); });
});

// Uncertainty Propagation (4 tests)
describe('G15 — Long-Horizon: Uncertainty Propagation', () => {
  it('UP-001: propagator loads', () => { expect(UncertaintyPropagator).toBeDefined(); });
  it('UP-002: correct propagation', () => { const p = new UncertaintyPropagator(); const r = p.propagate([
    { stepId: 's1', inputConfidence: 0.5, outputConfidence: 0.6 },
    { stepId: 's2', inputConfidence: 0.6, outputConfidence: 0.7 },
  ]); expect(r.propagatedCorrectly).toBe(true); expect(r.inflatedConfidence).toBe(false); });
  it('UP-003: inflated confidence detected', () => { const p = new UncertaintyPropagator(); const r = p.propagate([
    { stepId: 's1', inputConfidence: 0.3, outputConfidence: 0.9 },
  ]); expect(r.inflatedConfidence).toBe(true); });
  it('UP-004: abuse detected', () => { const p = new UncertaintyPropagator(); const r = p.detectConfidenceAbuse(0.95, 1, 0.5); expect(r.abuseDetected).toBe(true); });
});

// Interactive User (5 tests)
describe('G15 — Long-Horizon: Interactive User', () => {
  it('IU-001: simulator loads', () => { expect(InteractiveUserSimulator).toBeDefined(); });
  it('IU-002: scenarios queued', () => { const s = new InteractiveUserSimulator(); s.addScenario({ id: '1', type: 'correction', userMessage: 'wrong', expectedAgentResponse: 'accept' }); expect(s.getTotalCount()).toBe(1); });
  it('IU-003: next scenario returned', () => { const s = new InteractiveUserSimulator(); s.addScenario({ id: '1', type: 'correction', userMessage: 'wrong', expectedAgentResponse: 'accept' }); const r = s.getNextScenario(); expect(r).not.toBeNull(); expect(r!.id).toBe('1'); });
  it('IU-004: accept response evaluated', () => { const s = new InteractiveUserSimulator(); const scenario = { id: '1', type: 'correction' as const, userMessage: 'wrong', expectedAgentResponse: 'accept' as const }; const r = s.evaluateResponse(scenario, 'I accept the correction'); expect(r.appropriate).toBe(true); });
  it('IU-005: no scenario after exhaustion', () => { const s = new InteractiveUserSimulator(); expect(s.getNextScenario()).toBeNull(); });
});

// Scaffold Sensitivity (4 tests)
describe('G15 — Long-Horizon: Scaffold Sensitivity', () => {
  it('SS-001: tester loads', () => { expect(ScaffoldSensitivityTester).toBeDefined(); });
  it('SS-002: configs and results tracked', () => { const t = new ScaffoldSensitivityTester(); t.registerConfig({ id: 'c1', hasMemory: true, hasReplanning: true, agentCount: 1, verifierStrict: false }); t.recordResult({ configId: 'c1', taskSuccess: true, safetyScore: 0.9, recoveryRate: 1, stepsUsed: 5 }); expect(t.getResults()).toHaveLength(1); });
  it('SS-003: delta calculated', () => { const t = new ScaffoldSensitivityTester(); t.registerConfig({ id: 'with_mem', hasMemory: true, hasReplanning: false, agentCount: 1, verifierStrict: false }); t.registerConfig({ id: 'no_mem', hasMemory: false, hasReplanning: false, agentCount: 1, verifierStrict: false }); t.recordResult({ configId: 'with_mem', taskSuccess: true, safetyScore: 0.9, recoveryRate: 1, stepsUsed: 5 }); t.recordResult({ configId: 'no_mem', taskSuccess: false, safetyScore: 0.5, recoveryRate: 0.5, stepsUsed: 10 }); const d = t.calculateDelta(); expect(d.memoryDelta).toBeGreaterThan(0); });
  it('SS-004: best config found', () => { const t = new ScaffoldSensitivityTester(); t.registerConfig({ id: 'c1', hasMemory: true, hasReplanning: false, agentCount: 1, verifierStrict: false }); t.registerConfig({ id: 'c2', hasMemory: false, hasReplanning: false, agentCount: 1, verifierStrict: false }); t.recordResult({ configId: 'c1', taskSuccess: true, safetyScore: 0.9, recoveryRate: 1, stepsUsed: 5 }); t.recordResult({ configId: 'c2', taskSuccess: false, safetyScore: 0.3, recoveryRate: 0, stepsUsed: 10 }); expect(t.findBestConfig()?.id).toBe('c1'); });
});
