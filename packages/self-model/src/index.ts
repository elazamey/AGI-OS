// ============================================================================
// AGI OS - Self-Model Package
// System knows itself: capabilities, limitations, confidence, reliability
// ============================================================================

// Types
export type {
  ToolCapability,
  ProviderCapability,
  Limitation,
  LimitationSeverity,
  DomainConfidence,
  ConfidenceSample,
  ReliabilityRecord,
  FailureEvent,
  FailurePattern,
  PatternSignature,
  PatternFrequency,
  SelfModelSnapshot,
  SelfModelUpdateEvent,
  UpdateEventType,
} from './types.js';

// Capabilities
export { CapabilityTracker, createCapabilityTracker } from './capabilities.js';

// Limitations
export { LimitationRegistry, createLimitationRegistry } from './limitations.js';

// Confidence
export { ConfidenceScorer, createConfidenceScorer } from './confidence.js';

// Reliability
export { ReliabilityTracker, createReliabilityTracker } from './reliability.js';

// Patterns
export { PatternDetector, createPatternDetector } from './patterns.js';

// Self-Model Orchestrator
export { SelfModel, createSelfModel } from './self-model.js';
