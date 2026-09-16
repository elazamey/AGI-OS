// ============================================================================
// AGI OS - Failure Pattern Detector
// Detects recurring failure signatures
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type { FailurePattern, PatternSignature, PatternFrequency } from './types.js';

// ---------------------------------------------------------------------------
// PatternDetector — detects and tracks failure patterns
// ---------------------------------------------------------------------------
export class PatternDetector {
  private patterns: Map<string, FailurePattern> = new Map();
  private occurrenceLog: Array<{ patternId: string; timestamp: string }> = [];

  /**
   * Register a known failure pattern
   */
  register(params: {
    name: string;
    description: string;
    signatures: PatternSignature[];
    frequency: PatternFrequency;
    impact: FailurePattern['impact'];
    affectedComponents?: string[];
    suggestedMitigation?: string;
    autoDetected?: boolean;
  }): FailurePattern {
    const ts = now().toISOString();
    const pattern: FailurePattern = {
      id: generateId(),
      name: params.name,
      description: params.description,
      signatures: params.signatures,
      frequency: params.frequency,
      impact: params.impact,
      detectedAt: ts,
      lastSeenAt: ts,
      occurrenceCount: 0,
      affectedComponents: params.affectedComponents ?? [],
      suggestedMitigation: params.suggestedMitigation ?? '',
      autoDetected: params.autoDetected ?? false,
      evidenceRefs: [],
    };
    this.patterns.set(pattern.id, pattern);
    return pattern;
  }

  /**
   * Check if an error event matches any registered pattern
   */
  match(error: { errorType: string; errorMessage: string; componentId?: string }): FailurePattern | null {
    for (const pattern of this.patterns.values()) {
      if (this.matchesSignatures(pattern, error)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Report an occurrence of a pattern
   */
  reportOccurrence(patternId: string): void {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    const ts = now().toISOString();
    pattern.occurrenceCount++;
    pattern.lastSeenAt = ts;
    this.occurrenceLog.push({ patternId, timestamp: ts });

    // Auto-update frequency based on occurrence count
    if (pattern.occurrenceCount >= 20) pattern.frequency = 'systemic';
    else if (pattern.occurrenceCount >= 10) pattern.frequency = 'frequent';
    else if (pattern.occurrenceCount >= 3) pattern.frequency = 'occasional';
    else pattern.frequency = 'rare';
  }

  /**
   * Auto-detect patterns from a list of errors
   */
  detectFromErrors(errors: Array<{ errorType: string; errorMessage: string; componentId: string; timestamp: string }>): FailurePattern[] {
    const detected: FailurePattern[] = [];
    const byType = new Map<string, typeof errors>();

    for (const err of errors) {
      const key = err.errorType;
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key)!.push(err);
    }

    for (const [errorType, group] of byType) {
      if (group.length < 2) continue; // Need at least 2 occurrences

      // Check if pattern already exists
      const existing = [...this.patterns.values()].find(
        (p) => p.signatures.some((s) => s.field === 'errorType' && s.value === errorType)
      );

      if (existing) {
        this.reportOccurrence(existing.id);
        detected.push(existing);
      } else {
        // Auto-detect new pattern
        const pattern = this.register({
          name: `Auto: ${errorType}`,
          description: `Automatically detected pattern for error type: ${errorType}`,
          signatures: [{ field: 'errorType', operator: 'equals', value: errorType }],
          frequency: group.length >= 10 ? 'frequent' : group.length >= 3 ? 'occasional' : 'rare',
          impact: group.length >= 10 ? 'high' : group.length >= 5 ? 'medium' : 'low',
          affectedComponents: [...new Set(group.map((e) => e.componentId))],
          autoDetected: true,
        });
        pattern.occurrenceCount = group.length;
        detected.push(pattern);
      }
    }

    return detected;
  }

  /**
   * Get all patterns
   */
  getPatterns(): FailurePattern[] {
    return [...this.patterns.values()];
  }

  /**
   * Get pattern by ID
   */
  getPattern(id: string): FailurePattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get patterns by frequency
   */
  getByFrequency(frequency: PatternFrequency): FailurePattern[] {
    return this.getPatterns().filter((p) => p.frequency === frequency);
  }

  /**
   * Get patterns by impact
   */
  getByImpact(impact: FailurePattern['impact']): FailurePattern[] {
    return this.getPatterns().filter((p) => p.impact === impact);
  }

  /**
   * Get systemic patterns
   */
  getSystemicPatterns(): FailurePattern[] {
    return this.getByFrequency('systemic');
  }

  /**
   * Get most frequent patterns
   */
  getMostFrequent(n: number): FailurePattern[] {
    return this.getPatterns()
      .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
      .slice(0, n);
  }

  /**
   * Get occurrence log
   */
  getOccurrenceLog(): Array<{ patternId: string; timestamp: string }> {
    return [...this.occurrenceLog];
  }

  /**
   * Total pattern count
   */
  count(): number {
    return this.patterns.size;
  }

  /**
   * Remove a pattern
   */
  remove(patternId: string): boolean {
    return this.patterns.delete(patternId);
  }

  /**
   * Reset all
   */
  reset(): void {
    this.patterns.clear();
    this.occurrenceLog = [];
  }

  // ---- Private -----------------------------------------------------------

  private matchesSignatures(
    pattern: FailurePattern,
    error: { errorType: string; errorMessage: string; componentId?: string }
  ): boolean {
    return pattern.signatures.every((sig) => {
      let fieldValue: string | number | undefined;

      switch (sig.field) {
        case 'errorType':
          fieldValue = error.errorType;
          break;
        case 'errorMessage':
          fieldValue = error.errorMessage;
          break;
        case 'componentId':
          fieldValue = error.componentId;
          break;
        default:
          return false;
      }

      if (fieldValue === undefined) return false;

      switch (sig.operator) {
        case 'equals':
          return fieldValue === sig.value;
        case 'contains':
          return String(fieldValue).includes(String(sig.value));
        case 'matches':
          return new RegExp(String(sig.value)).test(String(fieldValue));
        case 'gt':
          return Number(fieldValue) > Number(sig.value);
        case 'lt':
          return Number(fieldValue) < Number(sig.value);
        default:
          return false;
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createPatternDetector(): PatternDetector {
  return new PatternDetector();
}
