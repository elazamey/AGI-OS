import { describe, it, expect, beforeEach } from 'vitest';
import { GovernanceGateway } from '../src/governance-core.js';
import { PolicyDecision, RiskLevel } from '../src/types.js';
import type { ActionIntent } from '../src/types.js';
import { PolicyEngine, FAIL_CLOSED_RULE_ID } from '../src/policy.js';

describe('GovernanceGateway', () => {
  let gov: GovernanceGateway;

  beforeEach(() => {
    gov = new GovernanceGateway();
  });

  // ---- Core intercept pipeline -------------------------------------------
  describe('intercept', () => {
    it('should allow safe reads', () => {
      const intent: ActionIntent = { id: '1', module: 'fs', operation: 'read', target: './src/index.ts' };
      const result = gov.intercept(intent);
      expect(result.decision).toBe(PolicyDecision.ALLOW);
      expect(result.riskAssessment.riskLevel).toBe(RiskLevel.LOW);
    });

    it('should block .env access', () => {
      const intent: ActionIntent = { id: '2', module: 'fs', operation: 'read', target: './.env' };
      const result = gov.intercept(intent);
      expect(result.decision).toBe(PolicyDecision.BLOCK);
    });

    it('should block /etc/passwd access', () => {
      const intent: ActionIntent = { id: '3', module: 'fs', operation: 'read', target: '/etc/passwd' };
      expect(gov.intercept(intent).decision).toBe(PolicyDecision.BLOCK);
    });

    it('should require approval for db delete', () => {
      const intent: ActionIntent = { id: '4', module: 'db', operation: 'delete', target: 'users' };
      const result = gov.intercept(intent);
      expect(result.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
      expect(result.approvalRequest).toBeDefined();
    });

    it('should escalate CRITICAL risk to approval', () => {
      const intent: ActionIntent = { id: '5', module: 'fs', operation: 'delete', target: '/tmp/file.txt' };
      const result = gov.intercept(intent);
      expect(result.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
      expect(result.riskAssessment.riskLevel).toBe(RiskLevel.CRITICAL);
    });

    it('escalates a HIGH-risk action that no policy matched', () => {
      // Executing an arbitrary command is not covered by POL-005 (which blocks
      // only known-destructive ones), so the policy would allow it; the risk
      // model is what escalates it to REQUIRE_APPROVAL.
      const intent: ActionIntent = { id: '6', module: 'exec', operation: 'execute', target: 'node build.js --prod' };
      const result = gov.intercept(intent);
      expect(result.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
      expect(result.riskAssessment.riskLevel).toBe(RiskLevel.HIGH);
      // With fail-closed on, the unmatched-mutation default produces this
      // verdict; the pure risk-override path (policy ALLOW → escalated) is
      // covered by "flags decisions escalated by risk when fail-closed is
      // disabled" below.
      expect(result.auditRecord.matchedRuleId).toBe(FAIL_CLOSED_RULE_ID);
    });

    it('does not escalate a workspace-local file write', () => {
      const intent: ActionIntent = { id: '6b', module: 'fs', operation: 'write', target: './output.txt' };
      const result = gov.intercept(intent);
      expect(result.decision).toBe(PolicyDecision.ALLOW);
      expect(result.auditRecord.matchedRuleId).toBe('POL-009');
    });

    it('should record audit for every intercept', () => {
      gov.intercept({ id: '7', module: 'fs', operation: 'read', target: './safe.txt' });
      expect(gov.getAuditHistory()).toHaveLength(1);
    });

    it('requires approval for an unmatched filesystem write (fail closed)', () => {
      // Before fail-closed enforcement this fell through to "no policy match —
      // default allow", so an ungoverned write was permitted. It is now caught
      // by the fail-closed default rather than by a risk override.
      const intent: ActionIntent = { id: '8', module: 'fs', operation: 'write', target: '/tmp/agi-gov-probe/file.txt' };
      const result = gov.intercept(intent);
      expect(result.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
      expect(result.auditRecord.matchedRuleId).toBe(FAIL_CLOSED_RULE_ID);
    });

    it('flags decisions escalated by risk when fail-closed is disabled', () => {
      // Isolates the risk-override path: with the fail-closed default off the
      // policy says ALLOW and the RiskEvaluator is what escalates it.
      const permissive = new GovernanceGateway({ policy: new PolicyEngine({ failClosed: false }) });
      // No policy matches an ordinary exec, so the policy says ALLOW and the
      // risk score alone must escalate it.
      const intent: ActionIntent = { id: '8b', module: 'exec', operation: 'execute', target: 'node build.js --prod' };
      const result = permissive.intercept(intent);
      expect(result.auditRecord.overridden).toBe(true);
      expect(result.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    });
  });

  // ---- Approval workflow -------------------------------------------------
  describe('Approval workflow', () => {
    it('should create approval request for blocking actions', () => {
      const intent: ActionIntent = { id: 'a1', module: 'db', operation: 'delete', target: 'users' };
      const result = gov.intercept(intent);
      expect(result.approvalRequest).toBeDefined();
      expect(result.approvalRequest!.status).toBe('pending');
    });

    it('should approve pending request', () => {
      const intent: ActionIntent = { id: 'a2', module: 'db', operation: 'delete', target: 'users' };
      const result = gov.intercept(intent);
      const approved = gov.approve(result.approvalRequest!.id, 'admin');
      expect(approved).toBeDefined();
      expect(approved!.status).toBe('approved');
    });

    it('should deny pending request', () => {
      const intent: ActionIntent = { id: 'a3', module: 'db', operation: 'delete', target: 'users' };
      const result = gov.intercept(intent);
      const denied = gov.deny(result.approvalRequest!.id, 'admin');
      expect(denied).toBeDefined();
      expect(denied!.status).toBe('denied');
    });

    it('should list pending approvals', () => {
      gov.intercept({ id: 'a4', module: 'db', operation: 'delete', target: 'users' });
      gov.intercept({ id: 'a5', module: 'db', operation: 'drop', target: 'sessions' });
      expect(gov.getPendingApprovals()).toHaveLength(2);
    });
  });

  // ---- Policy overrides --------------------------------------------------
  describe('Policy overrides', () => {
    it('should block force-push regardless of risk', () => {
      const intent: ActionIntent = { id: 'o1', module: 'git', operation: 'force-push', target: 'origin main' };
      expect(gov.intercept(intent).decision).toBe(PolicyDecision.BLOCK);
    });

    it('should require approval for network requests', () => {
      const intent: ActionIntent = { id: 'o2', module: 'network', operation: 'request', target: 'https://api.example.com' };
      expect(gov.intercept(intent).decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    });

    it('should block rm -rf', () => {
      const intent: ActionIntent = { id: 'o3', module: 'exec', operation: 'execute', target: 'rm -rf /' };
      expect(gov.intercept(intent).decision).toBe(PolicyDecision.BLOCK);
    });
  });

  // ---- Dry run -----------------------------------------------------------
  describe('wouldAllow', () => {
    it('should return true for safe reads', () => {
      expect(gov.wouldAllow({ id: 'w1', module: 'fs', operation: 'read', target: './file.txt' })).toBe(true);
    });

    it('should return false for blocked actions', () => {
      expect(gov.wouldAllow({ id: 'w2', module: 'fs', operation: 'read', target: './.env' })).toBe(false);
    });

    it('should return false for high-risk actions', () => {
      expect(gov.wouldAllow({ id: 'w3', module: 'exec', operation: 'execute', target: 'node build.js' })).toBe(false);
      expect(gov.wouldAllow({ id: 'w4', module: 'fs', operation: 'write', target: '/opt/outside.txt' })).toBe(false);
    });
  });

  // ---- Audit stats -------------------------------------------------------
  describe('Audit stats', () => {
    it('should track stats', () => {
      gov.intercept({ id: 's1', module: 'fs', operation: 'read', target: './safe.txt' });
      gov.intercept({ id: 's2', module: 'fs', operation: 'read', target: './.env' });
      const stats = gov.getAuditStats();
      expect(stats.total).toBe(2);
      expect(stats.allowed).toBe(1);
      expect(stats.blocked).toBe(1);
    });
  });

  // ---- Sub-module access -------------------------------------------------
  describe('Sub-module access', () => {
    it('should expose risk evaluator', () => {
      expect(gov.getRiskEvaluator()).toBeDefined();
    });

    it('should expose policy engine', () => {
      expect(gov.getPolicyEngine()).toBeDefined();
    });

    it('should expose audit ledger', () => {
      expect(gov.getAuditLedger()).toBeDefined();
    });

    it('should expose approval manager', () => {
      expect(gov.getApprovalManager()).toBeDefined();
    });
  });

  // ---- Golden test: full governance pipeline -----------------------------
  describe('Golden: full pipeline', () => {
    it('should handle safe → BLOCK → APPROVE → audit', () => {
      // 1. Safe read → ALLOW
      const r1 = gov.intercept({ id: 'g1', module: 'fs', operation: 'read', target: './src/index.ts' });
      expect(r1.decision).toBe(PolicyDecision.ALLOW);

      // 2. .env access → BLOCK
      const r2 = gov.intercept({ id: 'g2', module: 'fs', operation: 'read', target: './.env' });
      expect(r2.decision).toBe(PolicyDecision.BLOCK);

      // 3. DB delete → REQUIRE_APPROVAL
      const r3 = gov.intercept({ id: 'g3', module: 'db', operation: 'delete', target: 'users' });
      expect(r3.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);

      // 4. Approve it
      const approved = gov.approve(r3.approvalRequest!.id, 'admin');
      expect(approved!.status).toBe('approved');

      // 5. Verify audit trail
      const stats = gov.getAuditStats();
      expect(stats.total).toBe(3);
      expect(stats.allowed).toBe(1);
      expect(stats.blocked).toBe(1);
      expect(stats.requireApproval).toBe(1);
    });
  });
});
