// ============================================================================
// AGI OS - Confidence Scorer
// Domain-level confidence tracking with trend analysis
// ============================================================================

import { now } from '@agi-os/kernel';
import type { DomainConfidence, ConfidenceSample } from './types.js';

// ---------------------------------------------------------------------------
// ConfidenceScorer — tracks and queries domain confidence
// ---------------------------------------------------------------------------
export class ConfidenceScorer {
  private domains: Map<string, DomainConfidence> = new Map();

  /**
   * Record a confidence observation for a domain
   */
  record(domain: string, score: number, missionId: string): DomainConfidence {
    let dc = this.domains.get(domain);
    const ts = now().toISOString();

    if (!dc) {
      dc = {
        domain,
        score: 0,
        sampleSize: 0,
        lastUpdated: ts,
        trend: 'stable',
        history: [],
      };
      this.domains.set(domain, dc);
    }

    const sample: ConfidenceSample = { score, timestamp: ts, missionId };
    dc.history.push(sample);
    dc.sampleSize++;
    dc.lastUpdated = ts;

    // Exponential moving average (alpha=0.3)
    dc.score = dc.sampleSize === 1
      ? score
      : dc.score * 0.7 + score * 0.3;

    // Compute trend from last 5 samples
    dc.trend = this.computeTrend(dc.history);

    return dc;
  }

  /**
   * Get confidence for a domain
   */
  getConfidence(domain: string): DomainConfidence | undefined {
    return this.domains.get(domain);
  }

  /**
   * Get score for a domain (0 if unknown)
   */
  getScore(domain: string): number {
    return this.domains.get(domain)?.score ?? 0;
  }

  /**
   * Get all domains
   */
  getDomains(): DomainConfidence[] {
    return [...this.domains.values()];
  }

  /**
   * Get domains sorted by confidence (descending)
   */
  getRankedDomains(): DomainConfidence[] {
    return this.getDomains().sort((a, b) => b.score - a.score);
  }

  /**
   * Get weakest domains
   */
  getWeakest(n: number): DomainConfidence[] {
    return this.getDomains()
      .sort((a, b) => a.score - b.score)
      .slice(0, n);
  }

  /**
   * Get strongest domains
   */
  getStrongest(n: number): DomainConfidence[] {
    return this.getRankedDomains().slice(0, n);
  }

  /**
   * Get declining domains
   */
  getDeclining(): DomainConfidence[] {
    return this.getDomains().filter((d) => d.trend === 'declining');
  }

  /**
   * Get improving domains
   */
  getImproving(): DomainConfidence[] {
    return this.getDomains().filter((d) => d.trend === 'improving');
  }

  /**
   * Overall system confidence (average of all domains)
   */
  getOverallConfidence(): number {
    const domains = this.getDomains();
    if (domains.length === 0) return 0;
    return domains.reduce((sum, d) => sum + d.score, 0) / domains.length;
  }

  /**
   * Get history for a domain
   */
  getHistory(domain: string): ConfidenceSample[] {
    return this.domains.get(domain)?.history ?? [];
  }

  /**
   * Check if domain meets minimum confidence threshold
   */
  meetsThreshold(domain: string, threshold: number): boolean {
    return this.getScore(domain) >= threshold;
  }

  /**
   * Reset all confidence data
   */
  reset(): void {
    this.domains.clear();
  }

  // ---- Private -----------------------------------------------------------

  private computeTrend(history: ConfidenceSample[]): DomainConfidence['trend'] {
    if (history.length < 3) return 'stable';

    const recent = history.slice(-5);
    const firstHalf = recent.slice(0, Math.ceil(recent.length / 2));
    const secondHalf = recent.slice(Math.ceil(recent.length / 2));

    const avgFirst = firstHalf.reduce((s, h) => s + h.score, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, h) => s + h.score, 0) / secondHalf.length;

    const delta = avgSecond - avgFirst;

    if (delta > 0.05) return 'improving';
    if (delta < -0.05) return 'declining';
    return 'stable';
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createConfidenceScorer(): ConfidenceScorer {
  return new ConfidenceScorer();
}
