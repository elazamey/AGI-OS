import { generateId, now } from '@agi-os/kernel';
import type { CommandRiskResult } from './types.js';

const DANGEROUS_COMMANDS = [
  { pattern: /rm\s+-rf/i, risk: 'CRITICAL' as const, reason: 'Recursive force delete' },
  { pattern: /mkfs/i, risk: 'CRITICAL' as const, reason: 'Format filesystem' },
  { pattern: /dd\s+if=/i, risk: 'CRITICAL' as const, reason: 'Raw disk write' },
  { pattern: /:(){ /, risk: 'CRITICAL' as const, reason: 'Fork bomb' },
  { pattern: /chmod\s+777/i, risk: 'HIGH' as const, reason: 'World-writable permissions' },
  { pattern: /chown\s+root/i, risk: 'HIGH' as const, reason: 'Root ownership change' },
  { pattern: /eval\s*\(/i, risk: 'HIGH' as const, reason: 'Dynamic code evaluation' },
  { pattern: /curl.*\|\s*sh/i, risk: 'CRITICAL' as const, reason: 'Pipe to shell' },
  { pattern: /wget.*\|\s*sh/i, risk: 'CRITICAL' as const, reason: 'Pipe to shell' },
  { pattern: /sudo/i, risk: 'HIGH' as const, reason: 'Privilege escalation' },
  { pattern: /su\s+-/i, risk: 'HIGH' as const, reason: 'User switch' },
  { pattern: /crontab/i, risk: 'MEDIUM' as const, reason: 'Cron modification' },
  { pattern: /docker\s+run\s+--privileged/i, risk: 'CRITICAL' as const, reason: 'Privileged container' },
  { pattern: /npm\s+install/i, risk: 'MEDIUM' as const, reason: 'Package installation' },
  { pattern: /git\s+push.*--force/i, risk: 'HIGH' as const, reason: 'Force push' },
];

export class CommandRiskAnalyzer {
  analyze(command: string): CommandRiskResult {
    const reasons: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    for (const { pattern, risk, reason } of DANGEROUS_COMMANDS) {
      if (pattern.test(command)) {
        reasons.push(reason);
        if (this.riskPriority(risk) > this.riskPriority(riskLevel)) {
          riskLevel = risk;
        }
      }
    }

    return {
      command,
      riskLevel,
      reasons,
      allowed: riskLevel !== 'CRITICAL',
    };
  }

  private riskPriority(risk: string): number {
    return { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }[risk] ?? 0;
  }

  analyzeBatch(commands: string[]): CommandRiskResult[] {
    return commands.map(c => this.analyze(c));
  }
}
