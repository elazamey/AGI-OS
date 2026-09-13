import { now } from '@agi-os/kernel';
import type { DependencyAuditResult, Severity } from './types.js';

const KNOWN_VULNERABILITIES: Record<string, { severity: Severity; advisory: string; fixVersion?: string }> = {
  'next@14.2.0': { severity: 'critical', advisory: 'Multiple CVEs in Next.js < 14.2.3 including RCE', fixVersion: '14.2.3' },
  'next@14.2.1': { severity: 'high', advisory: 'CVE in Next.js 14.2.1', fixVersion: '14.2.3' },
  'next@14.2.2': { severity: 'medium', advisory: 'Minor issue in Next.js 14.2.2', fixVersion: '14.2.3' },
};

export class DependencyAuditor {
  private customVulns: Map<string, { severity: Severity; advisory: string; fixVersion?: string }> = new Map();

  constructor() {
    for (const [key, value] of Object.entries(KNOWN_VULNERABILITIES)) {
      this.customVulns.set(key, value);
    }
  }

  registerVulnerability(pkg: string, vuln: { severity: Severity; advisory: string; fixVersion?: string }): void {
    this.customVulns.set(pkg, vuln);
  }

  audit(deps: Record<string, string>): DependencyAuditResult[] {
    const results: DependencyAuditResult[] = [];
    for (const [pkg, version] of Object.entries(deps)) {
      const key = `${pkg}@${version}`;
      const vuln = this.customVulns.get(key);
      if (vuln) {
        results.push({
          package: pkg,
          currentVersion: version,
          severity: vuln.severity,
          advisory: vuln.advisory,
          fixAvailable: !!vuln.fixVersion,
          fixVersion: vuln.fixVersion,
        });
      }
    }
    return results;
  }

  getCriticalCount(results: DependencyAuditResult[]): number {
    return results.filter(r => r.severity === 'critical').length;
  }

  getHighCount(results: DependencyAuditResult[]): number {
    return results.filter(r => r.severity === 'high').length;
  }

  hasBlockingVulnerabilities(results: DependencyAuditResult[]): boolean {
    return this.getCriticalCount(results) > 0;
  }

  getFixableCount(results: DependencyAuditResult[]): number {
    return results.filter(r => r.fixAvailable).length;
  }
}
