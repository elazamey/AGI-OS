// ============================================================================
// AGI OS - Risk Evaluator
// Calculates blast radius of proposed actions based on module + operation
// ============================================================================

import { isAbsolute, resolve } from 'node:path';
import type { ActionIntent, RiskAssessment, RiskFactor } from './types.js';
import { RiskLevel } from './types.js';
import { normalizeModule, normalizeOperation } from './vocabulary.js';

/** Scratch space POL-006 already treats as outside the protected filesystem. */
const SCRATCH_ROOTS = ['/tmp/', '/var/tmp/', '/private/tmp/'];

// ---------------------------------------------------------------------------
// RiskEvaluator — scores every action intent
// ---------------------------------------------------------------------------
export class RiskEvaluator {
  /** Roots whose contents the agent owns. Defaults to the process working dir. */
  private readonly workspaceRoots: string[];

  constructor(options?: { workspaceRoots?: string[] }) {
    this.workspaceRoots = (options?.workspaceRoots ?? [process.cwd()]).map((r) => resolve(r));
  }

  /**
   * Evaluate the risk of an action intent
   */
  evaluate(rawIntent: ActionIntent): RiskAssessment {
    // Score the canonicalised intent so that 'filesystem'/'terminal' callers are
    // risk-rated exactly like 'fs'/'exec' callers.
    const intent: ActionIntent = {
      ...rawIntent,
      module: normalizeModule(rawIntent.module),
      operation: normalizeOperation(rawIntent.operation),
    };

    const factors: RiskFactor[] = [];
    let score = 0;

    // 1. Destructive operations → CRITICAL
    if (intent.operation === 'delete' || intent.operation === 'drop' || intent.operation === 'destroy') {
      factors.push({ name: 'destructive_operation', contribution: 60, description: `Destructive operation: ${intent.operation}` });
      score += 60;
    }

    // 2. Write operations.
    //
    // This used to be a flat +35, which the fs multiplier (x1.2) pushed to 42 —
    // HIGH — for *every* filesystem write, including one inside the mission's
    // own workspace. The risk override then escalated POL-009's explicit ALLOW
    // to REQUIRE_APPROVAL and the agent could not write a file without a human.
    //
    // Blast radius depends on WHERE the write lands, not merely on the fact
    // that it is a write: a small base for changing state, plus a large
    // escalation when the target is outside the workspace.
    if (['write', 'update', 'modify', 'append', 'create'].includes(intent.operation)) {
      factors.push({ name: 'write_operation', contribution: 12, description: `Write operation: ${intent.operation}` });
      score += 12;

      const outside = this.outsideWorkspaceFactor(intent);
      if (outside) {
        factors.push(outside);
        score += outside.contribution;
      }
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

  /**
   * Escalation for a filesystem write whose target is not owned by the agent.
   *
   * Relative paths are workspace-scoped by construction. Scratch space (/tmp)
   * is treated the same way POL-006 treats it. Everything else is a write into
   * territory the agent does not own.
   */
  private outsideWorkspaceFactor(intent: ActionIntent): RiskFactor | null {
    if (intent.module !== 'fs') return null;
    const target = intent.target;
    if (typeof target !== 'string' || target.length === 0) return null;
    if (!isAbsolute(target)) return null;

    const lower = target.toLowerCase();
    if (SCRATCH_ROOTS.some((root) => lower.startsWith(root))) return null;

    const resolved = resolve(target);
    if (this.workspaceRoots.some((root) => resolved === root || resolved.startsWith(root.endsWith('/') ? root : root + '/'))) {
      return null;
    }

    return {
      name: 'write_outside_workspace',
      contribution: 28,
      description: `Write target "${target}" is outside the workspace (${this.workspaceRoots.join(', ')})`,
    };
  }

  private getModuleMultiplier(module: string): number {
    const multipliers: Record<string, number> = {
      fs: 1.2,
      // Sandboxed execution already runs inside an enforced isolation boundary
      // (@agi-os/sandbox); it is not additionally multiplied here.
      sandbox: 1.0,
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
      '..',
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
export function createRiskEvaluator(options?: { workspaceRoots?: string[] }): RiskEvaluator {
  return new RiskEvaluator(options);
}
