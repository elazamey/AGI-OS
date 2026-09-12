// ============================================================================
// AGI OS - Generalization Package
// Cross-domain testing harness — Phase 10
// ============================================================================

// Types
export { OperationalDomain } from './types.js';
export type {
  DomainScenario,
  ScenarioResult,
  InterceptResult,
  EvaluationReport,
  DomainEvaluation,
  EvaluationConfig,
} from './types.js';

// Scenarios
export { crossDomainScenarios } from './scenarios.js';

// Evaluator
export { GeneralizationEvaluator, createGeneralizationEvaluator } from './evaluator.js';
