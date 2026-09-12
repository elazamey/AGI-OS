// ============================================================================
// AGI OS - Risk Evaluator
// Calculates blast radius of proposed actions based on module + operation
// ============================================================================

import type { ActionIntent, RiskAssessment, RiskFactor } from './types.js';
import { RiskLevel } from './types.js';

// ---------------------------------------------------------------------------
// RiskEvaluator — scores every action intent
// ---------------------------------------------------------------------------
export class RiskEvaluator {
  /**
   * Evaluate the risk of an action intent
   */
  evaluate(intent: ActionIntent): RiskAssessment {
    const factors: RiskFactor[] = [];
    let score = 0;

    // 1. Destructive operations → CRITICAL
    if (intent.operation === 'delete' || intent.operation === 'drop' || intent.operation === 'destroy') {
      factors.push({ name: 'destructive_operation', contribution: 60, description: `Destructive operation: ${intent.operation}` });
      score += 60;
    }

    // 2. Write operations → HIGH
    if (intent.operation === 'write' || intent.operation === 'update' || intent.operation === 'modify') {
      factors.push({ name: 'write_operation', contribution: 35, description: `Write operation: ${intent.operation}` });
      score += 35;
    }

    // 3. Execute operations → HIGH
    if (intent.operation === 'execute' || intent.operation === 'run' || intent.operation === 'spawn') {
      factors.push({ name: 'execute_operation', contribution: 40, description: `Execution operation: ${intent.operation}` });
      score += 40;
    }

    // 4. Module risk multipliers
    const moduleMultiplier = this.getModuleMultiplier(intent.module);
    if (moduleMultiplier > 1) {
      factors.push({
        name: 'module_risk',
        contribution: Math.round(score * (moduleMultiplier - 1)),
        description: `Module "${intent.module}" has elevated risk (x${moduleMultiplier})`,
      });
      score = Math.round(score * moduleMultiplier);
    }

    // 5. Target-based risk
    const targetRisk = this.evaluateTarget(intent);
    if (targetRisk.contribution > 0) {
      factors.push(targetRisk);
      score += targetRisk.contribution;
    }

    // 6. Network operations → MEDIUM base
    if (intent.module === 'network' || intent.module === 'http') {
      factors.push({ name: 'network_operation', contribution: 15, description: 'Network call — external dependency' });
      score += 15;
    }

    // 7. Git operations — push is MEDIUM, force-push/reset is CRITICAL
    if (intent.module === 'git') {
      if (['force-push', 'reset-hard'].includes(intent.operation)) {
        factors.push({ name: 'git_destructive', contribution: 50, description: `Git destructive: ${intent.operation}` });
        score += 50;
      } else if (['push', 'reset', 'rebase'].includes(intent.operation)) {
        factors.push({ name: 'git_mutation', contribution: 25, description: `Git mutation: ${intent.operation}` });
        score += 25;
      }
    }

    // Cap score at 100
    score = Math.min(100, score);

    // Determine risk level from score
    const riskLevel = this.scoreToLevel(score);

    // Build reason
    const reason = factors.length > 0
      ? factors.map((f) => f.description).join('; ')
      : 'No elevated risk factors detected';

    return {
      intent,
      riskLevel,
      riskScore: score,
      factors,
      reason,
    };
  }

  // ---- Private -----------------------------------------------------------

  private getModuleMultiplier(module: string): number {
    const multipliers: Record<string, number> = {
      fs: 1.2,
      db: 1.3,
      exec: 1.5,
      process: 1.4,
      network: 1.1,
      http: 1.1,
      git: 1.2,
      env: 1.3,
      config: 1.2,
    };
    return multipliers[module] ?? 1.0;
  }

  private evaluateTarget(intent: ActionIntent): RiskFactor {
    const target = intent.target.toLowerCase();

    // Sensitive system files
    const sensitivePatterns = [
      '/etc/passwd', '/etc/shadow', '/etc/sudoers',
      '.env', '.env.local', '.env.production',
      'id_rsa', 'id_ed25519', '.ssh/',
      '/boot/', '/sys/', '/proc/',
    ];

    for (const pattern of sensitivePatterns) {
      if (target.includes(pattern)) {
        return {
          name: 'sensitive_target',
          contribution: 30,
          description: `Target matches sensitive pattern: ${pattern}`,
        };
      }
    }

    // Root-level operations
    if (target.startsWith('/') && intent.module === 'fs') {
      return {
        name: 'root_target',
        contribution: 10,
        description: 'Target is at filesystem root',
      };
    }

    return { name: 'target_check', contribution: 0, description: 'No target risk detected' };
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score >= 70) return RiskLevel.CRITICAL;
    if (score >= 40) return RiskLevel.HIGH;
    if (score >= 15) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createRiskEvaluator(): RiskEvaluator {
  return new RiskEvaluator();
}
