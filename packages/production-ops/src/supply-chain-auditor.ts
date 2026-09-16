import type { SupplyChainResult } from './types.js';

export interface DependencyInfo {
  name: string;
  version: string;
  knownVulns: string[];
}

const LICENSE_ISSUES = ['GPL-3.0', 'AGPL-3.0', 'SSPL-1.0'];

export class SupplyChainAuditor {
  private dependencies: DependencyInfo[] = [];

  addDependency(name: string, version: string, knownVulns: string[] = []): void {
    this.dependencies.push({ name, version, knownVulns });
  }

  audit(): SupplyChainResult[] {
    return this.dependencies.map(dep => {
      const vulnerability = dep.knownVulns.length > 0 ? dep.knownVulns[0] : null;
      const licenseIssue = LICENSE_ISSUES.some(l => dep.version.toLowerCase().includes(l.toLowerCase()));
      return {
        dependency: dep.name,
        version: dep.version,
        vulnerability,
        licenseIssue,
        safe: vulnerability === null && !licenseIssue,
      };
    });
  }

  getVulnerabilityCount(): number {
    return this.dependencies.reduce((count, dep) => count + dep.knownVulns.length, 0);
  }

  isSafe(): boolean {
    return this.audit().every(r => r.safe);
  }
}
