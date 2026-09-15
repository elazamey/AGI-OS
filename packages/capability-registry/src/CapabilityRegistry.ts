// ═══════════════════════════════════════════════════════
// CapabilityRegistry — Core Registration & Discovery
// ═══════════════════════════════════════════════════════

import type { RepositoryCapability, CapabilityCategory, CapabilityStatus } from './types';

export class CapabilityRegistry {
  private capabilities: Map<string, RepositoryCapability> = new Map();
  private skillIndex: Map<string, string> = new Map();
  private categoryIndex: Map<CapabilityCategory, Set<string>> = new Map();

  registerCapability(cap: RepositoryCapability): void {
    const registered = { ...cap, registeredAt: Date.now() };
    this.capabilities.set(cap.id, registered);

    for (const skill of cap.providedSkills) {
      this.skillIndex.set(skill, cap.id);
    }

    if (!this.categoryIndex.has(cap.category)) {
      this.categoryIndex.set(cap.category, new Set());
    }
    this.categoryIndex.get(cap.category)!.add(cap.id);
  }

  unregisterCapability(id: string): boolean {
    const cap = this.capabilities.get(id);
    if (!cap) return false;

    for (const skill of cap.providedSkills) {
      this.skillIndex.delete(skill);
    }
    this.categoryIndex.get(cap.category)?.delete(id);
    this.capabilities.delete(id);
    return true;
  }

  getCapability(id: string): RepositoryCapability | undefined {
    return this.capabilities.get(id);
  }

  getAllCapabilities(): RepositoryCapability[] {
    return Array.from(this.capabilities.values());
  }

  getCapabilitiesByCategory(category: CapabilityCategory): RepositoryCapability[] {
    const ids = this.categoryIndex.get(category) || new Set();
    return Array.from(ids).map(id => this.capabilities.get(id)!).filter(Boolean);
  }

  getCapabilitiesByType(type: string): RepositoryCapability[] {
    return this.getAllCapabilities().filter(c => c.type === type);
  }

  getHealthyCapabilities(): RepositoryCapability[] {
    return this.getAllCapabilities().filter(c => c.status === 'HEALTHY');
  }

  findProviderForSkill(skill: string): RepositoryCapability | undefined {
    const capId = this.skillIndex.get(skill);
    return capId ? this.capabilities.get(capId) : undefined;
  }

  findProvidersForSkills(skills: string[]): RepositoryCapability[] {
    const seen = new Set<string>();
    const results: RepositoryCapability[] = [];
    for (const skill of skills) {
      const capId = this.skillIndex.get(skill);
      if (capId && !seen.has(capId)) {
        seen.add(capId);
        const cap = this.capabilities.get(capId);
        if (cap) results.push(cap);
      }
    }
    return results;
  }

  updateStatus(id: string, status: CapabilityStatus): void {
    const cap = this.capabilities.get(id);
    if (cap) cap.status = status;
  }

  getCapabilityCount(): number { return this.capabilities.size; }
  getSkillCount(): number { return this.skillIndex.size; }

  getCategoryBreakdown(): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const [cat, ids] of this.categoryIndex) {
      breakdown[cat] = ids.size;
    }
    return breakdown;
  }
}
