// ============================================================================
// AGI OS - Self-Model Orchestrator
// Unifies capabilities, limitations, confidence, reliability, patterns
// ============================================================================

import { now } from '@agi-os/kernel';
import type {
  SelfModelSnapshot,
  SelfModelUpdateEvent,
  ToolCapability,
  ProviderCapability,
  Limitation,
  DomainConfidence,
  ReliabilityRecord,
  FailurePattern,
} from './types.js';
import { CapabilityTracker } from './capabilities.js';
import { LimitationRegistry } from './limitations.js';
import { ConfidenceScorer } from './confidence.js';
import { ReliabilityTracker } from './reliability.js';
import { PatternDetector } from './patterns.js';

// ---------------------------------------------------------------------------
// SelfModel — the system's self-awareness layer
// ---------------------------------------------------------------------------
export class SelfModel {
  private capabilities: CapabilityTracker;
  private limitations: LimitationRegistry;
  private confidence: ConfidenceScorer;
  private reliability: ReliabilityTracker;
  private patterns: PatternDetector;
  private eventHistory: SelfModelUpdateEvent[] = [];

  constructor(params?: {
    capabilities?: CapabilityTracker;
    limitations?: LimitationRegistry;
    confidence?: ConfidenceScorer;
    reliability?: ReliabilityTracker;
    patterns?: PatternDetector;
  }) {
    this.capabilities = params?.capabilities ?? new CapabilityTracker();
    this.limitations = params?.limitations ?? new LimitationRegistry();
    this.confidence = params?.confidence ?? new ConfidenceScorer();
    this.reliability = params?.reliability ?? new ReliabilityTracker();
    this.patterns = params?.patterns ?? new PatternDetector();
  }

  // ---- Event processing --------------------------------------------------

  /**
   * Process a self-model update event
   */
  processEvent(event: SelfModelUpdateEvent): void {
    this.eventHistory.push(event);

    switch (event.type) {
      case 'tool_succeeded':
        this.capabilities.recordToolUse(
          event.componentId,
          true,
          (event.data.latencyMs as number) ?? 0
        );
        this.reliability.recordSuccess(event.componentId, (event.data.latencyMs as number) ?? 0);
        break;

      case 'tool_failed':
        this.capabilities.recordToolUse(
          event.componentId,
          false,
          (event.data.latencyMs as number) ?? 0,
          event.data.errorType as string
        );
        this.reliability.getOrCreate(event.componentId, 'tool');
        this.reliability.recordFailure(
          event.componentId,
          (event.data.errorType as string) ?? 'unknown',
          (event.data.errorMessage as string) ?? '',
          (event.data.latencyMs as number) ?? 0
        );
        break;

      case 'provider_succeeded':
        this.capabilities.recordProviderUse(
          event.componentId,
          true,
          (event.data.latencyMs as number) ?? 0,
          (event.data.tokensPerSecond as number) ?? 0
        );
        break;

      case 'provider_failed':
        this.capabilities.recordProviderUse(
          event.componentId,
          false,
          (event.data.latencyMs as number) ?? 0,
          0
        );
        break;

      case 'limitation_hit': {
        const { limitation, isNew } = this.limitations.recordIfNew({
          category: (event.data.category as Limitation['category']) ?? 'unknown',
          description: (event.data.description as string) ?? event.componentId,
          severity: (event.data.severity as Limitation['severity']) ?? 'minor',
          workaround: event.data.workaround as string | undefined,
        });
        if (!isNew) {
          this.limitations.hit(limitation.id);
        }
        break;
      }

      case 'limitation_discovered':
        this.limitations.discover({
          category: (event.data.category as Limitation['category']) ?? 'unknown',
          description: (event.data.description as string) ?? event.componentId,
          severity: (event.data.severity as Limitation['severity']) ?? 'minor',
          workaround: event.data.workaround as string | undefined,
          autoDetected: true,
        });
        break;

      case 'mission_completed':
        this.confidence.record(
          (event.data.domain as string) ?? 'general',
          (event.data.confidence as number) ?? 0.8,
          event.componentId
        );
        break;

      case 'mission_failed':
        this.confidence.record(
          (event.data.domain as string) ?? 'general',
          (event.data.confidence as number) ?? 0.3,
          event.componentId
        );
        break;

      case 'pattern_detected':
        // Patterns are auto-detected or manually registered
        break;
    }
  }

  // ---- Convenience accessors ---------------------------------------------

  /**
   * Get tool capabilities
   */
  getToolCapabilities(): ToolCapability[] {
    return this.capabilities.getTools();
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(): ProviderCapability[] {
    return this.capabilities.getProviders();
  }

  /**
   * Get all limitations
   */
  getLimitations(): Limitation[] {
    return this.limitations.getLimitations();
  }

  /**
   * Get all domain confidence
   */
  getDomainConfidence(): DomainConfidence[] {
    return this.confidence.getDomains();
  }

  /**
   * Get all reliability records
   */
  getReliabilityRecords(): ReliabilityRecord[] {
    return this.reliability.getRecords();
  }

  /**
   * Get all failure patterns
   */
  getFailurePatterns(): FailurePattern[] {
    return this.patterns.getPatterns();
  }

  /**
   * Get overall system health (0-1)
   */
  getOverallHealth(): number {
    const toolRate = this.capabilities.getOverallToolSuccessRate();
    const reliability = this.reliability.getOverallReliability();
    const confidence = this.confidence.getOverallConfidence();
    const patternPenalty = this.patterns.getSystemicPatterns().length * 0.05;
    const limitationPenalty = this.limitations.getBySeverity('critical').length * 0.08;

    const raw = (toolRate + reliability + confidence) / 3;
    return Math.max(0, Math.min(1, raw - patternPenalty - limitationPenalty));
  }

  // ---- Snapshot ----------------------------------------------------------

  /**
   * Take a full snapshot of the self-model
   */
  snapshot(): SelfModelSnapshot {
    return {
      timestamp: now().toISOString(),
      toolCapabilities: this.capabilities.getTools(),
      providerCapabilities: this.capabilities.getProviders(),
      limitations: this.limitations.getLimitations(),
      domainConfidence: this.confidence.getDomains(),
      reliabilityRecords: this.reliability.getRecords(),
      failurePatterns: this.patterns.getPatterns(),
      overallHealth: this.getOverallHealth(),
      knownCapabilityCount: this.capabilities.getTools().length + this.capabilities.getProviders().length,
      knownLimitationCount: this.limitations.count(),
      knownPatternCount: this.patterns.count(),
    };
  }

  /**
   * Get event history
   */
  getEventHistory(): SelfModelUpdateEvent[] {
    return [...this.eventHistory];
  }

  // ---- Sub-module access -------------------------------------------------

  getCapabilityTracker(): CapabilityTracker {
    return this.capabilities;
  }

  getLimitationRegistry(): LimitationRegistry {
    return this.limitations;
  }

  getConfidenceScorer(): ConfidenceScorer {
    return this.confidence;
  }

  getReliabilityTracker(): ReliabilityTracker {
    return this.reliability;
  }

  getPatternDetector(): PatternDetector {
    return this.patterns;
  }

  /**
   * Reset everything
   */
  reset(): void {
    this.capabilities.reset();
    this.limitations.reset();
    this.confidence.reset();
    this.reliability.reset();
    this.patterns.reset();
    this.eventHistory = [];
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createSelfModel(params?: {
  capabilities?: CapabilityTracker;
  limitations?: LimitationRegistry;
  confidence?: ConfidenceScorer;
  reliability?: ReliabilityTracker;
  patterns?: PatternDetector;
}): SelfModel {
  return new SelfModel(params);
}
