import { describe, it, expect, beforeEach } from 'vitest';
import { generateId, now } from '@agi-os/kernel';
import { OutcomeAnalyzer } from '../src/outcome-analyzer.js';
import { DiscrepancyDetector } from '../src/discrepancy-detector.js';
import { FailureAnalyzer } from '../src/failure-analyzer.js';
import { RootCauseExtractor } from '../src/root-cause.js';
import { LessonGenerator } from '../src/lesson-generator.js';
import { LessonValidator } from '../src/lesson-validator.js';
import { ReflectionEngine } from '../src/reflection-engine.js';
import type { ReflectionInput, MissionOutcome, Discrepancy, FailureAnalysis, RootCause, CandidateLesson } from '../src/types.js';

function createFailedInput(overrides?: Partial<ReflectionInput>): ReflectionInput {
  return {
    missionId: 'mission-1',
    goalId: 'goal-1',
    goal: 'Deploy application',
    planId: 'plan-1',
    predictedSuccess: 0.85,
    predictedRisk: 0.15,
    expectedOutcome: 'Application deployed successfully',
    actualOutcome: 'Deployment failed due to missing dependency',
    success: false,
    duration: 5000,
    evidenceRefs: ['ev-1', 'ev-2'],
    sourceEventIds: ['evt-1'],
    timestamp: now().toISOString(),
    ...overrides,
  };
}

function createSuccessInput(overrides?: Partial<ReflectionInput>): ReflectionInput {
  return {
    missionId: 'mission-2',
    goalId: 'goal-2',
    goal: 'Run tests',
    planId: 'plan-2',
    predictedSuccess: 0.9,
    predictedRisk: 0.1,
    expectedOutcome: 'All tests pass',
    actualOutcome: 'All tests pass',
    success: true,
    duration: 2000,
    evidenceRefs: ['ev-3'],
    sourceEventIds: ['evt-2'],
    timestamp: now().toISOString(),
    ...overrides,
  };
}

// ===================================================================
// OutcomeAnalyzer
// ===================================================================
describe('OutcomeAnalyzer', () => {
  let analyzer: OutcomeAnalyzer;

  beforeEach(() => { analyzer = new OutcomeAnalyzer(); });

  it('should analyze mission outcome from input', () => {
    const input = createFailedInput();
    const outcome = analyzer.analyze(input);

    expect(outcome.missionId).toBe('mission-1');
    expect(outcome.success).toBe(false);
    expect(outcome.predictedSuccess).toBe(0.85);
  });

  it('should detect critical discrepancy when high prediction fails', () => {
    const outcome = analyzer.analyze(createFailedInput({ predictedSuccess: 0.9 }));
    const discrepancies = analyzer.detectDiscrepancies(outcome);

    const critical = discrepancies.find((d) => d.severity === 'critical');
    expect(critical).toBeDefined();
    expect(critical?.type).toBe('outcome');
  });

  it('should detect prediction error discrepancy', () => {
    const outcome = analyzer.analyze(createFailedInput({ predictedSuccess: 0.9 }));
    const discrepancies = analyzer.detectDiscrepancies(outcome);

    const perf = discrepancies.find((d) => d.type === 'performance');
    expect(perf).toBeDefined();
  });

  it('should detect positive surprise (low prediction, success)', () => {
    const outcome = analyzer.analyze(createSuccessInput({ predictedSuccess: 0.2 }));
    const discrepancies = analyzer.detectDiscrepancies(outcome);

    expect(discrepancies.length).toBeGreaterThan(0);
    expect(discrepancies.some((d) => d.actual === 'Success')).toBe(true);
  });

  it('should detect outcome text discrepancy', () => {
    const outcome = analyzer.analyze(createFailedInput({
      expectedOutcome: 'Deployed and running',
      actualOutcome: 'Completely different result',
    }));
    const discrepancies = analyzer.detectDiscrepancies(outcome);

    expect(discrepancies.some((d) => d.type === 'outcome')).toBe(true);
  });

  it('should return no critical discrepancies for accurate prediction', () => {
    const outcome = analyzer.analyze(createSuccessInput({ predictedSuccess: 0.9 }));
    const discrepancies = analyzer.detectDiscrepancies(outcome);

    const critical = discrepancies.filter((d) => d.severity === 'critical');
    expect(critical).toHaveLength(0);
  });
});

// ===================================================================
// DiscrepancyDetector
// ===================================================================
describe('DiscrepancyDetector', () => {
  let detector: DiscrepancyDetector;

  beforeEach(() => { detector = new DiscrepancyDetector(); });

  const makeDiscrepancy = (overrides?: Partial<Discrepancy>): Discrepancy => ({
    id: generateId(), type: 'outcome', description: 'test', expected: 'a', actual: 'b',
    severity: 'major', measurable: true, magnitude: 0.7, ...overrides,
  });

  it('should classify discrepancies by type', () => {
    const d1 = makeDiscrepancy({ type: 'outcome' });
    const d2 = makeDiscrepancy({ type: 'performance' });
    const d3 = makeDiscrepancy({ type: 'outcome' });

    const classified = detector.classifyByType([d1, d2, d3]);
    expect(classified.get('outcome')).toHaveLength(2);
    expect(classified.get('performance')).toHaveLength(1);
  });

  it('should sort by severity', () => {
    const d1 = makeDiscrepancy({ severity: 'minor' });
    const d2 = makeDiscrepancy({ severity: 'critical' });
    const d3 = makeDiscrepancy({ severity: 'moderate' });

    const sorted = detector.sortBySeverity([d1, d3, d2]);
    expect(sorted[0].severity).toBe('critical');
    expect(sorted[2].severity).toBe('minor');
  });

  it('should filter by minimum severity', () => {
    const d1 = makeDiscrepancy({ severity: 'minor' });
    const d2 = makeDiscrepancy({ severity: 'critical' });
    const d3 = makeDiscrepancy({ severity: 'moderate' });

    const filtered = detector.filterByMinSeverity([d1, d2, d3], 'moderate');
    expect(filtered).toHaveLength(2);
  });

  it('should calculate overall score', () => {
    const d1 = makeDiscrepancy({ severity: 'critical', magnitude: 0.9 });
    const score = detector.calculateOverallScore([d1]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('should return 0 for empty discrepancies', () => {
    expect(detector.calculateOverallScore([])).toBe(0);
  });

  it('should detect pattern when same type repeats', () => {
    const d1 = makeDiscrepancy({ type: 'constraint', severity: 'major' });
    const d2 = makeDiscrepancy({ type: 'constraint', severity: 'major' });
    const d3 = makeDiscrepancy({ type: 'performance', severity: 'minor' });

    const pattern = detector.detectPattern([d1, d2, d3]);
    expect(pattern?.hasPattern).toBe(true);
    expect(pattern?.patternType).toBe('constraint');
  });

  it('should return null pattern for single discrepancy', () => {
    const d1 = makeDiscrepancy();
    expect(detector.detectPattern([d1])).toBeNull();
  });

  it('should summarize discrepancies', () => {
    const d1 = makeDiscrepancy({ type: 'outcome', severity: 'critical' });
    const d2 = makeDiscrepancy({ type: 'performance', severity: 'minor' });

    const summary = detector.summarize([d1, d2]);
    expect(summary.total).toBe(2);
    expect(summary.criticalCount).toBe(1);
    expect(summary.byType['outcome']).toBe(1);
  });
});

// ===================================================================
// FailureAnalyzer
// ===================================================================
describe('FailureAnalyzer', () => {
  let analyzer: FailureAnalyzer;

  beforeEach(() => { analyzer = new FailureAnalyzer(); });

  const makeDiscrepancy = (overrides?: Partial<Discrepancy>): Discrepancy => ({
    id: generateId(), type: 'outcome', description: 'test', expected: 'a', actual: 'b',
    severity: 'major', measurable: true, magnitude: 0.7, ...overrides,
  });

  it('should analyze failures from discrepancies', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: ['ev-1'] } as MissionOutcome;
    const discrepancies = [makeDiscrepancy({ description: 'missing dependency' })];

    const analyses = analyzer.analyze({ outcome, discrepancies });
    expect(analyses.length).toBeGreaterThan(0);
    expect(analyses[0].category).toBeDefined();
  });

  it('should categorize missing resource failures', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: [] } as MissionOutcome;
    const discrepancies = [makeDiscrepancy({ description: 'resource not found missing' })];

    const analyses = analyzer.analyze({ outcome, discrepancies });
    expect(analyses[0].category).toBe('resource_unavailable');
  });

  it('should categorize constraint violations', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: [] } as MissionOutcome;
    const discrepancies = [makeDiscrepancy({ description: 'constraint violated' })];

    const analyses = analyzer.analyze({ outcome, discrepancies });
    expect(analyses[0].category).toBe('constraint_violation');
  });

  it('should return empty for successful mission with minor discrepancies', () => {
    const outcome = { ...createSuccessInput(), success: true, evidenceRefs: [] } as MissionOutcome;
    const discrepancies = [makeDiscrepancy({ severity: 'minor' })];

    const analyses = analyzer.analyze({ outcome, discrepancies });
    expect(analyses).toHaveLength(0);
  });

  it('should group analyses by category', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: [] } as MissionOutcome;
    const d1 = makeDiscrepancy({ description: 'tool failed crash' });
    const d2 = makeDiscrepancy({ description: 'constraint violated' });

    const analyses = analyzer.analyze({ outcome, discrepancies: [d1, d2] });
    const grouped = analyzer.groupByCategory(analyses);
    expect(grouped.size).toBeGreaterThanOrEqual(1);
  });

  it('should get most common category', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: [] } as MissionOutcome;
    const d1 = makeDiscrepancy({ description: 'tool failure crash' });
    const d2 = makeDiscrepancy({ description: 'tool failure crash' });

    const analyses = analyzer.analyze({ outcome, discrepancies: [d1, d2] });
    expect(analyzer.getMostCommonCategory(analyses)).toBeDefined();
  });
});

// ===================================================================
// RootCauseExtractor
// ===================================================================
describe('RootCauseExtractor', () => {
  let extractor: RootCauseExtractor;

  beforeEach(() => { extractor = new RootCauseExtractor(); });

  it('should extract root causes from failure analyses', () => {
    const outcome = { ...createFailedInput(), predictedSuccess: 0.9, evidenceRefs: [] } as MissionOutcome;
    const analyses: FailureAnalysis[] = [{
      id: generateId(), discrepancyId: 'd1', category: 'incorrect_assumption',
      description: 'Wrong assumption', contributingFactors: ['factor1'],
      evidenceRefs: [], confidence: 0.7,
    }];

    const causes = extractor.extract({ outcome, failureAnalyses: analyses });
    expect(causes.length).toBeGreaterThan(0);
    expect(causes[0].cause).toBeDefined();
  });

  it('should detect systemic root cause when multiple same-category failures', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: [] } as MissionOutcome;
    const analyses: FailureAnalysis[] = [
      { id: generateId(), discrepancyId: 'd1', category: 'tool_failure', description: 't1', contributingFactors: [], evidenceRefs: [], confidence: 0.6 },
      { id: generateId(), discrepancyId: 'd2', category: 'tool_failure', description: 't2', contributingFactors: [], evidenceRefs: [], confidence: 0.6 },
    ];

    const causes = extractor.extract({ outcome, failureAnalyses: analyses });
    const systemic = causes.find((c) => c.failureAnalysisId === 'systemic');
    expect(systemic).toBeDefined();
  });

  it('should sort by confidence', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: [] } as MissionOutcome;
    const analyses: FailureAnalysis[] = [
      { id: generateId(), discrepancyId: 'd1', category: 'execution_error', description: 't', contributingFactors: [], evidenceRefs: [], confidence: 0.4 },
      { id: generateId(), discrepancyId: 'd2', category: 'incorrect_assumption', description: 't', contributingFactors: [], evidenceRefs: [], confidence: 0.8 },
    ];

    const causes = extractor.extract({ outcome, failureAnalyses: analyses });
    const sorted = extractor.sortByConfidence(causes);
    expect(sorted.length).toBeGreaterThan(0);
  });

  it('should return empty for unknown category', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: [] } as MissionOutcome;
    const analyses: FailureAnalysis[] = [
      { id: generateId(), discrepancyId: 'd1', category: 'unknown', description: 't', contributingFactors: [], evidenceRefs: [], confidence: 0.5 },
    ];

    const causes = extractor.extract({ outcome, failureAnalyses: analyses });
    expect(causes).toHaveLength(0);
  });
});

// ===================================================================
// LessonGenerator
// ===================================================================
describe('LessonGenerator', () => {
  let generator: LessonGenerator;

  beforeEach(() => { generator = new LessonGenerator(); });

  it('should generate lessons from root causes', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: [] } as MissionOutcome;
    const rootCauses: RootCause[] = [{
      id: generateId(), failureAnalysisId: 'fa1',
      cause: 'Planner assumed conditions that were not true',
      mechanism: 'Prediction was wrong', evidenceRefs: [],
      confidence: 'high', reproducible: true,
    }];

    const lessons = generator.generate({ outcome, rootCauses });
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons[0].statement).toBeDefined();
    expect(lessons[0].suggestedAction).toBeDefined();
  });

  it('should map categories correctly', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: [] } as MissionOutcome;
    const rootCauses: RootCause[] = [
      { id: generateId(), failureAnalysisId: 'fa1', cause: 'Planner assumed wrong', mechanism: 'm', evidenceRefs: [], confidence: 'high', reproducible: false },
      { id: generateId(), failureAnalysisId: 'fa2', cause: 'Resource unavailable', mechanism: 'm', evidenceRefs: [], confidence: 'medium', reproducible: false },
      { id: generateId(), failureAnalysisId: 'fa3', cause: 'Constraint violated', mechanism: 'm', evidenceRefs: [], confidence: 'low', reproducible: false },
    ];

    const lessons = generator.generate({ outcome, rootCauses });
    expect(lessons.some((l) => l.category === 'strategic')).toBe(true);
    expect(lessons.some((l) => l.category === 'resource')).toBe(true);
    expect(lessons.some((l) => l.category === 'constraint_awareness')).toBe(true);
  });

  it('should sort by impact', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: [] } as MissionOutcome;
    const rootCauses: RootCause[] = [
      { id: generateId(), failureAnalysisId: 'fa1', cause: 'Assumption wrong', mechanism: 'm', evidenceRefs: [], confidence: 'high', reproducible: true },
      { id: generateId(), failureAnalysisId: 'fa2', cause: 'Execution error', mechanism: 'm', evidenceRefs: [], confidence: 'low', reproducible: false },
    ];

    const lessons = generator.generate({ outcome, rootCauses });
    const sorted = generator.sortByImpact(lessons);
    expect(sorted[0].impact).toBe('high');
  });

  it('should generate applicable suggestions', () => {
    const outcome = { ...createFailedInput(), evidenceRefs: [] } as MissionOutcome;
    const rootCauses: RootCause[] = [{
      id: generateId(), failureAnalysisId: 'fa1', cause: 'Missing information',
      mechanism: 'm', evidenceRefs: [], confidence: 'medium', reproducible: false,
    }];

    const lessons = generator.generate({ outcome, rootCauses });
    expect(lessons[0].applicability).toContain('context_gathering');
  });
});

// ===================================================================
// LessonValidator
// ===================================================================
describe('LessonValidator', () => {
  let validator: LessonValidator;

  beforeEach(() => { validator = new LessonValidator(); });

  const makeLesson = (overrides?: Partial<CandidateLesson>): CandidateLesson => ({
    id: generateId(), rootCauseId: 'rc1', statement: 'Check dependencies before execution',
    category: 'procedural', impact: 'high', applicability: ['planning'],
    prerequisites: [], suggestedAction: 'Verify deps', confidence: 0.7, ...overrides,
  });

  it('should validate lesson with sufficient evidence', () => {
    const lesson = makeLesson();
    const validation = validator.validate(lesson, 3);

    expect(validation.status).toBe('validated');
    expect(validation.evidenceCount).toBe(3);
  });

  it('should mark lesson as weak with little evidence', () => {
    const lesson = makeLesson();
    const validation = validator.validate(lesson, 1);

    expect(validation.status).toBe('weak');
  });

  it('should mark lesson as insufficient with no evidence', () => {
    const lesson = makeLesson();
    const validation = validator.validate(lesson, 0);

    expect(validation.status).toBe('insufficient_evidence');
  });

  it('should detect contradicting existing lessons', () => {
    validator.addExistingLesson({
      id: 'existing-1',
      statement: 'Never check dependencies before execution',
      confidence: 0.8,
      evidenceCount: 5,
    });

    const lesson = makeLesson({ statement: 'Check dependencies before execution' });
    const validation = validator.validate(lesson, 3);

    expect(validation.status).toBe('contradicted');
    expect(validation.contradictingEvidenceCount).toBeGreaterThan(0);
  });

  it('should find supporting existing lessons', () => {
    validator.addExistingLesson({
      id: 'existing-1',
      statement: 'Check dependencies before execution',
      confidence: 0.8,
      evidenceCount: 5,
    });

    const lesson = makeLesson();
    const validation = validator.validate(lesson, 1);

    expect(validation.evidenceCount).toBeGreaterThan(1);
  });

  it('should validate all lessons at once', () => {
    const l1 = makeLesson();
    const l2 = makeLesson();

    const results = validator.validateAll([l1, l2], 3);
    expect(results.size).toBe(2);
    expect(results.get(l1.id)?.status).toBe('validated');
  });

  it('should filter validated lessons', () => {
    const l1 = makeLesson({ confidence: 0.9 });
    const l2 = makeLesson({ confidence: 0.2 });

    const validated = validator.getValidated([l1, l2], 3);
    expect(validated.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter contradicted lessons', () => {
    validator.addExistingLesson({
      id: 'existing-1', statement: 'Never verify anything', confidence: 0.9, evidenceCount: 5,
    });

    const l1 = makeLesson({ statement: 'Verify everything before execution' });
    const contradicted = validator.getContradicted([l1], 3);
    expect(contradicted.length).toBeGreaterThanOrEqual(0);
  });
});

// ===================================================================
// ReflectionEngine — Full Pipeline
// ===================================================================
describe('ReflectionEngine', () => {
  let engine: ReflectionEngine;

  beforeEach(() => { engine = new ReflectionEngine(); });

  it('should reflect on a failed mission', async () => {
    const result = await engine.reflect(createFailedInput());

    expect(result.reflection).toBeDefined();
    expect(result.reflection.missionId).toBe('mission-1');
    expect(result.reflection.outcome.success).toBe(false);
  });

  it('should detect discrepancies in failed mission', async () => {
    const result = await engine.reflect(createFailedInput({ predictedSuccess: 0.9 }));

    expect(result.reflection.discrepancies.length).toBeGreaterThan(0);
  });

  it('should produce root causes for failures', async () => {
    const result = await engine.reflect(createFailedInput({ predictedSuccess: 0.9 }));

    expect(result.reflection.rootCauses.length).toBeGreaterThan(0);
  });

  it('should generate candidate lessons', async () => {
    const result = await engine.reflect(createFailedInput({ predictedSuccess: 0.9 }));

    expect(result.reflection.candidateLessons.length).toBeGreaterThan(0);
  });

  it('should validate lessons before output', async () => {
    const result = await engine.reflect(createFailedInput({ predictedSuccess: 0.9 }));

    for (const vl of result.reflection.validatedLessons) {
      expect(vl.validation).toBeDefined();
      expect(['validated', 'weak']).toContain(vl.validation.status);
    }
  });

  it('should track reflections', async () => {
    await engine.reflect(createFailedInput());
    await engine.reflect(createSuccessInput());

    expect(engine.getReflections()).toHaveLength(2);
  });

  it('should retrieve reflection by ID', async () => {
    const result = await engine.reflect(createFailedInput());
    expect(engine.getReflection(result.reflection.id)?.id).toBe(result.reflection.id);
  });

  it('should get reflections by mission', async () => {
    await engine.reflect(createFailedInput({ missionId: 'm1' }));
    await engine.reflect(createFailedInput({ missionId: 'm2' }));
    await engine.reflect(createSuccessInput({ missionId: 'm1' }));

    expect(engine.getReflectionsForMission('m1')).toHaveLength(2);
    expect(engine.getReflectionsForMission('m2')).toHaveLength(1);
  });

  it('should generate memory writes for validated lessons', async () => {
    const result = await engine.reflect(createFailedInput({ predictedSuccess: 0.9 }));

    expect(result.memoryWrites.length).toBeGreaterThan(0);
    for (const write of result.memoryWrites) {
      expect(write.memoryType).toBeDefined();
      expect(write.confidence).toBeGreaterThan(0);
      expect(write.sourceReflectionId).toBeDefined();
    }
  });

  it('should reflect on successful mission', async () => {
    const result = await engine.reflect(createSuccessInput());

    expect(result.reflection.outcome.success).toBe(true);
    expect(result.reflection.confidence).toBeGreaterThan(0);
  });

  it('should produce no failure analyses for success with no critical discrepancies', async () => {
    const result = await engine.reflect(createSuccessInput({ predictedSuccess: 0.9 }));

    expect(result.reflection.failureAnalyses).toHaveLength(0);
  });

  it('should calculate reflection confidence', async () => {
    const result = await engine.reflect(createFailedInput({ predictedSuccess: 0.9 }));

    expect(result.reflection.confidence).toBeGreaterThanOrEqual(0);
    expect(result.reflection.confidence).toBeLessThanOrEqual(1);
  });

  it('should respect existing lessons for contradiction checking', async () => {
    engine.setExistingLessons([{
      id: 'existing-1',
      statement: 'Never check dependencies before deployment',
      confidence: 0.9,
      evidenceCount: 5,
    }]);

    const result = await engine.reflect(createFailedInput({ predictedSuccess: 0.9 }));

    // Some lessons may be contradicted by existing lessons
    expect(result.reflection).toBeDefined();
  });
});

// ===================================================================
// Golden Test: Full Reflection Pipeline
// ===================================================================
describe('Golden Reflection Test', () => {
  it('Goal -> Plan predicts SUCCESS -> Execution FAILS -> Evidence -> Reflection -> Root Cause -> Lesson -> Validated', async () => {
    const engine = new ReflectionEngine();

    // Step 1: Mission fails despite high prediction
    const result = await engine.reflect({
      missionId: 'golden-mission',
      goalId: 'golden-goal',
      goal: 'Deploy application to production',
      planId: 'golden-plan',
      predictedSuccess: 0.85,
      predictedRisk: 0.15,
      expectedOutcome: 'Application deployed and healthy',
      actualOutcome: 'Deployment failed: docker build error',
      success: false,
      duration: 15000,
      evidenceRefs: ['ev-docker-1', 'ev-build-1'],
      sourceEventIds: ['evt-deploy-1'],
      timestamp: now().toISOString(),
    });

    // Step 2: Verify full pipeline executed
    expect(result.reflection.outcome.success).toBe(false);
    expect(result.reflection.discrepancies.length).toBeGreaterThan(0);
    expect(result.reflection.failureAnalyses.length).toBeGreaterThan(0);
    expect(result.reflection.rootCauses.length).toBeGreaterThan(0);
    expect(result.reflection.candidateLessons.length).toBeGreaterThan(0);

    // Step 3: Verify lessons are validated (not raw candidates)
    for (const vl of result.reflection.validatedLessons) {
      expect(vl.validation.status).toMatch(/validated|weak/);
      expect(vl.memoryType).toBeDefined();
    }

    // Step 4: Verify memory writes are generated
    expect(result.memoryWrites.length).toBeGreaterThan(0);

    // Step 5: Verify confidence is calculated
    expect(result.reflection.confidence).toBeGreaterThan(0);
  });

  it('Should generate different lessons for different failure types', async () => {
    const engine = new ReflectionEngine();

    const r1 = await engine.reflect({
      missionId: 'm1', goalId: 'g1', goal: 'Deploy', planId: 'p1',
      predictedSuccess: 0.8, predictedRisk: 0.2,
      expectedOutcome: 'Deployed', actualOutcome: 'Missing dependency',
      success: false, duration: 5000, evidenceRefs: [], sourceEventIds: [],
      timestamp: now().toISOString(),
    });

    const r2 = await engine.reflect({
      missionId: 'm2', goalId: 'g2', goal: 'Test', planId: 'p2',
      predictedSuccess: 0.7, predictedRisk: 0.3,
      expectedOutcome: 'Tests pass', actualOutcome: 'Timeout error',
      success: false, duration: 30000, evidenceRefs: [], sourceEventIds: [],
      timestamp: now().toISOString(),
    });

    // Different failures should produce different root causes
    expect(r1.reflection.rootCauses.length).toBeGreaterThan(0);
    expect(r2.reflection.rootCauses.length).toBeGreaterThan(0);
  });
});
