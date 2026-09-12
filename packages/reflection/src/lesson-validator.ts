import { generateId, now } from '@agi-os/kernel';
import type {
  CandidateLesson,
  LessonValidation,
  ValidationStatus,
  StoredLesson,
  LessonDecayConfig,
  LessonStatus,
  PruneResult,
  LessonCategory,
  LessonImpact,
} from './types.js';

export interface ExistingLesson {
  id: string;
  statement: string;
  confidence: number;
  evidenceCount: number;
}

export class LessonValidator {
  private existingLessons: ExistingLesson[] = [];

  setExistingLessons(lessons: ExistingLesson[]): void {
    this.existingLessons = lessons;
  }

  addExistingLesson(lesson: ExistingLesson): void {
    this.existingLessons.push(lesson);
  }

  validate(lesson: CandidateLesson, evidenceCount: number): LessonValidation {
    const contradicting = this.findContradictions(lesson);
    const supporting = this.findSupporting(lesson);

    const totalEvidence = evidenceCount + supporting.length;
    const status = this.determineStatus(totalEvidence, contradicting.length, lesson.confidence);
    const confidence = this.calculateValidationConfidence(
      status,
      totalEvidence,
      contradicting.length,
      lesson.confidence
    );

    const reasons = this.generateReasons(status, totalEvidence, contradicting.length);

    return {
      lessonId: lesson.id,
      status,
      evidenceCount: totalEvidence,
      contradictingEvidenceCount: contradicting.length,
      confidence,
      reasons,
    };
  }

  validateAll(
    lessons: CandidateLesson[],
    evidenceCount: number
  ): Map<string, LessonValidation> {
    const results = new Map<string, LessonValidation>();
    for (const lesson of lessons) {
      results.set(lesson.id, this.validate(lesson, evidenceCount));
    }
    return results;
  }

  private findContradictions(lesson: CandidateLesson): ExistingLesson[] {
    return this.existingLessons.filter((existing) => {
      const similarity = this.statementSimilarity(existing.statement, lesson.statement);
      const isOpposite = this.isContradictory(existing.statement, lesson.statement);
      return similarity > 0.5 && isOpposite;
    });
  }

  private findSupporting(lesson: CandidateLesson): ExistingLesson[] {
    return this.existingLessons.filter((existing) => {
      const similarity = this.statementSimilarity(existing.statement, lesson.statement);
      return similarity > 0.6 && !this.isContradictory(existing.statement, lesson.statement);
    });
  }

  private determineStatus(
    evidenceCount: number,
    contradictionCount: number,
    lessonConfidence: number
  ): ValidationStatus {
    if (contradictionCount > 0) return 'contradicted';
    if (evidenceCount === 0) return 'insufficient_evidence';
    if (evidenceCount >= 3 && lessonConfidence > 0.6) return 'validated';
    if (evidenceCount >= 1) return 'weak';
    return 'insufficient_evidence';
  }

  private calculateValidationConfidence(
    status: ValidationStatus,
    evidenceCount: number,
    contradictionCount: number,
    lessonConfidence: number
  ): number {
    let confidence = lessonConfidence;

    switch (status) {
      case 'validated':
        confidence = Math.min(1, confidence + 0.2 + evidenceCount * 0.05);
        break;
      case 'weak':
        confidence = confidence * 0.8;
        break;
      case 'contradicted':
        confidence = Math.max(0, confidence - 0.4 - contradictionCount * 0.1);
        break;
      case 'insufficient_evidence':
        confidence = confidence * 0.5;
        break;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private generateReasons(
    status: ValidationStatus,
    evidenceCount: number,
    contradictionCount: number
  ): string[] {
    const reasons: string[] = [];

    switch (status) {
      case 'validated':
        reasons.push(`${evidenceCount} supporting evidence found`);
        reasons.push('No contradicting evidence');
        break;
      case 'weak':
        reasons.push(`Only ${evidenceCount} evidence found`);
        reasons.push('Need more evidence for strong validation');
        break;
      case 'contradicted':
        reasons.push(`${contradictionCount} contradicting evidence found`);
        reasons.push('Lesson may not be universally applicable');
        break;
      case 'insufficient_evidence':
        reasons.push('No evidence available to validate');
        reasons.push('Lesson should be treated as hypothesis');
        break;
    }

    return reasons;
  }

  private statementSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    let intersection = 0;
    for (const w of wordsA) {
      if (wordsB.has(w)) intersection++;
    }
    const union = wordsA.size + wordsB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private isContradictory(a: string, b: string): boolean {
    const negations = ['not', 'never', 'no', 'should not', 'avoid', 'do not'];
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();

    for (const neg of negations) {
      if (aLower.includes(neg) && !bLower.includes(neg)) return true;
      if (!aLower.includes(neg) && bLower.includes(neg)) return true;
    }
    return false;
  }

  getValidated(lessons: CandidateLesson[], evidenceCount: number): CandidateLesson[] {
    return lessons.filter((l) => {
      const v = this.validate(l, evidenceCount);
      return v.status === 'validated' || v.status === 'weak';
    });
  }

  getContradicted(lessons: CandidateLesson[], evidenceCount: number): CandidateLesson[] {
    return lessons.filter((l) => {
      const v = this.validate(l, evidenceCount);
      return v.status === 'contradicted';
    });
  }

  // -----------------------------------------------------------------------
  // Lesson Decay & Pruning (Phase 5 Enhancement)
  // -----------------------------------------------------------------------

  /**
   * Convert a CandidateLesson to a StoredLesson with decay metadata
   */
  storeLesson(
    lesson: CandidateLesson,
    config?: Partial<LessonDecayConfig>
  ): StoredLesson {
    const cfg = { ...DEFAULT_DECAY_CONFIG, ...config };
    const ts = now().toISOString();

    return {
      id: generateId(),
      statement: lesson.statement,
      category: lesson.category,
      impact: lesson.impact,
      confidence: lesson.confidence,
      evidenceCount: 1,
      contradictionCount: 0,
      status: 'active',
      createdAt: ts,
      lastValidatedAt: ts,
      lastContradictedAt: null,
      consecutiveContradictions: 0,
      ttlMs: cfg.defaultTtlMs,
      relevanceScore: 1.0,
    };
  }

  /**
   * Record a contradiction against a stored lesson
   */
  recordContradiction(lesson: StoredLesson): StoredLesson {
    const updated = { ...lesson };
    updated.contradictionCount++;
    updated.consecutiveContradictions++;
    updated.lastContradictedAt = now().toISOString();
    updated.confidence = Math.max(0, updated.confidence - 0.15);

    // Deprecate after threshold
    if (updated.consecutiveContradictions >= DEFAULT_DECAY_CONFIG.contradictionThreshold) {
      updated.status = 'deprecated';
    }

    return updated;
  }

  /**
   * Record a validation (supporting evidence) for a stored lesson
   */
  recordValidation(lesson: StoredLesson): StoredLesson {
    const updated = { ...lesson };
    updated.evidenceCount++;
    updated.consecutiveContradictions = 0; // reset streak
    updated.lastValidatedAt = now().toISOString();
    updated.confidence = Math.min(1, updated.confidence + 0.05);
    updated.relevanceScore = Math.min(1, updated.relevanceScore + 0.1);

    return updated;
  }

  /**
   * Calculate current relevance based on time since creation
   */
  calculateRelevance(lesson: StoredLesson, currentTime?: string): number {
    const nowMs = new Date(currentTime ?? now()).getTime();
    const createdMs = new Date(lesson.createdAt).getTime();
    const ageDays = (nowMs - createdMs) / (1000 * 60 * 60 * 24);

    const decayed = lesson.relevanceScore * Math.exp(-DEFAULT_DECAY_CONFIG.decayRate * ageDays);
    return Math.max(0, Math.min(1, decayed));
  }

  /**
   * Check if a lesson has expired (TTL exceeded)
   */
  isExpired(lesson: StoredLesson, currentTime?: string): boolean {
    const nowMs = new Date(currentTime ?? now()).getTime();
    const createdMs = new Date(lesson.createdAt).getTime();
    return (nowMs - createdMs) > lesson.ttlMs;
  }

  /**
   * Prune a collection of stored lessons
   */
  prune(lessons: StoredLesson[], currentTime?: string): PruneResult {
    const pruned: StoredLesson[] = [];
    const deprecated: StoredLesson[] = [];
    const remaining: StoredLesson[] = [];

    for (const lesson of lessons) {
      const relevance = this.calculateRelevance(lesson, currentTime);
      const expired = this.isExpired(lesson, currentTime);

      if (lesson.status === 'deprecated' || expired || relevance < DEFAULT_DECAY_CONFIG.minRelevance) {
        if (lesson.status === 'deprecated') {
          deprecated.push(lesson);
        } else {
          pruned.push(lesson);
        }
      } else {
        remaining.push({ ...lesson, relevanceScore: relevance });
      }
    }

    return { pruned, deprecated, remaining: remaining.length };
  }

  /**
   * Supersede an old lesson with a new one
   */
  supersede(oldLesson: StoredLesson, newLesson: CandidateLesson): {
    old: StoredLesson;
    new: StoredLesson;
  } {
    const superseded: StoredLesson = { ...oldLesson, status: 'superseded' };
    const stored = this.storeLesson(newLesson);
    return { old: superseded, new: stored };
  }
}

const DEFAULT_DECAY_CONFIG: LessonDecayConfig = {
  defaultTtlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  decayRate: 0.01,
  contradictionThreshold: 3,
  minRelevance: 0.1,
};

export function createLessonValidator(): LessonValidator {
  return new LessonValidator();
}
