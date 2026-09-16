// ============================================================================
// AGI OS - Reflection Package
// Expected vs Actual → Root Cause → Evidence-Validated Lessons
// ============================================================================

// Types
export type {
  MissionOutcome,
  Discrepancy,
  DiscrepancyType,
  DiscrepancySeverity,
  FailureAnalysis,
  FailureCategory,
  RootCause,
  RootCauseConfidence,
  CandidateLesson,
  LessonCategory,
  LessonImpact,
  LessonValidation,
  ValidationStatus,
  ReflectionRecord,
  ValidatedLesson,
  ReflectionInput,
  ReflectionOutput,
  MemoryWrite,
  // Phase 5 Enhancement: Lesson Decay
  LessonStatus,
  StoredLesson,
  LessonDecayConfig,
  PruneResult,
  // Phase 5 Enhancement: Cascading Failure
  FailureGroup,
  CascadingFailureConfig,
} from './types.js';

// Outcome Analyzer
export { OutcomeAnalyzer, createOutcomeAnalyzer } from './outcome-analyzer.js';

// Discrepancy Detector
export { DiscrepancyDetector, createDiscrepancyDetector } from './discrepancy-detector.js';

// Failure Analyzer
export { FailureAnalyzer, createFailureAnalyzer } from './failure-analyzer.js';

// Root Cause Extractor
export { RootCauseExtractor, createRootCauseExtractor } from './root-cause.js';

// Lesson Generator
export { LessonGenerator, createLessonGenerator } from './lesson-generator.js';

// Lesson Validator
export { LessonValidator, createLessonValidator } from './lesson-validator.js';

// Reflection Engine
export { ReflectionEngine, createReflectionEngine } from './reflection-engine.js';
