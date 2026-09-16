// ============================================================================
// AGI OS - Limitations Registry
// Tracks what the system cannot do
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type { Limitation, LimitationSeverity } from './types.js';

// ---------------------------------------------------------------------------
// LimitationRegistry — discovers, records, and queries system limitations
// ---------------------------------------------------------------------------
export class LimitationRegistry {
  private limitations: Map<string, Limitation> = new Map();

  /**
   * Record a new limitation
   */
  discover(params: {
    category: Limitation['category'];
    description: string;
    severity: LimitationSeverity;
    workaround?: string;
    evidenceRefs?: string[];
    autoDetected?: boolean;
  }): Limitation {
    const ts = now().toISOString();
    const limitation: Limitation = {
      id: generateId(),
      category: params.category,
      description: params.description,
      severity: params.severity,
      discoveredAt: ts,
      lastHitAt: ts,
      hitCount: 1,
      workaround: params.workaround ?? null,
      autoDetected: params.autoDetected ?? false,
      evidenceRefs: params.evidenceRefs ?? [],
    };
    this.limitations.set(limitation.id, limitation);
    return limitation;
  }

  /**
   * Report that an existing limitation was hit again
   */
  hit(limitationId: string): void {
    const lim = this.limitations.get(limitationId);
    if (lim) {
      lim.lastHitAt = now().toISOString();
      lim.hitCount++;
    }
  }

  /**
   * Find a limitation by description similarity
   */
  findByDescription(description: string): Limitation | undefined {
    const lower = description.toLowerCase();
    return this.getLimitations().find(
      (l) => l.description.toLowerCase().includes(lower) || lower.includes(l.description.toLowerCase())
    );
  }

  /**
   * Record or increment — if a similar limitation exists, increment its hit count
   */
  recordIfNew(params: {
    category: Limitation['category'];
    description: string;
    severity: LimitationSeverity;
    workaround?: string;
    evidenceRefs?: string[];
  }): { limitation: Limitation; isNew: boolean } {
    const existing = this.findByDescription(params.description);
    if (existing) {
      this.hit(existing.id);
      return { limitation: existing, isNew: false };
    }
    const lim = this.discover({ ...params, autoDetected: true });
    return { limitation: lim, isNew: true };
  }

  /**
   * Add a workaround to an existing limitation
   */
  addWorkaround(limitationId: string, workaround: string): void {
    const lim = this.limitations.get(limitationId);
    if (lim) {
      lim.workaround = workaround;
    }
  }

  /**
   * Get all limitations
   */
  getLimitations(): Limitation[] {
    return [...this.limitations.values()];
  }

  /**
   * Get by ID
   */
  getLimitation(id: string): Limitation | undefined {
    return this.limitations.get(id);
  }

  /**
   * Get by category
   */
  getByCategory(category: Limitation['category']): Limitation[] {
    return this.getLimitations().filter((l) => l.category === category);
  }

  /**
   * Get by severity
   */
  getBySeverity(severity: LimitationSeverity): Limitation[] {
    return this.getLimitations().filter((l) => l.severity === severity);
  }

  /**
   * Get most hit limitations
   */
  getMostHit(n: number): Limitation[] {
    return this.getLimitations()
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, n);
  }

  /**
   * Get limitations discovered in a time range
   */
  getDiscoveredBetween(from: Date, to: Date): Limitation[] {
    return this.getLimitations().filter((l) => {
      const d = new Date(l.discoveredAt);
      return d >= from && d <= to;
    });
  }

  /**
   * Total limitation count
   */
  count(): number {
    return this.limitations.size;
  }

  /**
   * Remove a limitation
   */
  remove(limitationId: string): boolean {
    return this.limitations.delete(limitationId);
  }

  /**
   * Clear all
   */
  reset(): void {
    this.limitations.clear();
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createLimitationRegistry(): LimitationRegistry {
  return new LimitationRegistry();
}
