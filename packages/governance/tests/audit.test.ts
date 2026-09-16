import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLedger } from '../src/audit.js';
import { PolicyDecision, RiskLevel } from '../src/types.js';
import type { ActionIntent, RiskAssessment } from '../src/types.js';

function makeIntent(overrides?: Partial<ActionIntent>): ActionIntent {
  return { id: 'i1', module: 'fs', operation: 'read', target: './file.txt', ...overrides };
}

function makeRisk(overrides?: Partial<RiskAssessment>): RiskAssessment {
  return {
    intent: makeIntent(),
    riskLevel: RiskLevel.LOW,
    riskScore: 5,
    factors: [],
    reason: 'test',
    ...overrides,
  };
}

describe('AuditLedger', () => {
  let ledger: AuditLedger;

  beforeEach(() => {
    ledger = new AuditLedger();
  });

  it('should log audit records', () => {
    ledger.log({
      intent: makeIntent(),
      riskAssessment: makeRisk(),
      decision: PolicyDecision.ALLOW,
      matchedRuleId: null,
      reason: 'safe',
      overridden: false,
    });
    expect(ledger.count()).toBe(1);
  });

  it('should get history', () => {
    ledger.log({ intent: makeIntent(), riskAssessment: makeRisk(), decision: PolicyDecision.ALLOW, matchedRuleId: null, reason: 'r', overridden: false });
    ledger.log({ intent: makeIntent({ id: 'i2' }), riskAssessment: makeRisk(), decision: PolicyDecision.BLOCK, matchedRuleId: 'POL-001', reason: 'r', overridden: false });
    expect(ledger.getHistory()).toHaveLength(2);
  });

  it('should get by intent ID', () => {
    ledger.log({ intent: makeIntent({ id: 'i1' }), riskAssessment: makeRisk(), decision: PolicyDecision.ALLOW, matchedRuleId: null, reason: 'r', overridden: false });
    ledger.log({ intent: makeIntent({ id: 'i2' }), riskAssessment: makeRisk(), decision: PolicyDecision.BLOCK, matchedRuleId: null, reason: 'r', overridden: false });
    expect(ledger.getByIntentId('i1')).toHaveLength(1);
  });

  it('should get by decision', () => {
    ledger.log({ intent: makeIntent(), riskAssessment: makeRisk(), decision: PolicyDecision.ALLOW, matchedRuleId: null, reason: 'r', overridden: false });
    ledger.log({ intent: makeIntent(), riskAssessment: makeRisk(), decision: PolicyDecision.BLOCK, matchedRuleId: null, reason: 'r', overridden: false });
    ledger.log({ intent: makeIntent(), riskAssessment: makeRisk(), decision: PolicyDecision.REQUIRE_APPROVAL, matchedRuleId: null, reason: 'r', overridden: false });
    expect(ledger.getBlocked()).toHaveLength(1);
    expect(ledger.getPendingApproval()).toHaveLength(1);
    expect(ledger.getAllowed()).toHaveLength(1);
  });

  it('should get overridden', () => {
    ledger.log({ intent: makeIntent(), riskAssessment: makeRisk(), decision: PolicyDecision.ALLOW, matchedRuleId: null, reason: 'r', overridden: true });
    ledger.log({ intent: makeIntent(), riskAssessment: makeRisk(), decision: PolicyDecision.ALLOW, matchedRuleId: null, reason: 'r', overridden: false });
    expect(ledger.getOverridden()).toHaveLength(1);
  });

  it('should get by module', () => {
    ledger.log({ intent: makeIntent({ module: 'fs' }), riskAssessment: makeRisk(), decision: PolicyDecision.ALLOW, matchedRuleId: null, reason: 'r', overridden: false });
    ledger.log({ intent: makeIntent({ module: 'db' }), riskAssessment: makeRisk(), decision: PolicyDecision.ALLOW, matchedRuleId: null, reason: 'r', overridden: false });
    expect(ledger.getByModule('fs')).toHaveLength(1);
  });

  it('should get by rule', () => {
    ledger.log({ intent: makeIntent(), riskAssessment: makeRisk(), decision: PolicyDecision.BLOCK, matchedRuleId: 'POL-001', reason: 'r', overridden: false });
    ledger.log({ intent: makeIntent(), riskAssessment: makeRisk(), decision: PolicyDecision.BLOCK, matchedRuleId: 'POL-002', reason: 'r', overridden: false });
    expect(ledger.getByRule('POL-001')).toHaveLength(1);
  });

  it('should get recent', () => {
    for (let i = 0; i < 10; i++) {
      ledger.log({ intent: makeIntent({ id: `i${i}` }), riskAssessment: makeRisk(), decision: PolicyDecision.ALLOW, matchedRuleId: null, reason: 'r', overridden: false });
    }
    expect(ledger.getRecent(3)).toHaveLength(3);
  });

  it('should compute stats', () => {
    ledger.log({ intent: makeIntent({ module: 'fs' }), riskAssessment: makeRisk({ riskLevel: RiskLevel.LOW }), decision: PolicyDecision.ALLOW, matchedRuleId: null, reason: 'r', overridden: false });
    ledger.log({ intent: makeIntent({ module: 'fs' }), riskAssessment: makeRisk({ riskLevel: RiskLevel.HIGH }), decision: PolicyDecision.BLOCK, matchedRuleId: 'POL-001', reason: 'r', overridden: false });
    ledger.log({ intent: makeIntent({ module: 'db' }), riskAssessment: makeRisk({ riskLevel: RiskLevel.CRITICAL }), decision: PolicyDecision.REQUIRE_APPROVAL, matchedRuleId: 'POL-002', reason: 'r', overridden: true });

    const stats = ledger.getStats();
    expect(stats.total).toBe(3);
    expect(stats.allowed).toBe(1);
    expect(stats.blocked).toBe(1);
    expect(stats.requireApproval).toBe(1);
    expect(stats.overridden).toBe(1);
    expect(stats.byModule['fs']).toBe(2);
    expect(stats.byModule['db']).toBe(1);
  });

  it('should reset', () => {
    ledger.log({ intent: makeIntent(), riskAssessment: makeRisk(), decision: PolicyDecision.ALLOW, matchedRuleId: null, reason: 'r', overridden: false });
    ledger.reset();
    expect(ledger.count()).toBe(0);
  });
});
