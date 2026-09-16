// ============================================================================
// AGI OS - Generalization Evaluator
// Orchestrates cross-domain scenario evaluation through governance pipeline
// ============================================================================

import { now } from '@agi-os/kernel';
import { GovernanceGateway } from '@agi-os/governance';
import type { PolicyDecision as PD } from '@agi-os/governance';
import { PolicyDecision } from '@agi-os/governance';
import type { OperationalDomain } from './types.js';
import type { DomainScenario, ScenarioResult, InterceptResult, EvaluationReport, DomainEvaluation, EvaluationConfig } from './types.js';
import { crossDomainScenarios } from './scenarios.js';

// ---------------------------------------------------------------------------
// GeneralizationEvaluator — the master coordinator
// ---------------------------------------------------------------------------
export class GeneralizationEvaluator {
  private governance: GovernanceGateway;
  private config: EvaluationConfig;

  constructor(params?: {
    governance?: GovernanceGateway;
    config?: Partial<EvaluationConfig>;
  }) {
    this.governance = params?.governance ?? new GovernanceGateway();
    this.config = {
      failOnFirst: false,
      verbose: false,
      ...params?.config,
    };
  }

  /**
   * Run all scenarios and produce a full evaluation report
   */
  async runAll(): Promise<EvaluationReport> {
    const startTime = Date.now();
    const scenarios = this.filterScenarios(crossDomainScenarios);

    const results: ScenarioResult[] = [];
    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);

      if (!result.passed && this.config.failOnFirst) {
        break;
      }
    }

    return this.buildReport(results, Date.now() - startTime);
  }

  /**
   * Run scenarios for a specific domain
   */
  async runDomain(domain: OperationalDomain): Promise<DomainEvaluation> {
    const scenarios = crossDomainScenarios.filter((s) => s.domain === domain);
    const results: ScenarioResult[] = [];

    for (const scenario of scenarios) {
      results.push(await this.runScenario(scenario));
    }

    const passed = results.filter((r) => r.passed).length;
    return {
      domain,
      total: results.length,
      passed,
      failed: results.length - passed,
      passRate: results.length > 0 ? passed / results.length : 0,
      results,
    };
  }

  /**
   * Run a single scenario through the governance pipeline
   */
  async runScenario(scenario: DomainScenario): Promise<ScenarioResult> {
    const startTime = Date.now();
    const interceptResults: InterceptResult[] = [];
    let worstDecision: PD = PolicyDecision.ALLOW;
    let worstRisk = 0;

    for (const intent of scenario.actionIntents) {
      const gateResult = this.governance.intercept(intent);

      interceptResults.push({
        intent,
        decision: gateResult.decision,
        riskAssessment: gateResult.riskAssessment,
        matchedRuleId: gateResult.auditRecord.matchedRuleId,
        overridden: gateResult.auditRecord.overridden,
      });

      // Track worst decision (BLOCK > REQUIRE_APPROVAL > ALLOW)
      if (this.decisionSeverity(gateResult.decision) > this.decisionSeverity(worstDecision)) {
        worstDecision = gateResult.decision;
      }
      if (gateResult.riskAssessment.riskLevel > worstRisk) {
        worstRisk = gateResult.riskAssessment.riskLevel;
      }
    }

    const passed = worstDecision === scenario.expectedDecision;

    if (!passed && this.config.verbose) {
      console.error(
        `[FAIL] ${scenario.id}: expected ${scenario.expectedDecision}, got ${worstDecision}`
      );
    }

    return {
      scenarioId: scenario.id,
      domain: scenario.domain,
      passed,
      actualDecision: worstDecision,
      expectedDecision: scenario.expectedDecision,
      actualRiskLevel: worstRisk,
      expectedRiskLevel: scenario.expectedRiskLevel,
      interceptResults,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Run scenarios from multiple domains
   */
  async runDomains(domains: OperationalDomain[]): Promise<DomainEvaluation[]> {
    const evaluations: DomainEvaluation[] = [];
    for (const domain of domains) {
      evaluations.push(await this.runDomain(domain));
    }
    return evaluations;
  }

  /**
   * Get the governance gateway
   */
  getGovernance(): GovernanceGateway {
    return this.governance;
  }

  /**
   * Get default scenarios
   */
  getScenarios(): DomainScenario[] {
    return [...crossDomainScenarios];
  }

  /**
   * Get scenarios by domain
   */
  getScenariosByDomain(domain: OperationalDomain): DomainScenario[] {
    return crossDomainScenarios.filter((s) => s.domain === domain);
  }

  /**
   * Get scenarios by tag
   */
  getScenariosByTag(tag: string): DomainScenario[] {
    return crossDomainScenarios.filter((s) => s.tags.includes(tag));
  }

  /**
   * Count scenarios per domain
   */
  getDomainCounts(): Record<OperationalDomain, number> {
    const counts = {} as Record<OperationalDomain, number>;
    for (const s of crossDomainScenarios) {
      counts[s.domain] = (counts[s.domain] ?? 0) + 1;
    }
    return counts;
  }

  // ---- Private -----------------------------------------------------------

  private filterScenarios(scenarios: DomainScenario[]): DomainScenario[] {
    let filtered = scenarios;

    if (this.config.filterDomains && this.config.filterDomains.length > 0) {
      const domains = new Set(this.config.filterDomains);
      filtered = filtered.filter((s) => domains.has(s.domain));
    }

    if (this.config.filterTags && this.config.filterTags.length > 0) {
      const tags = new Set(this.config.filterTags);
      filtered = filtered.filter((s) => s.tags.some((t) => tags.has(t)));
    }

    return filtered;
  }

  private decisionSeverity(d: PD): number {
    switch (d) {
      case PolicyDecision.BLOCK: return 3;
      case PolicyDecision.REQUIRE_APPROVAL: return 2;
      case PolicyDecision.ALLOW: return 1;
      default: return 0;
    }
  }

  private buildReport(results: ScenarioResult[], durationMs: number): EvaluationReport {
    // Group by domain
    const byDomain = new Map<OperationalDomain, ScenarioResult[]>();
    for (const r of results) {
      if (!byDomain.has(r.domain)) byDomain.set(r.domain, []);
      byDomain.get(r.domain)!.push(r);
    }

    const domainResults: DomainEvaluation[] = [];
    for (const [domain, domainResultsList] of byDomain) {
      const passed = domainResultsList.filter((r) => r.passed).length;
      domainResults.push({
        domain,
        total: domainResultsList.length,
        passed,
        failed: domainResultsList.length - passed,
        passRate: domainResultsList.length > 0 ? passed / domainResultsList.length : 0,
        results: domainResultsList,
      });
    }

    const totalPassed = results.filter((r) => r.passed).length;

    return {
      totalScenarios: results.length,
      passed: totalPassed,
      failed: results.length - totalPassed,
      passRate: results.length > 0 ? totalPassed / results.length : 0,
      domainResults,
      durationMs,
      timestamp: now().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createGeneralizationEvaluator(params?: {
  governance?: GovernanceGateway;
  config?: Partial<EvaluationConfig>;
}): GeneralizationEvaluator {
  return new GeneralizationEvaluator(params);
}
