// ═══════════════════════════════════════════════════════
// ArenaEvaluator — Main Orchestrator
// Coordinates all benchmarks and produces final scorecard
// ═══════════════════════════════════════════════════════

import type { RedTeamReport } from './benchmarks/RedTeamWorkbench';
import { RedTeamWorkbench } from './benchmarks/RedTeamWorkbench';
import type { GovernanceReport } from './benchmarks/GovernanceStress';
import { GovernanceStress } from './benchmarks/GovernanceStress';
import type { SelfHealingReport } from './benchmarks/SelfHealingBench';
import { SelfHealingBench } from './benchmarks/SelfHealingBench';
import type { TokenEfficiencyReport } from './benchmarks/TokenEfficiency';
import { TokenEfficiency } from './benchmarks/TokenEfficiency';
import type { ComparisonReport } from './comparators/ExternalFrameworks';
import { ExternalFrameworks } from './comparators/ExternalFrameworks';

export interface ArenaScoreCard {
  timestamp: string;
  agiosVersion: string;
  scores: {
    redTeamBlockRate: number;
    governanceBypassRate: number;
    selfHealingSuccess: number;
    tokenEfficiencyRatio: number;
  };
  overallScore: number;
  comparison?: ComparisonReport;
}

export interface FullArenaReport {
  scorecard: ArenaScoreCard;
  redTeam: RedTeamReport;
  governance: GovernanceReport;
  selfHealing: SelfHealingReport;
  tokenEfficiency: TokenEfficiencyReport;
  comparison: ComparisonReport;
  summary: string;
}

export class ArenaEvaluator {
  private redTeam = new RedTeamWorkbench();
  private governance = new GovernanceStress();
  private selfHealing = new SelfHealingBench();
  private efficiency = new TokenEfficiency();
  private comparator = new ExternalFrameworks();

  async runFullArenaSuite(): Promise<ArenaScoreCard> {
    const redTeamRes = this.redTeam.executeAdversarialScenarios();
    const govRes = this.governance.stressPolicyEngine();
    const healingRes = this.selfHealing.evaluateRecoveryCycles();
    const effRes = this.efficiency.calculateTokenCostRatio();

    const overallScore = Number(
      ((redTeamRes.blockRate + (100 - govRes.bypassRate) + healingRes.successRate + effRes.score) / 4).toFixed(2)
    );

    return {
      timestamp: new Date().toISOString(),
      agiosVersion: 'v1.27.0',
      scores: {
        redTeamBlockRate: redTeamRes.blockRate,
        governanceBypassRate: govRes.bypassRate,
        selfHealingSuccess: healingRes.successRate,
        tokenEfficiencyRatio: effRes.score,
      },
      overallScore,
    };
  }

  async runCompleteEvaluation(): Promise<FullArenaReport> {
    const scorecard = await this.runFullArenaSuite();
    const redTeam = this.redTeam.executeAdversarialScenarios();
    const governance = this.governance.stressPolicyEngine();
    const selfHealing = this.selfHealing.evaluateRecoveryCycles();
    const tokenEfficiency = this.efficiency.calculateTokenCostRatio();
    const comparison = this.comparator.generateComparison();

    scorecard.comparison = comparison;

    const summary = [
      `═══ AGI-OS Arena Evaluation Report ═══`,
      ``,
      `Version: ${scorecard.agiosVersion}`,
      `Timestamp: ${scorecard.timestamp}`,
      ``,
      `─── Security ───`,
      `Red Team Block Rate:    ${scorecard.scores.redTeamBlockRate}%`,
      `  (${redTeam.blocked}/${redTeam.totalAttacks} attacks blocked)`,
      ``,
      `─── Governance ───`,
      `Policy Bypass Rate:     ${scorecard.scores.governanceBypassRate}%`,
      `  (${governance.correctlyHandled}/${governance.totalScenarios} scenarios correct)`,
      ``,
      `─── Self-Healing ───`,
      `Recovery Success:       ${scorecard.scores.selfHealingSuccess}%`,
      `  (${selfHealing.recovered}/${selfHealing.totalScenarios} recovered, avg ${selfHealing.averageRetries} retries)`,
      ``,
      `─── Efficiency ───`,
      `Token Efficiency:       ${scorecard.scores.tokenEfficiencyRatio}`,
      `  (${tokenEfficiency.totalTokens} tokens, $${tokenEfficiency.totalCostUsd.toFixed(4)} total)`,
      ``,
      `─── Competitive Ranking ───`,
      ...comparison.ranking.map((r, i) => `  ${i + 1}. ${r.framework} — ${r.overallScore}`),
      ``,
      `═══ Overall Score: ${scorecard.overallScore} ═══`,
    ].join('\n');

    return { scorecard, redTeam, governance, selfHealing, tokenEfficiency, comparison, summary };
  }
}
