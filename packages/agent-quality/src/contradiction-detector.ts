import type { ContradictionResult, ContradictionSource } from './types.js';

export class ContradictionDetector {
  private sourcePriority: Record<string, number> = {
    'tool': 4,
    'user': 3,
    'memory': 2,
    'inference': 1,
    'web': 0,
  };

  detect(sources: ContradictionSource[]): ContradictionResult {
    if (sources.length < 2) {
      return {
        sources,
        detected: false,
        resolved: false,
        resolutionMethod: 'none',
        selectedSource: null,
        confidence: 1,
      };
    }

    const claims = [...new Set(sources.map(s => s.claim))];
    const detected = claims.length > 1;

    if (!detected) {
      return {
        sources,
        detected: false,
        resolved: true,
        resolutionMethod: 'none',
        selectedSource: sources[0]?.id ?? null,
        confidence: 1,
      };
    }

    const sorted = [...sources].sort((a, b) => {
      const priorityA = this.sourcePriority[a.sourceType] ?? 0;
      const priorityB = this.sourcePriority[b.sourceType] ?? 0;
      if (priorityA !== priorityB) return priorityB - priorityA;
      return b.confidence - a.confidence;
    });

    const selected = sorted[0];

    return {
      sources,
      detected: true,
      resolved: true,
      resolutionMethod: 'source_priority',
      selectedSource: selected.id,
      confidence: selected.confidence,
    };
  }

  rankEvidence(sources: ContradictionSource[]): ContradictionSource[] {
    return [...sources].sort((a, b) => {
      const priorityA = this.sourcePriority[a.sourceType] ?? 0;
      const priorityB = this.sourcePriority[b.sourceType] ?? 0;
      if (priorityA !== priorityB) return priorityB - priorityA;
      return b.confidence - a.confidence;
    });
  }

  detectCircularReferences(sources: ContradictionSource[]): { circular: boolean; cycle: string[] } {
    const claimMap = new Map<string, string[]>();
    for (const s of sources) {
      if (!claimMap.has(s.claim)) claimMap.set(s.claim, []);
      claimMap.get(s.claim)!.push(s.id);
    }

    for (const [, ids] of claimMap) {
      if (ids.length >= 3) {
        return { circular: true, cycle: ids };
      }
    }

    return { circular: false, cycle: [] };
  }
}
