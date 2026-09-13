import { now } from '@agi-os/kernel';
import { GovernanceGateway } from '@agi-os/governance';
import { SBOMGenerator } from './sbom-generator.js';
import { DependencyAuditor } from './dependency-auditor.js';
import { RegressionTracker } from './regression-tracker.js';
import type { ProductionGateReport, GateResult, GateStatus } from './types.js';

export class ProductionGate {
  private governance: GovernanceGateway;
  private sbom: SBOMGenerator;
  private depAuditor: DependencyAuditor;
  private regression: RegressionTracker;
  private gates: GateResult[] = [];

  constructor(params?: {
    governance?: GovernanceGateway;
    sbom?: SBOMGenerator;
    depAuditor?: DependencyAuditor;
    regression?: RegressionTracker;
  }) {
    this.governance = params?.governance ?? new GovernanceGateway();
    this.sbom = params?.sbom ?? new SBOMGenerator();
    this.depAuditor = params?.depAuditor ?? new DependencyAuditor();
    this.regression = params?.regression ?? new RegressionTracker();
  }

  runAllGates(version: string, deps?: Record<string, string>, regressionValues?: Record<string, number>): ProductionGateReport {
    const start = Date.now();
    this.gates = [];

    // G1: SBOM completeness
    this.gates.push(this.runSBOMGate());

    // G2: Dependency audit
    this.gates.push(this.runDependencyGate(deps ?? {}))

    // G3: Regression thresholds
    this.gates.push(this.runRegressionGate(regressionValues ?? {}));

    // G4: Governance integrity
    this.gates.push(this.runGovernanceGate());

    // G5: Policy engine check
    this.gates.push(this.runPolicyGate());

    const overallStatus = this.gates.some(g => g.status === 'FAIL' || g.status === 'BLOCKED') ? 'FAIL' : 'PASS';

    return {
      timestamp: now().toISOString(),
      version,
      gates: this.gates,
      overallStatus,
      durationMs: Date.now() - start,
      sbom: this.sbom.getEntries(),
      dependencies: deps ? this.depAuditor.audit(deps) : [],
      regressions: regressionValues ? this.regression.checkAll(regressionValues) : [],
    };
  }

  runSBOMGate(): GateResult {
    const start = Date.now();
    const entries = this.sbom.getEntries();
    const status: GateStatus = entries.length > 0 ? 'PASS' : 'WARN';
    return {
      gate: 'G-PROD-SBOM',
      status,
      details: entries.length > 0 ? [`${entries.length} packages tracked`] : ['No SBOM entries — run scan first'],
      durationMs: Date.now() - start,
    };
  }

  runDependencyGate(deps: Record<string, string>): GateResult {
    const start = Date.now();
    const results = this.depAuditor.audit(deps);
    const critical = this.depAuditor.getCriticalCount(results);
    const high = this.depAuditor.getHighCount(results);
    const fixable = this.depAuditor.getFixableCount(results);
    const status: GateStatus = critical > 0 ? 'FAIL' : high > 0 ? 'WARN' : 'PASS';
    const details = [
      `${results.length} vulnerabilities found`,
      `${critical} critical, ${high} high`,
      `${fixable} fixable`,
    ];
    return { gate: 'G-PROD-DEPS', status, details, durationMs: Date.now() - start };
  }

  runRegressionGate(values: Record<string, number>): GateResult {
    const start = Date.now();
    const checks = this.regression.checkAll(values);
    const failed = checks.filter(c => !c.passed);
    const status: GateStatus = failed.length === 0 ? 'PASS' : 'FAIL';
    const details = failed.length === 0
      ? [`All ${checks.length} metrics within thresholds`]
      : failed.map(f => `REGRESSION: ${f.metric} deviated ${(f.deviation * 100).toFixed(1)}%`);
    return { gate: 'G-PROD-REGRESSION', status, details, durationMs: Date.now() - start };
  }

  runGovernanceGate(): GateResult {
    const start = Date.now();
    const auditHistory = this.governance.getAuditHistory();
    const pendingApprovals = this.governance.getPendingApprovals();
    const status: GateStatus = pendingApprovals.length === 0 ? 'PASS' : 'WARN';
    return {
      gate: 'G-PROD-GOVERNANCE',
      status,
      details: [`Audit records: ${auditHistory.length}`, `Pending approvals: ${pendingApprovals.length}`],
      durationMs: Date.now() - start,
    };
  }

  runPolicyGate(): GateResult {
    const start = Date.now();
    const policyEngine = this.governance.getPolicyEngine();
    const rules = policyEngine.getEnabledRules();
    const status: GateStatus = rules.length >= 5 ? 'PASS' : 'WARN';
    return {
      gate: 'G-PROD-POLICY',
      status,
      details: [`${rules.length} active policies`],
      durationMs: Date.now() - start,
    };
  }

  getSBOM(): SBOMGenerator { return this.sbom; }
  getDepAuditor(): DependencyAuditor { return this.depAuditor; }
  getRegression(): RegressionTracker { return this.regression; }
  getGovernance(): GovernanceGateway { return this.governance; }
}
