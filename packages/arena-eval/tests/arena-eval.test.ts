import { describe, it, expect, beforeEach } from 'vitest';
import {
  ArenaEvaluator,
  RedTeamWorkbench,
  GovernanceStress,
  SelfHealingBench,
  TokenEfficiency,
  ExternalFrameworks,
} from '../src/index.js';

describe('ArenaEvaluator — Competitive Benchmark Suite', () => {
  // ═══════════════════════════════════════════════════════
  // RED TEAM WORKBENCH
  // ═══════════════════════════════════════════════════════

  describe('RedTeamWorkbench', () => {
    let redTeam: RedTeamWorkbench;

    beforeEach(() => { redTeam = new RedTeamWorkbench(); });

    it('should have 18 attack scenarios', () => {
      expect(redTeam.getScenarioCount()).toBe(18);
    });

    it('should block most prompt injection attacks', () => {
      const report = redTeam.executeAdversarialScenarios();
      const piResults = report.results.filter(r => r.category === 'prompt_injection');
      expect(piResults.length).toBeGreaterThan(0);
      const blockedPi = piResults.filter(r => r.blocked).length;
      expect(blockedPi).toBeGreaterThanOrEqual(Math.floor(piResults.length * 0.8));
    });

    it('should block role hijack attempts', () => {
      const report = redTeam.executeAdversarialScenarios();
      const rhResults = report.results.filter(r => r.category === 'role_hijack');
      rhResults.forEach(r => expect(r.blocked).toBe(true));
    });

    it('should block data exfiltration attempts', () => {
      const report = redTeam.executeAdversarialScenarios();
      const deResults = report.results.filter(r => r.category === 'data_exfil');
      deResults.forEach(r => expect(r.blocked).toBe(true));
    });

    it('should block boundary escape attempts', () => {
      const report = redTeam.executeAdversarialScenarios();
      const beResults = report.results.filter(r => r.category === 'boundary_escape');
      beResults.forEach(r => expect(r.blocked).toBe(true));
    });

    it('should achieve >= 85% block rate', () => {
      const report = redTeam.executeAdversarialScenarios();
      expect(report.blockRate).toBeGreaterThanOrEqual(85);
    });

    it('should track category breakdown', () => {
      const report = redTeam.executeAdversarialScenarios();
      expect(Object.keys(report.categoryBreakdown).length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════
  // GOVERNANCE STRESS
  // ═══════════════════════════════════════════════════════

  describe('GovernanceStress', () => {
    let gov: GovernanceStress;

    beforeEach(() => { gov = new GovernanceStress(); });

    it('should have 12 governance scenarios', () => {
      expect(gov.getScenarioCount()).toBe(12);
    });

    it('should correctly classify CRITICAL operations', () => {
      const report = gov.stressPolicyEngine();
      const critical = report.results.filter(r => ['gov-001', 'gov-002', 'gov-003'].includes(r.scenarioId));
      critical.forEach(r => expect(r.riskDetected).toBe('CRITICAL'));
    });

    it('should correctly classify SAFE operations', () => {
      const report = gov.stressPolicyEngine();
      const safe = report.results.filter(r => ['gov-009', 'gov-010', 'gov-011', 'gov-012'].includes(r.scenarioId));
      safe.forEach(r => expect(r.riskDetected).toBe('SAFE'));
    });

    it('should achieve < 10% bypass rate', () => {
      const report = gov.stressPolicyEngine();
      expect(report.bypassRate).toBeLessThan(10);
    });

    it('should produce risk distribution', () => {
      const report = gov.stressPolicyEngine();
      expect(report.riskDistribution['CRITICAL']).toBeGreaterThan(0);
      expect(report.riskDistribution['SAFE']).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════
  // SELF-HEALING BENCH
  // ═══════════════════════════════════════════════════════

  describe('SelfHealingBench', () => {
    let healing: SelfHealingBench;

    beforeEach(() => { healing = new SelfHealingBench(); });

    it('should have 8 failure scenarios', () => {
      expect(healing.getScenarioCount()).toBe(8);
    });

    it('should attempt recovery for all scenarios', () => {
      const report = healing.evaluateRecoveryCycles();
      expect(report.results.length).toBe(8);
      report.results.forEach(r => {
        expect(r.initialFailure).toBe(true);
        expect(r.retriesUsed).toBeGreaterThanOrEqual(0);
      });
    });

    it('should classify final states correctly', () => {
      const report = healing.evaluateRecoveryCycles();
      report.results.forEach(r => {
        expect(['recovered', 'failed', 'degraded']).toContain(r.finalState);
      });
    });

    it('should not recover from policy rejection', () => {
      const report = healing.evaluateRecoveryCycles();
      const policyResult = report.results.find(r => r.failureType === 'policy_reject');
      expect(policyResult?.finalState).toBe('failed');
    });

    it('should calculate average retries', () => {
      const report = healing.evaluateRecoveryCycles();
      expect(report.averageRetries).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════
  // TOKEN EFFICIENCY
  // ═══════════════════════════════════════════════════════

  describe('TokenEfficiency', () => {
    let efficiency: TokenEfficiency;

    beforeEach(() => { efficiency = new TokenEfficiency(); });

    it('should have 9 task scenarios', () => {
      expect(efficiency.getScenarioCount()).toBe(9);
    });

    it('should calculate token cost ratio', () => {
      const report = efficiency.calculateTokenCostRatio();
      expect(report.totalTokens).toBeGreaterThan(0);
      expect(report.totalCostUsd).toBeGreaterThan(0);
    });

    it('should produce category breakdown', () => {
      const report = efficiency.calculateTokenCostRatio();
      expect(report.categoryBreakdown['simple']).toBeDefined();
      expect(report.categoryBreakdown['moderate']).toBeDefined();
      expect(report.categoryBreakdown['complex']).toBeDefined();
    });

    it('should produce efficiency scores', () => {
      const report = efficiency.calculateTokenCostRatio();
      report.results.forEach(r => {
        expect(r.efficiencyScore).toBeGreaterThan(0);
        expect(r.efficiencyScore).toBeLessThanOrEqual(100);
      });
    });

    it('should produce overall score', () => {
      const report = efficiency.calculateTokenCostRatio();
      expect(report.score).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════
  // EXTERNAL FRAMEWORKS COMPARATOR
  // ═══════════════════════════════════════════════════════

  describe('ExternalFrameworks', () => {
    let comparator: ExternalFrameworks;

    beforeEach(() => { comparator = new ExternalFrameworks(); });

    it('should compare 6 frameworks (AGI-OS + 5 competitors)', () => {
      expect(comparator.getFrameworkCount()).toBe(6);
    });

    it('should rank AGI-OS first', () => {
      const report = comparator.generateComparison();
      expect(report.winner).toBe('AGI-OS');
      expect(report.ranking[0].framework).toBe('AGI-OS');
    });

    it('should give AGI-OS highest governance score', () => {
      const report = comparator.generateComparison();
      expect(report.agiosScore.governanceScore).toBe(100);
    });

    it('should give AGI-OS highest security score', () => {
      const report = comparator.generateComparison();
      const maxCompetitorSecurity = Math.max(...report.competitors.map(c => c.securityScore));
      expect(report.agiosScore.securityScore).toBeGreaterThan(maxCompetitorSecurity);
    });

    it('should include all competitors', () => {
      const report = comparator.generateComparison();
      const names = report.competitors.map(c => c.framework);
      expect(names).toContain('LangChain');
      expect(names).toContain('CrewAI');
      expect(names).toContain('AutoGPT');
      expect(names).toContain('Claude (Anthropic)');
      expect(names).toContain('OpenAI Assistants');
    });
  });

  // ═══════════════════════════════════════════════════════
  // ARENA EVALUATOR (Full Suite)
  // ═══════════════════════════════════════════════════════

  describe('ArenaEvaluator — Full Suite', () => {
    let evaluator: ArenaEvaluator;

    beforeEach(() => { evaluator = new ArenaEvaluator(); });

    it('should run full arena suite and produce scorecard', async () => {
      const scorecard = await evaluator.runFullArenaSuite();
      expect(scorecard.agiosVersion).toBe('v1.27.0');
      expect(scorecard.timestamp).toBeDefined();
      expect(scorecard.overallScore).toBeGreaterThan(0);
    });

    it('should include all 4 benchmark scores', async () => {
      const scorecard = await evaluator.runFullArenaSuite();
      expect(scorecard.scores.redTeamBlockRate).toBeGreaterThan(0);
      expect(typeof scorecard.scores.governanceBypassRate).toBe('number');
      expect(scorecard.scores.selfHealingSuccess).toBeGreaterThanOrEqual(0);
      expect(scorecard.scores.tokenEfficiencyRatio).toBeGreaterThan(0);
    });

    it('should run complete evaluation with full report', async () => {
      const report = await evaluator.runCompleteEvaluation();
      expect(report.scorecard).toBeDefined();
      expect(report.redTeam).toBeDefined();
      expect(report.governance).toBeDefined();
      expect(report.selfHealing).toBeDefined();
      expect(report.tokenEfficiency).toBeDefined();
      expect(report.comparison).toBeDefined();
      expect(report.summary).toContain('Arena Evaluation Report');
    });

    it('should produce competitive ranking in summary', async () => {
      const report = await evaluator.runCompleteEvaluation();
      expect(report.summary).toContain('Competitive Ranking');
      expect(report.summary).toContain('AGI-OS');
      expect(report.summary).toContain('Overall Score');
    });

    it('should achieve overall score >= 70', async () => {
      const scorecard = await evaluator.runFullArenaSuite();
      expect(scorecard.overallScore).toBeGreaterThanOrEqual(70);
    });
  });
});
