import type { CodeValidation, CodeViolation } from './types.js';

const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; rule: string; description: string; severity: CodeViolation['severity'] }> = [
  { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/g, rule: 'NO_CHILD_PROCESS', description: 'child_process import blocked', severity: 'critical' },
  { pattern: /require\s*\(\s*['"]vm['"]\s*\)/g, rule: 'NO_VM', description: 'vm module import blocked', severity: 'critical' },
  { pattern: /eval\s*\(/g, rule: 'NO_EVAL', description: 'eval() blocked', severity: 'critical' },
  { pattern: /new\s+Function\s*\(/g, rule: 'NO_DYNAMIC_FUNCTION', description: 'new Function() blocked', severity: 'critical' },
  { pattern: /process\.exit/g, rule: 'NO_PROCESS_EXIT', description: 'process.exit() blocked', severity: 'error' },
  { pattern: /process\.env/g, rule: 'NO_PROCESS_ENV', description: 'process.env access blocked', severity: 'error' },
  { pattern: /__proto__/g, rule: 'NO_PROTO_POLLUTION', description: 'prototype pollution blocked', severity: 'critical' },
  { pattern: /while\s*\(\s*true\s*\)/g, rule: 'NO_INFINITE_LOOP', description: 'infinite loop detected', severity: 'warning' },
  { pattern: /for\s*\(\s*;\s*;\s*\)/g, rule: 'NO_INFINITE_LOOP', description: 'infinite loop detected', severity: 'warning' },
  { pattern: /fetch\s*\(/g, rule: 'NO_NETWORK', description: 'network fetch blocked', severity: 'error' },
  { pattern: /require\s*\(\s*['"]http['"]\s*\)/g, rule: 'NO_NETWORK', description: 'http module blocked', severity: 'error' },
  { pattern: /require\s*\(\s*['"]https['"]\s*\)/g, rule: 'NO_NETWORK', description: 'https module blocked', severity: 'error' },
  { pattern: /require\s*\(\s*['"]net['"]\s*\)/g, rule: 'NO_NETWORK', description: 'net module blocked', severity: 'error' },
  { pattern: /fs\.write/g, rule: 'NO_FS_WRITE', description: 'filesystem write blocked', severity: 'error' },
  { pattern: /fs\.unlink/g, rule: 'NO_FS_DELETE', description: 'filesystem delete blocked', severity: 'error' },
  { pattern: /fs\.rm/g, rule: 'NO_FS_DELETE', description: 'filesystem delete blocked', severity: 'error' },
];

export class CodeValidator {
  private extraPatterns: Array<{ pattern: RegExp; rule: string; description: string; severity: CodeViolation['severity'] }> = [];

  addRule(pattern: RegExp, rule: string, description: string, severity: CodeViolation['severity'] = 'error'): void {
    this.extraPatterns.push({ pattern, rule, description, severity });
  }

  validate(code: string, allowedModules: string[] = []): CodeValidation {
    const violations: CodeViolation[] = [];
    const lines = code.split('\n');
    const allPatterns = [...DANGEROUS_PATTERNS, ...this.extraPatterns];

    for (const { pattern, rule, description, severity } of allPatterns) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(line)) !== null) {
          if (rule === 'NO_NETWORK' && allowedModules.includes('network')) continue;
          if (rule.startsWith('NO_FS') && allowedModules.includes('fs_write')) continue;
          violations.push({ line: i + 1, column: match.index + 1, rule, description, severity });
        }
      }
    }

    const hasCritical = violations.some(v => v.severity === 'critical');
    const hasError = violations.some(v => v.severity === 'error');

    return {
      valid: violations.filter(v => v.severity === 'critical' || v.severity === 'error').length === 0,
      violations,
      riskLevel: hasCritical ? 4 : hasError ? 3 : violations.length > 0 ? 2 : 1,
    };
  }
}
