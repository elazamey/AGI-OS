export interface SecurityCheckResult {
  passed: boolean;
  threatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: string;
  matchedPattern?: string;
}

export interface AuditReport {
  timestamp: number;
  checks: SecurityCheckResult[];
  overallPassed: boolean;
  overallThreatLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class SecurityAuditor {
  private static dangerousPatterns: Array<{ pattern: RegExp; description: string }> = [
    { pattern: /rm\s+-rf\s+\//i, description: 'Recursive file deletion from root' },
    { pattern: /rm\s+-rf\s+~/i, description: 'Recursive file deletion from home' },
    { pattern: /eval\s*\(/i, description: 'Dynamic code evaluation' },
    { pattern: /process\.exit/i, description: 'Process termination attempt' },
    { pattern: /child_process/i, description: 'Child process access attempt' },
    { pattern: /__dirname/i, description: 'Directory traversal attempt' },
    { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/i, description: 'Child process require' },
    { pattern: /exec\s*\(/i, description: 'Command execution attempt' },
    { pattern: /execSync\s*\(/i, description: 'Synchronous command execution' },
    { pattern: /spawn\s*\(/i, description: 'Process spawn attempt' },
    { pattern: /system\s*\(/i, description: 'System call attempt' },
    { pattern: /\.\.\/\.\.\//i, description: 'Path traversal attempt' },
    { pattern: /\$\{.*\}/i, description: 'Template injection attempt' },
    { pattern: /<script/i, description: 'Script injection attempt' },
    { pattern: /javascript:/i, description: 'JavaScript protocol injection' },
    { pattern: /data:text\/html/i, description: 'Data URI HTML injection' },
    { pattern: /UNION\s+SELECT/i, description: 'SQL injection attempt' },
    { pattern: /;\s*DROP\s+TABLE/i, description: 'SQL DROP attempt' },
    { pattern: /--\s*$/i, description: 'SQL comment injection' },
  ];

  static inspectPayload(payload: string): SecurityCheckResult {
    for (const { pattern, description } of this.dangerousPatterns) {
      if (pattern.test(payload)) {
        return {
          passed: false,
          threatLevel: 'CRITICAL',
          details: `Blocked: ${description} matching pattern: ${pattern.toString()}`,
          matchedPattern: pattern.toString(),
        };
      }
    }

    return {
      passed: true,
      threatLevel: 'LOW',
      details: 'Payload passed security inspection.',
    };
  }

  static auditEnvironment(env: Record<string, string | undefined>): SecurityCheckResult {
    const issues: string[] = [];
    let maxThreat: SecurityCheckResult['threatLevel'] = 'LOW';

    if (env['MAX_SPEND'] && parseFloat(env['MAX_SPEND']) > 0) {
      if (env['STRICT_MODE'] === 'true') {
        issues.push('MAX_SPEND > 0 while STRICT_MODE enabled');
        maxThreat = 'MEDIUM';
      }
    }

    if (env['ALLOW_ROOT'] === 'true') {
      issues.push('Root execution allowed');
      maxThreat = 'HIGH';
    }

    if (env['DISABLE_AUTH'] === 'true') {
      issues.push('Authentication disabled');
      maxThreat = 'CRITICAL';
    }

    if (issues.length > 0) {
      return {
        passed: false,
        threatLevel: maxThreat,
        details: `Environment issues: ${issues.join('; ')}`,
      };
    }

    return {
      passed: true,
      threatLevel: 'LOW',
      details: 'Environment configuration compliant.',
    };
  }

  static runFullAudit(payloads: string[], env: Record<string, string | undefined>): AuditReport {
    const checks: SecurityCheckResult[] = [];

    for (const payload of payloads) {
      checks.push(this.inspectPayload(payload));
    }

    checks.push(this.auditEnvironment(env));

    const overallPassed = checks.every(c => c.passed);
    const threatLevels: SecurityCheckResult['threatLevel'][] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const maxThreat = threatLevels.reduce((max, level) => {
      return checks.some(c => c.threatLevel === level) ? level : max;
    }, 'LOW' as SecurityCheckResult['threatLevel']);

    return {
      timestamp: Date.now(),
      checks,
      overallPassed,
      overallThreatLevel: maxThreat,
    };
  }
}
