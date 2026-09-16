import { describe, it, expect, beforeEach } from 'vitest';
import { generateId, now } from '@agi-os/kernel';
import { LessonValidator } from '../src/lesson-validator.js';
import { DiscrepancyDetector } from '../src/discrepancy-detector.js';
import type {
  CandidateLesson,
  StoredLesson,
  MissionOutcome,
  FailureCategory,
} from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createCandidate(overrides?: Partial<CandidateLesson>): CandidateLesson {
  return {
    id: generateId(),
    rootCauseId: 'rc-1',
    statement: 'Always validate inputs before processing',
    category: 'procedural',
    impact: 'medium',
    applicability: ['testing'],
    prerequisites: [],
    suggestedAction: 'Add input validation',
    confidence: 0.7,
    ...overrides,
  };
}

function createStoredLesson(overrides?: Partial<StoredLesson>): StoredLesson {
  const ts = now().toISOString();
  return {
    id: generateId(),
    statement: 'Always validate inputs before processing',
    category: 'procedural',
    impact: 'medium',
    confidence: 0.7,
    evidenceCount: 3,
    contradictionCount: 0,
    status: 'active',
    createdAt: ts,
    lastValidatedAt: ts,
    lastContradictedAt: null,
    consecutiveContradictions: 0,
    ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
    relevanceScore: 1.0,
    ...overrides,
  };
}

function createFailureOutcome(overrides: Partial<MissionOutcome>): MissionOutcome {
  return {
    missionId: 'm-1',
    goalId: 'g-1',
    goal: 'Test goal',
    planId: 'p-1',
    predictedSuccess: 0.8,
    predictedRisk: 0.2,
    expectedOutcome: 'Success',
    actualOutcome: 'Failed',
    success: false,
    duration: 1000,
    evidenceRefs: [],
    timestamp: now().toISOString(),
    ...overrides,
  };
}

// ===========================================================================
// Lesson Decay & Pruning
// ===========================================================================
describe('LessonValidator — Lesson Decay & Pruning', () => {
  let validator: LessonValidator;

  beforeEach(() => {
    validator = new LessonValidator();
  });

  // ---- storeLesson -------------------------------------------------------
  describe('storeLesson', () => {
    it('should create a StoredLesson with default decay config', () => {
      const lesson = createCandidate();
      const stored = validator.storeLesson(lesson);

      expect(stored.id).toBeDefined();
      expect(stored.statement).toBe(lesson.statement);
      expect(stored.status).toBe('active');
      expect(stored.evidenceCount).toBe(1);
      expect(stored.contradictionCount).toBe(0);
      expect(stored.consecutiveContradictions).toBe(0);
      expect(stored.relevanceScore).toBe(1.0);
      expect(stored.ttlMs).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should accept custom decay config', () => {
      const lesson = createCandidate();
      const stored = validator.storeLesson(lesson, { defaultTtlMs: 7 * 24 * 60 * 60 * 1000 });

      expect(stored.ttlMs).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  // ---- recordContradiction -----------------------------------------------
  describe('recordContradiction', () => {
    it('should increment contradiction counts', () => {
      const lesson = createStoredLesson();
      const updated = validator.recordContradiction(lesson);

      expect(updated.contradictionCount).toBe(1);
      expect(updated.consecutiveContradictions).toBe(1);
      expect(updated.lastContradictedAt).toBeDefined();
    });

    it('should reduce confidence on each contradiction', () => {
      const lesson = createStoredLesson({ confidence: 0.8 });
      const updated = validator.recordContradiction(lesson);

      expect(updated.confidence).toBeCloseTo(0.65); // 0.8 - 0.15
    });

    it('should not reduce confidence below 0', () => {
      const lesson = createStoredLesson({ confidence: 0.05 });
      const updated = validator.recordContradiction(lesson);

      expect(updated.confidence).toBe(0);
    });

    it('should deprecate after 3 consecutive contradictions', () => {
      let lesson = createStoredLesson();
      lesson = validator.recordContradiction(lesson);
      expect(lesson.status).toBe('active');

      lesson = validator.recordContradiction(lesson);
      expect(lesson.status).toBe('active');

      lesson = validator.recordContradiction(lesson);
      expect(lesson.status).toBe('deprecated');
    });

    it('should not reactivate a deprecated lesson', () => {
      let lesson = createStoredLesson();
      for (let i = 0; i < 3; i++) lesson = validator.recordContradiction(lesson);
      expect(lesson.status).toBe('deprecated');

      // A validation should NOT change status back to active
      const validated = validator.recordValidation(lesson);
      expect(validated.status).toBe('deprecated');
    });
  });

  // ---- recordValidation --------------------------------------------------
  describe('recordValidation', () => {
    it('should increment evidence count', () => {
      const lesson = createStoredLesson();
      const updated = validator.recordValidation(lesson);

      expect(updated.evidenceCount).toBe(4); // was 3
    });

    it('should reset consecutive contradictions', () => {
      let lesson = createStoredLesson();
      lesson = validator.recordContradiction(lesson);
      lesson = validator.recordContradiction(lesson);
      expect(lesson.consecutiveContradictions).toBe(2);

      const validated = validator.recordValidation(lesson);
      expect(validated.consecutiveContradictions).toBe(0);
    });

    it('should increase confidence slightly', () => {
      const lesson = createStoredLesson({ confidence: 0.5 });
      const updated = validator.recordValidation(lesson);

      expect(updated.confidence).toBeCloseTo(0.55); // 0.5 + 0.05
    });

    it('should cap confidence at 1', () => {
      const lesson = createStoredLesson({ confidence: 0.98 });
      const updated = validator.recordValidation(lesson);

      expect(updated.confidence).toBe(1);
    });
  });

  // ---- calculateRelevance ------------------------------------------------
  describe('calculateRelevance', () => {
    it('should return 1.0 for a brand-new lesson', () => {
      const lesson = createStoredLesson();
      const relevance = validator.calculateRelevance(lesson);
      expect(relevance).toBeCloseTo(1.0);
    });

    it('should decrease relevance over time', () => {
      const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
      const lesson = createStoredLesson({ createdAt: past, relevanceScore: 1.0 });
      const relevance = validator.calculateRelevance(lesson);

      // After 30 days with decayRate=0.01: e^(-0.01*30) = e^(-0.3) ≈ 0.7408
      expect(relevance).toBeLessThan(1.0);
      expect(relevance).toBeGreaterThan(0.5);
    });

    it('should return near 0 for very old lessons', () => {
      const ancient = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year ago
      const lesson = createStoredLesson({ createdAt: ancient, relevanceScore: 1.0 });
      const relevance = validator.calculateRelevance(lesson);

      expect(relevance).toBeLessThan(0.1);
    });

    it('should not return negative', () => {
      const ancient = new Date(Date.now() - 10000 * 24 * 60 * 60 * 1000).toISOString();
      const lesson = createStoredLesson({ createdAt: ancient, relevanceScore: 1.0 });
      const relevance = validator.calculateRelevance(lesson);

      expect(relevance).toBeGreaterThanOrEqual(0);
    });

    it('should not exceed 1', () => {
      const lesson = createStoredLesson({ relevanceScore: 0.5 });
      const relevance = validator.calculateRelevance(lesson);
      expect(relevance).toBeLessThanOrEqual(1);
    });
  });

  // ---- isExpired ---------------------------------------------------------
  describe('isExpired', () => {
    it('should not expire a new lesson', () => {
      const lesson = createStoredLesson();
      expect(validator.isExpired(lesson)).toBe(false);
    });

    it('should expire after TTL', () => {
      const past = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(); // 31 days
      const lesson = createStoredLesson({ createdAt: past, ttlMs: 30 * 24 * 60 * 60 * 1000 });
      expect(validator.isExpired(lesson)).toBe(true);
    });

    it('should not expire before TTL', () => {
      const recent = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days
      const lesson = createStoredLesson({ createdAt: recent, ttlMs: 30 * 24 * 60 * 60 * 1000 });
      expect(validator.isExpired(lesson)).toBe(false);
    });

    it('should not expire at exact TTL boundary (uses strict >)', () => {
      const exact = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const lesson = createStoredLesson({ createdAt: exact, ttlMs: 30 * 24 * 60 * 60 * 1000 });
      // isExpired uses strict >, so exact boundary is NOT expired
      expect(validator.isExpired(lesson)).toBe(false);
    });
  });

  // ---- prune -------------------------------------------------------------
  describe('prune', () => {
    it('should keep active lessons with good relevance', () => {
      const lesson = createStoredLesson();
      const result = validator.prune([lesson]);
      expect(result.remaining).toBe(1);
      expect(result.pruned.length).toBe(0);
      expect(result.deprecated.length).toBe(0);
    });

    it('should prune expired lessons', () => {
      const past = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const lesson = createStoredLesson({ createdAt: past });
      const result = validator.prune([lesson]);
      expect(result.pruned.length).toBe(1);
      expect(result.remaining).toBe(0);
    });

    it('should remove deprecated lessons separately', () => {
      let lesson = createStoredLesson();
      for (let i = 0; i < 3; i++) lesson = validator.recordContradiction(lesson);
      const result = validator.prune([lesson]);
      expect(result.deprecated.length).toBe(1);
      expect(result.pruned.length).toBe(0);
    });

    it('should prune lessons with relevance below 0.1', () => {
      const ancient = new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString();
      const lesson = createStoredLesson({ createdAt: ancient, relevanceScore: 1.0 });
      const result = validator.prune([lesson]);
      expect(result.pruned.length).toBe(1);
    });

    it('should not prune a recent lesson despite low initial relevance', () => {
      const lesson = createStoredLesson({ relevanceScore: 0.5, createdAt: now().toISOString() });
      const result = validator.prune([lesson]);
      expect(result.remaining).toBe(1);
      expect(result.pruned.length).toBe(0);
    });

    it('should handle empty list', () => {
      const result = validator.prune([]);
      expect(result.remaining).toBe(0);
      expect(result.pruned.length).toBe(0);
      expect(result.deprecated.length).toBe(0);
    });

    it('should handle single lesson', () => {
      const lesson = createStoredLesson();
      const result = validator.prune([lesson]);
      expect(result.remaining).toBe(1);
    });
  });

  // ---- supersede ---------------------------------------------------------
  describe('supersede', () => {
    it('should mark old lesson as superseded', () => {
      const old = createStoredLesson();
      const newLesson = createCandidate();
      const result = validator.supersede(old, newLesson);

      expect(result.old.status).toBe('superseded');
      expect(result.old.id).toBe(old.id);
    });

    it('should create new active lesson', () => {
      const old = createStoredLesson();
      const newLesson = createCandidate();
      const result = validator.supersede(old, newLesson);

      expect(result.new.status).toBe('active');
      expect(result.new.statement).toBe(newLesson.statement);
    });

    it('should preserve old lesson statement for audit', () => {
      const old = createStoredLesson({ statement: 'Use SQLite for everything' });
      const newLesson = createCandidate({ statement: 'Use PostgreSQL for scale' });
      const result = validator.supersede(old, newLesson);

      expect(result.old.statement).toBe('Use SQLite for everything');
      expect(result.new.statement).toBe('Use PostgreSQL for scale');
    });
  });

  // ---- Edge cases: recent lesson with low usage --------------------------
  describe('Edge cases', () => {
    it('should not prune a brand-new lesson with low usage', () => {
      const lesson = createStoredLesson({
        evidenceCount: 1,
        relevanceScore: 1.0,
        createdAt: now().toISOString(),
      });
      const result = validator.prune([lesson]);
      expect(result.remaining).toBe(1);
    });

    it('should not expire with 0ms TTL if just created (strict >)', () => {
      const lesson = createStoredLesson({ ttlMs: 0 });
      // 0ms TTL with strict > means 0 > 0 = false, so not expired
      // But if time passes even 1ms, it expires
      expect(validator.isExpired(lesson)).toBe(false);
    });

    it('should expire with 0ms TTL after any time passes', () => {
      const past = new Date(Date.now() - 1).toISOString(); // 1ms ago
      const lesson = createStoredLesson({ ttlMs: 0, createdAt: past });
      expect(validator.isExpired(lesson)).toBe(true);
    });

    it('should handle relevance score of 0 on creation', () => {
      const lesson = createStoredLesson({ relevanceScore: 0 });
      const result = validator.prune([lesson]);
      expect(result.pruned.length).toBe(1);
    });
  });
});

// ===========================================================================
// Cascading Failure Grouping
// ===========================================================================
describe('DiscrepancyDetector — Cascading Failure Grouping', () => {
  let detector: DiscrepancyDetector;

  beforeEach(() => {
    detector = new DiscrepancyDetector();
  });

  const rootCauseExtractor = (o: MissionOutcome): string => {
    if (o.actualOutcome.includes('timeout')) return 'connection_timeout';
    if (o.actualOutcome.includes('permission')) return 'permission_denied';
    return 'unknown';
  };

  const categoryExtractor = (o: MissionOutcome): FailureCategory => {
    if (o.actualOutcome.includes('timeout')) return 'external_dependency';
    if (o.actualOutcome.includes('permission')) return 'constraint_violation';
    return 'unknown';
  };

  // ---- Basic grouping ----------------------------------------------------
  describe('Basic grouping', () => {
    it('should group failures within the same time window and root cause', () => {
      const baseTime = Date.now();
      const outcomes = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString() }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 60_000).toISOString() }),
      ];

      const groups = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
      });

      expect(groups.length).toBe(1);
      expect(groups[0].count).toBe(2);
      expect(groups[0].rootCause).toBe('connection_timeout');
    });

    it('should not group failures outside the time window', () => {
      const baseTime = Date.now();
      const outcomes = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString() }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 600_000).toISOString() }), // 10 min later
      ];

      const groups = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
      });

      expect(groups.length).toBe(0); // each group has only 1, below minGroupSize=2
    });

    it('should separate failures with different root causes', () => {
      const baseTime = Date.now();
      const outcomes = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString() }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 60_000).toISOString() }),
        createFailureOutcome({ missionId: 'm-3', actualOutcome: 'permission denied', timestamp: new Date(baseTime + 120_000).toISOString() }),
        createFailureOutcome({ missionId: 'm-4', actualOutcome: 'permission denied', timestamp: new Date(baseTime + 180_000).toISOString() }),
      ];

      const groups = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
      });

      expect(groups.length).toBe(2);
      expect(groups[0].rootCause).toBe('connection_timeout');
      expect(groups[1].rootCause).toBe('permission_denied');
    });

    it('should produce a single consolidated lesson per group', () => {
      const baseTime = Date.now();
      const outcomes = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString() }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 60_000).toISOString() }),
        createFailureOutcome({ missionId: 'm-3', actualOutcome: 'timeout', timestamp: new Date(baseTime + 120_000).toISOString() }),
      ];

      const groups = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
      });

      expect(groups.length).toBe(1);
      expect(groups[0].consolidatedLesson).toBeDefined();
      expect(groups[0].consolidatedLesson.statement).toContain('connection_timeout');
      expect(groups[0].consolidatedLesson.statement).toContain('3 consecutive');
    });
  });

  // ---- Timestamps and ordering -------------------------------------------
  describe('Timestamp ordering', () => {
    it('should handle unsorted timestamps', () => {
      const baseTime = Date.now();
      const outcomes = [
        createFailureOutcome({ missionId: 'm-3', actualOutcome: 'timeout', timestamp: new Date(baseTime + 120_000).toISOString() }),
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString() }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 60_000).toISOString() }),
      ];

      const groups = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
      });

      expect(groups.length).toBe(1);
      expect(groups[0].count).toBe(3);
    });
  });

  // ---- Configurable window -----------------------------------------------
  describe('Configurable window', () => {
    it('should respect custom timeWindowMs', () => {
      const baseTime = Date.now();
      const outcomes = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString() }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 100_000).toISOString() }), // 100s later
      ];

      // With 1 minute window → should NOT group
      const shortWindow = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
        config: { timeWindowMs: 60_000 },
      });
      expect(shortWindow.length).toBe(0);

      // With 5 minute window → should group
      const longWindow = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
        config: { timeWindowMs: 300_000 },
      });
      expect(longWindow.length).toBe(1);
    });

    it('should handle 0ms window (no grouping unless same timestamp)', () => {
      const baseTime = Date.now();
      const outcomes = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString() }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 1).toISOString() }),
      ];

      const groups = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
        config: { timeWindowMs: 0 },
      });
      // With 0ms window, only same-timestamp failures group; these differ by 1ms
      expect(groups.length).toBe(0);
    });
  });

  // ---- Edge cases --------------------------------------------------------
  describe('Edge cases', () => {
    it('should handle empty outcome list', () => {
      const groups = detector.groupCascadingFailures({
        outcomes: [],
        rootCauseExtractor,
        categoryExtractor,
      });
      expect(groups.length).toBe(0);
    });

    it('should handle single failure (below minGroupSize)', () => {
      const outcomes = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: now().toISOString() }),
      ];

      const groups = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
      });
      expect(groups.length).toBe(0);
    });

    it('should skip successful outcomes', () => {
      const baseTime = Date.now();
      const outcomes = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString(), success: true }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 60_000).toISOString() }),
      ];

      const groups = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
      });
      expect(groups.length).toBe(0); // only 1 failure, below minGroupSize
    });

    it('should set correct timestamp range in group', () => {
      const baseTime = Date.now();
      const outcomes = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString() }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 120_000).toISOString() }),
      ];

      const groups = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
      });

      expect(groups.length).toBe(1);
      expect(new Date(groups[0].timestampRange.first).getTime()).toBe(baseTime);
      expect(new Date(groups[0].timestampRange.last).getTime()).toBe(baseTime + 120_000);
    });

    it('should include all mission IDs in group', () => {
      const baseTime = Date.now();
      const outcomes = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString() }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 60_000).toISOString() }),
        createFailureOutcome({ missionId: 'm-3', actualOutcome: 'timeout', timestamp: new Date(baseTime + 120_000).toISOString() }),
      ];

      const groups = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
      });

      expect(groups[0].missionIds).toEqual(['m-1', 'm-2', 'm-3']);
    });

    it('should classify group severity by count', () => {
      const baseTime = Date.now();

      // 2 failures → moderate
      const twoFailures = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString() }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 60_000).toISOString() }),
      ];
      const g2 = detector.groupCascadingFailures({ outcomes: twoFailures, rootCauseExtractor, categoryExtractor });
      expect(g2[0].severity).toBe('moderate');

      // 3 failures → major
      const threeFailures = [
        ...twoFailures,
        createFailureOutcome({ missionId: 'm-3', actualOutcome: 'timeout', timestamp: new Date(baseTime + 120_000).toISOString() }),
      ];
      const g3 = detector.groupCascadingFailures({ outcomes: threeFailures, rootCauseExtractor, categoryExtractor });
      expect(g3[0].severity).toBe('major');

      // 5+ failures → critical
      const fiveFailures = [
        ...threeFailures,
        createFailureOutcome({ missionId: 'm-4', actualOutcome: 'timeout', timestamp: new Date(baseTime + 180_000).toISOString() }),
        createFailureOutcome({ missionId: 'm-5', actualOutcome: 'timeout', timestamp: new Date(baseTime + 240_000).toISOString() }),
      ];
      const g5 = detector.groupCascadingFailures({ outcomes: fiveFailures, rootCauseExtractor, categoryExtractor });
      expect(g5[0].severity).toBe('critical');
    });

    it('should increase consolidated lesson confidence with more failures', () => {
      const baseTime = Date.now();
      const outcomes = [
        createFailureOutcome({ missionId: 'm-1', actualOutcome: 'timeout', timestamp: new Date(baseTime).toISOString() }),
        createFailureOutcome({ missionId: 'm-2', actualOutcome: 'timeout', timestamp: new Date(baseTime + 60_000).toISOString() }),
      ];

      const groups = detector.groupCascadingFailures({
        outcomes,
        rootCauseExtractor,
        categoryExtractor,
      });

      // confidence = min(1, 0.6 + 2*0.05) = 0.7
      expect(groups[0].consolidatedLesson.confidence).toBeCloseTo(0.7);
    });
  });
});
