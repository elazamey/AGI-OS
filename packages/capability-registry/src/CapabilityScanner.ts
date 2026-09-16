// ═══════════════════════════════════════════════════════
// CapabilityScanner — Auto-detect repos & register
// ═══════════════════════════════════════════════════════

import type { CapabilityRegistry } from './CapabilityRegistry';
import type { RepositoryCapability, CapabilityCategory, RiskLevel } from './types';

export interface RepoProfile {
  name: string;
  category: CapabilityCategory;
  skills: string[];
  riskLevel: RiskLevel;
  endpoint?: string;
  type: RepositoryCapability['type'];
}

export class CapabilityScanner {
  private registry: CapabilityRegistry;
  private scannedRepos: RepoProfile[] = [];

  constructor(registry: CapabilityRegistry) {
    this.registry = registry;
  }

  scanAndRegister(repos: RepoProfile[]): RepositoryCapability[] {
    const registered: RepositoryCapability[] = [];

    for (const repo of repos) {
      const inferredRisk = this.inferRiskLevel(repo.category);
      const riskLevel: RiskLevel = repo.riskLevel === 'LOW' ? inferredRisk : repo.riskLevel;
      const cap: RepositoryCapability = {
        id: `${repo.name}-auto`,
        repoName: repo.name,
        type: repo.type,
        category: repo.category,
        endpoint: repo.endpoint,
        providedSkills: repo.skills,
        healthCheckUrl: repo.endpoint,
        policyRequirements: {
          requiresApproval: this.riskRequiresApproval(riskLevel),
          riskLevel,
        },
        status: 'UNKNOWN',
      };

      this.registry.registerCapability(cap);
      this.scannedRepos.push(repo);
      registered.push(cap);
    }

    return registered;
  }

  scanFromManifest(manifests: Array<{ id: string; repoName: string; category: CapabilityCategory; skills: string[]; endpoint?: string }>): RepositoryCapability[] {
    const profiles: RepoProfile[] = manifests.map(m => ({
      name: m.repoName,
      category: m.category,
      skills: m.skills,
      riskLevel: this.inferRiskLevel(m.category),
      endpoint: m.endpoint,
      type: m.endpoint ? 'mcp_service' : 'package',
    }));

    return this.scanAndRegister(profiles);
  }

  getScannedRepos(): RepoProfile[] { return [...this.scannedRepos]; }

  private riskRequiresApproval(risk: RiskLevel): boolean {
    return risk !== 'LOW';
  }

  private inferRiskLevel(category: CapabilityCategory): RiskLevel {
    switch (category) {
      case 'governance': return 'HIGH';
      case 'devops': return 'MEDIUM';
      case 'cognition': return 'LOW';
      case 'memory': return 'LOW';
      case 'connector': return 'MEDIUM';
      default: return 'LOW';
    }
  }
}
