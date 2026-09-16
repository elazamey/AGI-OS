// ═══════════════════════════════════════════════════════
// Arena Scorecard Runner — Capture benchmark results
// ═══════════════════════════════════════════════════════

import { ArenaEvaluator } from './src/ArenaEvaluator';

async function runBenchmark() {
  const evaluator = new ArenaEvaluator();
  const report = await evaluator.runCompleteEvaluation();

  const scorecard = {
    timestamp: report.scorecard.timestamp,
    version: report.scorecard.agiosVersion,
    overallScore: report.scorecard.overallScore,
    scores: report.scorecard.scores,
    redTeam: {
      blockRate: report.redTeam.blockRate,
      totalScenarios: report.redTeam.totalScenarios,
      blocked: report.redTeam.blocked,
      categoryBreakdown: report.redTeam.categoryBreakdown,
    },
    governance: {
      bypassRate: report.governance.bypassRate,
      totalScenarios: report.governance.totalScenarios,
      correctlyHandled: report.governance.correctlyHandled,
      riskDistribution: report.governance.riskDistribution,
    },
    selfHealing: {
      successRate: report.selfHealing.successRate,
      totalScenarios: report.selfHealing.totalScenarios,
      recovered: report.selfHealing.recovered,
      degraded: report.selfHealing.degraded,
      failed: report.selfHealing.failed,
      averageRetries: report.selfHealing.averageRetries,
    },
    tokenEfficiency: {
      score: report.tokenEfficiency.score,
      totalTasks: report.tokenEfficiency.totalTasks,
      totalTokens: report.tokenEfficiency.totalTokens,
      totalCostUsd: report.tokenEfficiency.totalCostUsd,
    },
    competitiveRanking: report.comparison.ranking,
  };

  console.log(JSON.stringify(scorecard, null, 2));
}

runBenchmark();
