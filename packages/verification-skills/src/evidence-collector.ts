import { generateId, now } from '@agi-os/kernel';
import type { EvidenceItem } from './types.js';

export interface EvidenceBundle {
  id: string;
  missionId: string;
  taskId: string;
  items: EvidenceItem[];
  overallConfidence: number;
  timestamp: string;
}

export class EvidenceCollector {
  private bundles: Map<string, EvidenceBundle> = new Map();

  collect(missionId: string, taskId: string, items: EvidenceItem[]): EvidenceBundle {
    const bundle: EvidenceBundle = {
      id: generateId(),
      missionId,
      taskId,
      items,
      overallConfidence: this.calculateOverall(items),
      timestamp: now().toISOString(),
    };
    this.bundles.set(bundle.id, bundle);
    return bundle;
  }

  addEvidence(bundleId: string, item: EvidenceItem): void {
    const bundle = this.bundles.get(bundleId);
    if (bundle) {
      bundle.items.push(item);
      bundle.overallConfidence = this.calculateOverall(bundle.items);
    }
  }

  getBundle(bundleId: string): EvidenceBundle | undefined {
    return this.bundles.get(bundleId);
  }

  getBundlesForMission(missionId: string): EvidenceBundle[] {
    return Array.from(this.bundles.values()).filter((b) => b.missionId === missionId);
  }

  getConfidenceLevel(bundle: EvidenceBundle): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (bundle.overallConfidence >= 0.9) return 'HIGH';
    if (bundle.overallConfidence >= 0.7) return 'MEDIUM';
    return 'LOW';
  }

  private calculateOverall(items: EvidenceItem[]): number {
    if (items.length === 0) return 0;
    const verified = items.filter((i) => i.verified).length;
    return Math.round((verified / items.length) * 100) / 100;
  }

  clear(): void {
    this.bundles.clear();
  }
}
