import { describe, it, expect } from 'vitest';
import {
  TruthfulnessClassifier,
  CalibrationScorer,
  GoalDriftDetector,
  ScopeCreepDetector,
  ActionEfficiencyScorer,
  FalseCompletionDetector,
  SelfCorrectionEvaluator,
  ContradictionDetector,
} from '../src/index.js';

// ============================================================================
// G13 — Agent Quality Gate (60 tests)
// ============================================================================

// Truthfulness (12 tests)
describe('G13 — Agent Quality: Truthfulness', () => {
  it('TRU-001: classifier loads', () => { expect(TruthfulnessClassifier).toBeDefined(); });
  it('TRU-002: known fact classified as KNOWN', () => { const c = new TruthfulnessClassifier(); c.registerFact('branch', 'main'); const r = c.classify('The branch is main'); expect(r.classification).toBe('KNOWN'); });
  it('TRU-003: unknown claim returns UNKNOWN', () => { const c = new TruthfulnessClassifier(); const r = c.classify('The secret code is 42'); expect(r.classification).toBe('UNKNOWN'); });
  it('TRU-004: false claim detected', () => { const c = new TruthfulnessClassifier(); c.registerFact('branch', 'main'); const r = c.classify('The branch is develop'); expect(r.classification).toBe('FALSE'); });
  it('TRU-005: evidence-supported claim is INFERRED', () => { const c = new TruthfulnessClassifier(); const r = c.classify('tests pass', ['test output: all pass']); expect(r.classification).toBe('INFERRED'); });
  it('TRU-006: evidence-mismatch is UNVERIFIED', () => { const c = new TruthfulnessClassifier(); const r = c.classify('deploy succeeded', ['build failed']); expect(r.classification).toBe('UNVERIFIED'); });
  it('TRU-007: file existence check returns UNKNOWN', () => { const c = new TruthfulnessClassifier(); const r = c.checkFileExists('/nonexistent/file'); expect(r.classification).toBe('UNKNOWN'); expect(r.evidence).toHaveLength(0); });
  it('TRU-008: source check returns correct type', () => { const c = new TruthfulnessClassifier(); const r = c.checkSourceExists('src-1'); expect(r.classification).toBeDefined(); });
  it('TRU-009: high confidence with zero evidence is unjustified', () => { const c = new TruthfulnessClassifier(); const r = c.validateConfidence('claim', 0.95, 0); expect(r.adjusted).toBe(true); expect(r.newConfidence).toBe(0); });
  it('TRU-010: high confidence with low evidence is adjusted', () => { const c = new TruthfulnessClassifier(); const r = c.validateConfidence('claim', 0.85, 1); expect(r.adjusted).toBe(true); expect(r.newConfidence).toBeLessThanOrEqual(0.5); });
  it('TRU-011: reasonable confidence passes', () => { const c = new TruthfulnessClassifier(); const r = c.validateConfidence('claim', 0.6, 3); expect(r.adjusted).toBe(false); });
  it('TRU-012: confidence with sufficient evidence passes', () => { const c = new TruthfulnessClassifier(); const r = c.validateConfidence('claim', 0.9, 5); expect(r.adjusted).toBe(false); });
});

// Calibration (8 tests)
describe('G13 — Agent Quality: Calibration', () => {
  it('CAL-001: scorer loads', () => { expect(CalibrationScorer).toBeDefined(); });
  it('CAL-002: perfect calibration has low Brier score', () => { const s = new CalibrationScorer(); for (let i = 0; i < 10; i++) { s.record(0.9, true); s.record(0.1, false); } expect(s.calculateBrierScore()).toBeLessThan(0.1); });
  it('CAL-003: worst calibration has high Brier score', () => { const s = new CalibrationScorer(); s.record(0.9, false); s.record(0.1, true); expect(s.calculateBrierScore()).toBeGreaterThan(0.5); });
  it('CAL-004: overconfidence detected', () => { const s = new CalibrationScorer(); for (let i = 0; i < 10; i++) s.record(0.95, false); expect(s.calculateOverconfidenceRate()).toBe(1); });
  it('CAL-005: underconfidence detected', () => { const s = new CalibrationScorer(); for (let i = 0; i < 10; i++) s.record(0.1, true); expect(s.calculateUnderconfidenceRate()).toBe(1); });
  it('CAL-006: well-calibrated when Brier low and ECE low', () => { const s = new CalibrationScorer(); for (let i = 0; i < 100; i++) { s.record(0.9, true); s.record(0.9, true); s.record(0.9, true); s.record(0.9, true); s.record(0.9, true); s.record(0.9, true); s.record(0.9, true); s.record(0.9, true); s.record(0.9, true); s.record(0.9, false); s.record(0.1, false); s.record(0.1, true); } expect(s.isWellCalibrated()).toBe(true); });
  it('CAL-007: full result returned', () => { const s = new CalibrationScorer(); s.record(0.5, true); const r = s.getResult(); expect(r.brierScore).toBeDefined(); expect(r.expectedCalibrationError).toBeDefined(); expect(r.overconfidenceRate).toBeDefined(); });
  it('CAL-008: clear resets samples', () => { const s = new CalibrationScorer(); s.record(0.5, true); s.clear(); expect(s.getSamples()).toHaveLength(0); });
});

// Goal Drift (8 tests)
describe('G13 — Agent Quality: Goal Drift', () => {
  it('GDR-001: detector loads', () => { expect(GoalDriftDetector).toBeDefined(); });
  it('GDR-002: aligned action preserves goal', () => { const d = new GoalDriftDetector(); d.setGoal('fix the authentication bug'); const r = d.evaluate('fix auth module login error'); expect(r.preserved).toBe(true); expect(r.driftDetected).toBe(false); });
  it('GDR-003: unrelated action drifts', () => { const d = new GoalDriftDetector(); d.setGoal('fix the authentication bug'); const r = d.evaluate('deploy the application to production'); expect(r.driftDetected).toBe(true); });
  it('GDR-004: no goal set returns no drift', () => { const d = new GoalDriftDetector(); const r = d.evaluate('do anything'); expect(r.driftDetected).toBe(false); });
  it('GDR-005: action list detects drift', () => { const d = new GoalDriftDetector(); d.setGoal('fix authentication bug'); const r = d.evaluateActionList(['fix login', 'fix password reset', 'deploy to prod']); expect(r.driftedActions.length).toBeGreaterThan(0); });
  it('GDR-006: scope expansion detected', () => { const d = new GoalDriftDetector(); const r = d.detectScopeExpansion('fix bug in auth', 'fix bug in auth and refactor database and add tests'); expect(r.expanded).toBe(true); });
  it('GDR-007: no expansion within scope', () => { const d = new GoalDriftDetector(); const r = d.detectScopeExpansion('fix the bug', 'fix the bug'); expect(r.expanded).toBe(false); });
  it('GDR-008: empty action returns no drift', () => { const d = new GoalDriftDetector(); d.setGoal('test'); const r = d.evaluate(''); expect(r.driftDetected).toBe(false); });
});

// Scope Creep (7 tests)
describe('G13 — Agent Quality: Scope Creep', () => {
  it('SCP-001: detector loads', () => { expect(ScopeCreepDetector).toBeDefined(); });
  it('SCP-002: authorized changes within scope', () => { const d = new ScopeCreepDetector(); d.configure({ authorizedPaths: ['src/'], maxFiles: 5 }); const r = d.evaluate('edit source', [{ path: 'src/app.ts', type: 'modify', linesChanged: 10 }]); expect(r.withinScope).toBe(true); });
  it('SCP-003: unauthorized path detected', () => { const d = new ScopeCreepDetector(); d.configure({ authorizedPaths: ['src/'] }); const r = d.evaluate('edit source', [{ path: 'config/prod.env', type: 'modify', linesChanged: 5 }]); expect(r.withinScope).toBe(false); expect(r.unauthorizedChanges.length).toBe(1); });
  it('SCP-004: excessive file count detected', () => { const d = new ScopeCreepDetector(); d.configure({ maxFiles: 3 }); const changes = Array.from({ length: 10 }, (_, i) => ({ path: `src/f${i}.ts`, type: 'modify' as const, linesChanged: 5 })); const r = d.evaluate('edit', changes); expect(r.withinScope).toBe(false); });
  it('SCP-005: dependency changes counted', () => { const d = new ScopeCreepDetector(); const count = d.countDependencyChanges([{ path: 'package.json', type: 'modify', linesChanged: 3 }, { path: 'src/index.ts', type: 'modify', linesChanged: 10 }]); expect(count).toBe(1); });
  it('SCP-006: config changes counted', () => { const d = new ScopeCreepDetector(); const count = d.countConfigChanges([{ path: 'tsconfig.json', type: 'modify', linesChanged: 2 }, { path: 'src/index.ts', type: 'modify', linesChanged: 10 }]); expect(count).toBe(1); });
  it('SCP-007: severity NONE for clean changes', () => { const d = new ScopeCreepDetector(); d.configure({ maxFiles: 10, maxLines: 500 }); const r = d.evaluate('task', [{ path: 'src/a.ts', type: 'modify', linesChanged: 5 }]); expect(r.severity).toBe('NONE'); });
});

// Minimal Action / Efficiency (8 tests)
describe('G13 — Agent Quality: Minimal Action', () => {
  it('EFF-001: scorer loads', () => { expect(ActionEfficiencyScorer).toBeDefined(); });
  it('EFF-002: perfect efficiency', () => { const s = new ActionEfficiencyScorer(); const r = s.evaluate(true, 5, 5); expect(r.efficiencyScore).toBe(1); expect(r.unnecessaryActionRate).toBe(0); });
  it('EFF-003: low efficiency detected', () => { const s = new ActionEfficiencyScorer(); const r = s.evaluate(true, 50, 5); expect(r.efficiencyScore).toBeLessThan(0.2); expect(r.unnecessaryActionRate).toBeGreaterThan(0.8); });
  it('EFF-004: redundant tool calls detected', () => { const s = new ActionEfficiencyScorer(); const r = s.detectRedundantToolCalls(['read', 'read', 'write', 'read']); expect(r.redundant).toHaveLength(2); });
  it('EFF-005: no redundant calls', () => { const s = new ActionEfficiencyScorer(); const r = s.detectRedundantToolCalls(['read', 'write', 'exec']); expect(r.redundant).toHaveLength(0); });
  it('EFF-006: loop detected', () => { const s = new ActionEfficiencyScorer(); const r = s.detectLoop(['read', 'write', 'read', 'write', 'read', 'write']); expect(r.inLoop).toBe(true); });
  it('EFF-007: no loop in unique calls', () => { const s = new ActionEfficiencyScorer(); const r = s.detectLoop(['read', 'write', 'exec', 'verify']); expect(r.inLoop).toBe(false); });
  it('EFF-008: grade scale works', () => { const s = new ActionEfficiencyScorer(); expect(s.getGrade(0.95)).toBe('A'); expect(s.getGrade(0.75)).toBe('B'); expect(s.getGrade(0.55)).toBe('C'); expect(s.getGrade(0.35)).toBe('D'); expect(s.getGrade(0.1)).toBe('F'); });
});

// False Completion (7 tests)
describe('G13 — Agent Quality: False Completion', () => {
  it('FAL-001: detector loads', () => { expect(FalseCompletionDetector).toBeDefined(); });
  it('FAL-002: honest success report', () => { const d = new FalseCompletionDetector(); d.recordVerification('test-pass', true); d.recordVerification('build-pass', true); const r = d.evaluate('SUCCESS', ['test-pass', 'build-pass']); expect(r.isHonest).toBe(true); });
  it('FAL-003: false completion detected', () => { const d = new FalseCompletionDetector(); d.recordVerification('test-pass', false); const r = d.evaluate('SUCCESS', ['test-pass']); expect(r.isHonest).toBe(false); expect(r.actualStatus).toBe('FAILURE'); });
  it('FAL-004: partial completion honest', () => { const d = new FalseCompletionDetector(); d.recordVerification('check1', true); d.recordVerification('check2', false); const r = d.evaluate('PARTIAL', ['check1', 'check2']); expect(r.isHonest).toBe(true); });
  it('FAL-005: unverified check counts as failure', () => { const d = new FalseCompletionDetector(); const r = d.evaluate('SUCCESS', ['check1']); expect(r.actualStatus).toBe('FAILURE'); expect(r.isHonest).toBe(false); });
  it('FAL-006: honest failure report', () => { const d = new FalseCompletionDetector(); d.recordVerification('check', false); const r = d.evaluate('FAILURE', ['check']); expect(r.isHonest).toBe(true); });
  it('FAL-007: completion accuracy calculated', () => { const d = new FalseCompletionDetector(); const results = [{ isHonest: true } as any, { isHonest: true } as any, { isHonest: false } as any]; expect(d.getCompletionAccuracy(results)).toBeCloseTo(0.667, 2); });
});

// Self-Correction (5 tests)
describe('G13 — Agent Quality: Self-Correction', () => {
  it('SCR-001: evaluator loads', () => { expect(SelfCorrectionEvaluator).toBeDefined(); });
  it('SCR-002: correction detected', () => { const e = new SelfCorrectionEvaluator(); const r = e.evaluate('file is in /tests', 'file actually in /packages/*/tests', 'file is in packages directory'); expect(r.corrected).toBe(true); });
  it('SCR-003: no correction if assumption maintained', () => { const e = new SelfCorrectionEvaluator(); const r = e.evaluate('branch is main', '', 'branch is main'); expect(r.corrected).toBe(false); });
  it('SCR-004: assumption violation detected', () => { const e = new SelfCorrectionEvaluator(); const r = e.detectAssumptionViolation(['file exists', 'config is valid'], ['file was deleted']); expect(r.violated).toContain('file exists'); });
  it('SCR-005: correction rate calculated', () => { const e = new SelfCorrectionEvaluator(); const results = [{ corrected: true } as any, { corrected: false } as any]; expect(e.getCorrectionRate(results)).toBe(0.5); });
});

// Contradiction (5 tests)
describe('G13 — Agent Quality: Contradiction', () => {
  it('CTR-001: detector loads', () => { expect(ContradictionDetector).toBeDefined(); });
  it('CTR-002: no contradiction with single source', () => { const d = new ContradictionDetector(); const r = d.detect([{ id: 's1', claim: 'X', confidence: 0.9, sourceType: 'tool', timestamp: '' }]); expect(r.detected).toBe(false); });
  it('CTR-003: contradiction detected between sources', () => { const d = new ContradictionDetector(); const r = d.detect([{ id: 's1', claim: 'branch is main', confidence: 0.9, sourceType: 'tool', timestamp: '' }, { id: 's2', claim: 'branch is develop', confidence: 0.8, sourceType: 'memory', timestamp: '' }]); expect(r.detected).toBe(true); expect(r.resolved).toBe(true); expect(r.selectedSource).toBe('s1'); });
  it('CTR-004: evidence ranking prefers tools', () => { const d = new ContradictionDetector(); const ranked = d.rankEvidence([{ id: 's1', claim: 'X', confidence: 0.5, sourceType: 'memory', timestamp: '' }, { id: 's2', claim: 'Y', confidence: 0.5, sourceType: 'tool', timestamp: '' }]); expect(ranked[0].sourceType).toBe('tool'); });
  it('CTR-005: circular references detected', () => { const d = new ContradictionDetector(); const r = d.detectCircularReferences([{ id: 's1', claim: 'X', confidence: 0.5, sourceType: 'tool', timestamp: '' }, { id: 's2', claim: 'X', confidence: 0.5, sourceType: 'memory', timestamp: '' }, { id: 's3', claim: 'X', confidence: 0.5, sourceType: 'web', timestamp: '' }]); expect(r.circular).toBe(true); });
});
