// ============================================================================
// AGI OS - Reflection Engine
// Orchestrates: Outcome → Discrepancy → Failure → Root Cause → Lesson → Validate
// NO memory writes without evidence validation
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  ReflectionInput,
  ReflectionOutput,
  ReflectionRecord,
  ValidatedLesson,
  MemoryWrite,
  CandidateLesson,
  LessonValidation,
} from './types.js';
import { OutcomeAnalyzer } from './outcome-analyzer.js';
import { DiscrepancyDetector } from './discrepancy-detector.js';
import { FailureAnalyzer } from './failure-analyzer.js';
import { RootCauseExtractor } from './root-cause.js';
import { LessonGenerator } from './lesson-generator.js';
import { LessonValidator } from './lesson-validator.js';

// ---------------------------------------------------------------------------
// Reflection Engine — learns from outcomes
// ---------------------------------------------------------------------------
export class ReflectionEngine {
  private outcomeAnalyzer: OutcomeAnalyzer;
  private discrepancyDetector: DiscrepancyDetector;
  private failureAnalyzer: FailureAnalyzer;
  private rootCauseExtractor: RootCauseExtractor;
  private lessonGenerator: LessonGenerator;
  private lessonValidator: LessonValidator;

  private reflections: ReflectionRecord[] = [];

  constructor(params?: {
    outcomeAnalyzer?: OutcomeAnalyzer;
    discrepancyDetector?: DiscrepancyDetector;
    failureAnalyzer?: FailureAnalyzer;
    rootCauseExtractor?: RootCauseExtractor;
    lessonGenerator?: LessonGenerator;
    lessonValidator?: LessonValidator;
  }) {
    this.outcomeAnalyzer = params?.outcomeAnalyzer ?? new OutcomeAnalyzer();
    this.discrepancyDetector = params?.discrepancyDetector ?? new DiscrepancyDetector();
    this.failureAnalyzer = params?.failureAnalyzer ?? new FailureAnalyzer();
    this.rootCauseExtractor = params?.rootCauseExtractor ?? new RootCauseExtractor();
    this.lessonGenerator = params?.lessonGenerator ?? new LessonGenerator();
    this.lessonValidator = params?.lessonValidator ?? new LessonValidator();
  }

  /**
   * Run full reflection pipeline on a mission outcome
   *
   * Outcome → Discrepancy → Failure → Root Cause → Lesson → Validate → Memory
   */
  async reflect(input: ReflectionInput): Promise<ReflectionOutput> {
    // 1. Analyze outcome
    const outcome = this.outcomeAnalyzer.analyze(input);

    // 2. Detect discrepancies
    const discrepancies = this.outcomeAnalyzer.detectDiscrepancies(outcome);

    // 3. Analyze failures (only if there are significant discrepancies)
    const failureAnalyses = this.failureAnalyzer.analyze({ outcome, discrepancies });

    // 4. Extract root causes
    const rootCauses = this.rootCauseExtractor.extract({ outcome, failureAnalyses });

    // 5. Generate candidate lessons
    const candidateLessons = this.lessonGenerator.generate({ outcome, rootCauses });

    // 6. Validate lessons (evidence check + contradiction check)
    const validatedLessons = this.validateLessons(candidateLessons, input.evidenceRefs.length);

    // 7. Build reflection record
    const reflection: ReflectionRecord = {
      id: generateId(),
      missionId: input.missionId,
      goalId: input.goalId,
      outcome,
      discrepancies,
      failureAnalyses,
      rootCauses,
      candidateLessons,
      validatedLessons,
      evidenceRefs: input.evidenceRefs,
      sourceEventIds: input.sourceEventIds,
      confidence: this.calculateReflectionConfidence(
        discrepancies,
        failureAnalyses,
        rootCauses,
        validatedLessons
      ),
      reflectedAt: now().toISOString(),
    };

    this.reflections.push(reflection);

    // 8. Generate memory writes for validated lessons
    const memoryWrites = this.generateMemoryWrites(reflection);

    return {
      reflection,
      lessonsUpdated: validatedLessons.length,
      memoryWrites,
    };
  }

  /**
   * Get all reflections
   */
  getReflections(): ReflectionRecord[] {
    return [...this.reflections];
  }

  /**
   * Get reflection by ID
   */
  getReflection(id: string): ReflectionRecord | undefined {
    return this.reflections.find((r) => r.id === id);
  }

  /**
   * Get reflections for a mission
   */
  getReflectionsForMission(missionId: string): ReflectionRecord[] {
    return this.reflections.filter((r) => r.missionId === missionId);
  }

  /**
   * Get all validated lessons across reflections
   */
  getAllValidatedLessons(): ValidatedLesson[] {
    return this.reflections.flatMap((r) => r.validatedLessons);
  }

  /**
   * Set existing lessons for contradiction checking
   */
  setExistingLessons(lessons: Array<{ id: string; statement: string; confidence: number; evidenceCount: number }>): void {
    this.lessonValidator.setExistingLessons(lessons);
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------
  private validateLessons(
    lessons: CandidateLesson[],
    evidenceCount: number
  ): ValidatedLesson[] {
    const validations = this.lessonValidator.validateAll(lessons, evidenceCount);

    const validated: ValidatedLesson[] = [];

    for (const lesson of lessons) {
      const validation = validations.get(lesson.id);
      if (!validation) continue;

      // Only include validated or weak lessons (not contradicted or insufficient)
      if (validation.status === 'validated' || validation.status === 'weak') {
        validated.push({
          lesson,
          validation,
          memoryType: this.determineMemoryType(lesson),
        });
      }
    }

    return validated;
  }

  private determineMemoryType(lesson: CandidateLesson): 'procedural' | 'semantic' | 'episodic' {
    switch (lesson.category) {
      case 'procedural':
      case 'tactical':
        return 'procedural';
      case 'strategic':
      case 'constraint_awareness':
        return 'semantic';
      case 'environmental':
      case 'resource':
        return 'episodic';
      default:
        return 'procedural';
    }
  }

  private calculateReflectionConfidence(
    discrepancies: any[],
    failureAnalyses: any[],
    rootCauses: any[],
    validatedLessons: ValidatedLesson[]
  ): number {
    let confidence = 0.5;

    // More evidence-based analysis = higher confidence
    if (failureAnalyses.length > 0) confidence += 0.1;
    if (rootCauses.length > 0) confidence += 0.1;
    if (validatedLessons.length > 0) confidence += 0.1;

    // High-confidence root causes boost confidence
    const highConfRootCauses = rootCauses.filter((rc) => rc.confidence === 'high');
    if (highConfRootCauses.length > 0) confidence += 0.1;

    // Validated lessons with high confidence
    const highConfLessons = validatedLessons.filter((v) => v.validation.confidence > 0.7);
    if (highConfLessons.length > 0) confidence += 0.1;

    return Math.max(0, Math.min(1, confidence));
  }

  private generateMemoryWrites(reflection: ReflectionRecord): MemoryWrite[] {
    const writes: MemoryWrite[] = [];

    for (const vl of reflection.validatedLessons) {
      writes.push({
        memoryType: vl.memoryType,
        content: {
          type: 'lesson',
          statement: vl.lesson.statement,
          category: vl.lesson.category,
          impact: vl.lesson.impact,
          suggestedAction: vl.lesson.suggestedAction,
          applicability: vl.lesson.applicability,
          prerequisites: vl.lesson.prerequisites,
          sourceMissionId: reflection.missionId,
          sourceRootCauseId: vl.lesson.rootCauseId,
        },
        confidence: vl.validation.confidence,
        sourceReflectionId: reflection.id,
      });
    }

    // Also write an episodic memory of the reflection itself
    if (reflection.discrepancies.length > 0) {
      writes.push({
        memoryType: 'episodic',
        content: {
          type: 'reflection',
          missionId: reflection.missionId,
          goalId: reflection.goalId,
          success: reflection.outcome.success,
          discrepancyCount: reflection.discrepancies.length,
          rootCauseCount: reflection.rootCauses.length,
          lessonCount: reflection.validatedLessons.length,
          confidence: reflection.confidence,
        },
        confidence: reflection.confidence,
        sourceReflectionId: reflection.id,
      });
    }

    return writes;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createReflectionEngine(params?: {
  outcomeAnalyzer?: OutcomeAnalyzer;
  discrepancyDetector?: DiscrepancyDetector;
  failureAnalyzer?: FailureAnalyzer;
  rootCauseExtractor?: RootCauseExtractor;
  lessonGenerator?: LessonGenerator;
  lessonValidator?: LessonValidator;
}): ReflectionEngine {
  return new ReflectionEngine(params);
}
