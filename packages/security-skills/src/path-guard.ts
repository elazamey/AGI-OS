import { generateId, now } from '@agi-os/kernel';
import type { SecurityScanResult, Threat } from './types.js';

const DANGEROUS_PATHS = [
  '/etc/passwd', '/etc/shadow', '/etc/sudoers',
  '/root/', '/home/', '/var/log/',
  '/proc/', '/sys/', '/dev/',
  '/boot/', '/usr/bin/', '/usr/sbin/',
];

const TRAVERSAL_PATTERNS = [
  /\.\.\//, /\.\.\\/, /\.\.%2f/i, /\.\.%5c/i,
];

export class PathGuard {
  checkPath(filePath: string): { safe: boolean; threats: Threat[] } {
    const threats: Threat[] = [];

    for (const pattern of TRAVERSAL_PATTERNS) {
      if (pattern.test(filePath)) {
        threats.push({
          id: generateId(),
          type: 'traversal',
          severity: 'HIGH',
          description: 'Path traversal detected',
          location: filePath,
          recommendation: 'Use sanitized paths within workspace',
        });
      }
    }

    for (const dangerous of DANGEROUS_PATHS) {
      if (filePath.startsWith(dangerous) || filePath.includes(dangerous)) {
        threats.push({
          id: generateId(),
          type: 'traversal',
          severity: 'HIGH',
          description: `Access to sensitive path: ${dangerous}`,
          location: filePath,
          recommendation: 'Access denied to system path',
        });
      }
    }

    return { safe: threats.length === 0, threats };
  }

  isWithinScope(filePath: string, allowedScopes: string[]): boolean {
    if (allowedScopes.length === 0) return true;
    return allowedScopes.some(scope => filePath.startsWith(scope));
  }

  scan(target: string): SecurityScanResult {
    const { safe, threats } = this.checkPath(target);
    return {
      id: generateId(),
      scanner: 'path-guard',
      target,
      threats,
      score: safe ? 100 : 0,
      passed: safe,
      timestamp: now().toISOString(),
    };
  }
}
