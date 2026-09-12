import { describe, it, expect, beforeEach } from 'vitest';
import { GeneralizationEvaluator } from '../src/evaluator.js';
import { GovernanceGateway } from '@agi-os/governance';
import { OperationalDomain } from '../src/types.js';
import { PolicyDecision } from '@agi-os/governance';
import { crossDomainScenarios } from '../src/scenarios.js';

describe('GeneralizationEvaluator', () => {
  let evaluator: GeneralizationEvaluator;
  let governance: GovernanceGateway;

  beforeEach(() => {
    governance = new GovernanceGateway();
    evaluator = new GeneralizationEvaluator({ governance });
  });

  // ---- Scenario definitions ----------------------------------------------
  describe('Scenario definitions', () => {
    it('should have scenarios for all 7 domains', () => {
      const domains = new Set(crossDomainScenarios.map((s) => s.domain));
      expect(domains.size).toBe(7);
    });

    it('should have at least 3 scenarios per domain', () => {
      const counts = evaluator.getDomainCounts();
      for (const [domain, count] of Object.entries(counts)) {
        expect(count).toBeGreaterThanOrEqual(3);
      }
    });

    it('should have unique scenario IDs', () => {
      const ids = crossDomainScenarios.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should have total of 20+ scenarios', () => {
      expect(crossDomainScenarios.length).toBeGreaterThanOrEqual(20);
    });

    it('should have expectedDecision defined for all scenarios', () => {
      for (const s of crossDomainScenarios) {
        expect(s.expectedDecision).toBeDefined();
      }
    });

    it('should have expectedRiskLevel for all scenarios', () => {
      for (const s of crossDomainScenarios) {
        expect(s.expectedRiskLevel).toBeGreaterThanOrEqual(1);
        expect(s.expectedRiskLevel).toBeLessThanOrEqual(4);
      }
    });
  });

  // ---- Run single scenario -----------------------------------------------
  describe('runScenario', () => {
    it('should run GEN-SE-001 (FastAPI route) and require approval', async () => {
      const scenario = evaluator.getScenarios().find((s) => s.id === 'GEN-SE-001')!;
      const result = await evaluator.runScenario(scenario);
      expect(result.passed).toBe(true);
      expect(result.actualDecision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    });

    it('should run GEN-EC-001 (product description) and allow', async () => {
      const scenario = evaluator.getScenarios().find((s) => s.id === 'GEN-EC-001')!;
      const result = await evaluator.runScenario(scenario);
      expect(result.passed).toBe(true);
      expect(result.actualDecision).toBe(PolicyDecision.ALLOW);
    });

    it('should run GEN-ST-001 (.env read) and block', async () => {
      const scenario = evaluator.getScenarios().find((s) => s.id === 'GEN-ST-001')!;
      const result = await evaluator.runScenario(scenario);
      expect(result.passed).toBe(true);
      expect(result.actualDecision).toBe(PolicyDecision.BLOCK);
    });

    it('should run GEN-ST-002 (rm -rf) and block', async () => {
      const scenario = evaluator.getScenarios().find((s) => s.id === 'GEN-ST-002')!;
      const result = await evaluator.runScenario(scenario);
      expect(result.passed).toBe(true);
      expect(result.actualDecision).toBe(PolicyDecision.BLOCK);
    });

    it('should run GEN-DA-001 (CSV read) and allow', async () => {
      const scenario = evaluator.getScenarios().find((s) => s.id === 'GEN-DA-001')!;
      const result = await evaluator.runScenario(scenario);
      expect(result.passed).toBe(true);
      expect(result.actualDecision).toBe(PolicyDecision.ALLOW);
    });

    it('should track intercept results', async () => {
      const scenario = evaluator.getScenarios().find((s) => s.id === 'GEN-SE-001')!;
      const result = await evaluator.runScenario(scenario);
      expect(result.interceptResults.length).toBe(2); // fs + db
    });
  });

  // ---- Run all scenarios -------------------------------------------------
  describe('runAll', () => {
    it('should run all scenarios and produce a report', async () => {
      const report = await evaluator.runAll();
      expect(report.totalScenarios).toBe(crossDomainScenarios.length);
      expect(report.passed).toBe(crossDomainScenarios.length);
      expect(report.failed).toBe(0);
      expect(report.passRate).toBe(1);
    });

    it('should include domain results', async () => {
      const report = await evaluator.runAll();
      expect(report.domainResults.length).toBe(7);
    });

    it('should have duration', async () => {
      const report = await evaluator.runAll();
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should have timestamp', async () => {
      const report = await evaluator.runAll();
      expect(report.timestamp).toBeDefined();
    });
  });

  // ---- Run single domain -------------------------------------------------
  describe('runDomain', () => {
    it('should run all SECURITY_TESTING scenarios', async () => {
      const eval_ = await evaluator.runDomain(OperationalDomain.SECURITY_TESTING);
      expect(eval_.domain).toBe(OperationalDomain.SECURITY_TESTING);
      expect(eval_.total).toBeGreaterThanOrEqual(5);
      expect(eval_.passed).toBe(eval_.total); // all should pass
    });

    it('should run all E_COMMERCE scenarios', async () => {
      const eval_ = await evaluator.runDomain(OperationalDomain.E_COMMERCE);
      expect(eval_.total).toBeGreaterThanOrEqual(3);
      expect(eval_.passRate).toBe(1);
    });

    it('should run all DATA_ANALYSIS scenarios', async () => {
      const eval_ = await evaluator.runDomain(OperationalDomain.DATA_ANALYSIS);
      expect(eval_.total).toBeGreaterThanOrEqual(3);
      expect(eval_.passRate).toBe(1);
    });
  });

  // ---- Filtering ---------------------------------------------------------
  describe('Filtering', () => {
    it('should filter by domain', async () => {
      const filtered = new GeneralizationEvaluator({
        governance,
        config: { filterDomains: [OperationalDomain.SECURITY_TESTING] },
      });
      const report = await filtered.runAll();
      expect(report.totalScenarios).toBe(
        crossDomainScenarios.filter((s) => s.domain === OperationalDomain.SECURITY_TESTING).length
      );
    });

    it('should filter by tag', async () => {
      const filtered = new GeneralizationEvaluator({
        governance,
        config: { filterTags: ['blocked'] },
      });
      const report = await filtered.runAll();
      expect(report.totalScenarios).toBe(
        crossDomainScenarios.filter((s) => s.tags.includes('blocked')).length
      );
    });

    it('should get scenarios by tag', () => {
      const blocked = evaluator.getScenariosByTag('blocked');
      expect(blocked.length).toBeGreaterThan(0);
      expect(blocked.every((s) => s.tags.includes('blocked'))).toBe(true);
    });

    it('should get scenarios by domain', () => {
      const sec = evaluator.getScenariosByDomain(OperationalDomain.SECURITY_TESTING);
      expect(sec.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ---- Policy invariant verification --------------------------------------
  describe('Policy invariants', () => {
    it('should BLOCK all .env reads regardless of domain', async () => {
      const envScenarios = evaluator.getScenariosByTag('blocked');
      for (const scenario of envScenarios) {
        const result = await evaluator.runScenario(scenario);
        if (scenario.actionIntents.some((i) => i.target.includes('.env'))) {
          expect(result.actualDecision).toBe(PolicyDecision.BLOCK);
        }
      }
    });

    it('should BLOCK all dangerous exec commands', async () => {
      const dangerous = evaluator.getScenariosByTag('blocked');
      for (const scenario of dangerous) {
        if (scenario.actionIntents.some((i) => i.target.includes('rm -rf'))) {
          const result = await evaluator.runScenario(scenario);
          expect(result.actualDecision).toBe(PolicyDecision.BLOCK);
        }
      }
    });

    it('should REQUIRE_APPROVAL for all destructive operations', async () => {
      const allScenarios = evaluator.getScenarios();
      for (const scenario of allScenarios) {
        const hasDestructive = scenario.actionIntents.some(
          (i) => ['delete', 'drop', 'destroy'].includes(i.operation)
        );
        if (hasDestructive) {
          const result = await evaluator.runScenario(scenario);
          expect(result.actualDecision).not.toBe(PolicyDecision.ALLOW);
        }
      }
    });

    it('should ALLOW all safe read operations', async () => {
      const safeReads = evaluator.getScenariosByTag('safe');
      for (const scenario of safeReads) {
        const result = await evaluator.runScenario(scenario);
        expect(result.actualDecision).toBe(PolicyDecision.ALLOW);
      }
    });
  });

  // ---- Domain coverage verification --------------------------------------
  describe('Domain coverage', () => {
    it('should cover SOFTWARE_ENGINEERING', async () => {
      const eval_ = await evaluator.runDomain(OperationalDomain.SOFTWARE_ENGINEERING);
      expect(eval_.total).toBeGreaterThanOrEqual(3);
    });

    it('should cover SYSTEM_ADMINISTRATION', async () => {
      const eval_ = await evaluator.runDomain(OperationalDomain.SYSTEM_ADMINISTRATION);
      expect(eval_.total).toBeGreaterThanOrEqual(3);
    });

    it('should cover DATABASE_MANAGEMENT', async () => {
      const eval_ = await evaluator.runDomain(OperationalDomain.DATABASE_MANAGEMENT);
      expect(eval_.total).toBeGreaterThanOrEqual(3);
    });

    it('should cover E_COMMERCE', async () => {
      const eval_ = await evaluator.runDomain(OperationalDomain.E_COMMERCE);
      expect(eval_.total).toBeGreaterThanOrEqual(3);
    });

    it('should cover MEDIA_AUTOMATION', async () => {
      const eval_ = await evaluator.runDomain(OperationalDomain.MEDIA_AUTOMATION);
      expect(eval_.total).toBeGreaterThanOrEqual(3);
    });

    it('should cover DATA_ANALYSIS', async () => {
      const eval_ = await evaluator.runDomain(OperationalDomain.DATA_ANALYSIS);
      expect(eval_.total).toBeGreaterThanOrEqual(3);
    });

    it('should cover SECURITY_TESTING', async () => {
      const eval_ = await evaluator.runDomain(OperationalDomain.SECURITY_TESTING);
      expect(eval_.total).toBeGreaterThanOrEqual(5);
    });
  });

  // ---- Golden test: full evaluation across all 7 domains -----------------
  describe('Golden: full 7-domain evaluation', () => {
    it('should achieve 100% pass rate across all 7 domains', async () => {
      const report = await evaluator.runAll();

      expect(report.passRate).toBe(1);
      expect(report.failed).toBe(0);

      // Verify all 7 domains are represented
      const domainNames = report.domainResults.map((d) => d.domain);
      expect(domainNames).toContain(OperationalDomain.SOFTWARE_ENGINEERING);
      expect(domainNames).toContain(OperationalDomain.SYSTEM_ADMINISTRATION);
      expect(domainNames).toContain(OperationalDomain.DATABASE_MANAGEMENT);
      expect(domainNames).toContain(OperationalDomain.E_COMMERCE);
      expect(domainNames).toContain(OperationalDomain.MEDIA_AUTOMATION);
      expect(domainNames).toContain(OperationalDomain.DATA_ANALYSIS);
      expect(domainNames).toContain(OperationalDomain.SECURITY_TESTING);

      // Verify every domain achieved 100%
      for (const domainResult of report.domainResults) {
        expect(domainResult.passRate).toBe(1);
      }

      // Verify audit trail was populated
      const auditStats = governance.getAuditStats();
      expect(auditStats.total).toBeGreaterThanOrEqual(report.totalScenarios);
    });
  });
});
