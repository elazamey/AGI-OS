// ============================================================================
// AGI OS — governance vocabulary + fail-closed regression suite
// ----------------------------------------------------------------------------
// These reproduce the exact defects from the production-readiness review:
//
//   * policies test `module === 'fs'` but the executor sent `contract.category`
//     ('filesystem'), so NO filesystem policy ever fired and reading
//     /etc/passwd through a "governed" skill returned ALLOW with no rule id;
//   * "no policy matched" meant ALLOW, for writes and executions included;
//   * `allowedScopes` was declared on every contract and checked nowhere;
//   * `PathGuard.isWithinScope` was fail-open on an empty list and matched by
//     raw prefix, so /sandbox-evil counted as inside /sandbox.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { GovernanceGateway } from '../src/governance-core.js';
import { PolicyEngine, FAIL_CLOSED_RULE_ID } from '../src/policy.js';
import { RiskEvaluator } from '../src/risk.js';
import { RiskLevel, PolicyDecision } from '../src/types.js';
import {
  normalizeModule,
  normalizeOperation,
  isMutatingOperation,
  GOVERNANCE_MODULES,
} from '../src/vocabulary.js';
import type { ActionIntent } from '../src/types.js';

const intent = (over: Partial<ActionIntent>): ActionIntent => ({
  id: 'regression',
  module: 'fs',
  operation: 'read',
  target: './notes.txt',
  ...over,
});

describe('governance vocabulary', () => {
  it('maps every known caller spelling onto the canonical module names', () => {
    // The exact value the skill executor used to send:
    expect(normalizeModule('filesystem')).toBe('fs');
    expect(normalizeModule('terminal')).toBe('exec');
    expect(normalizeModule('shell')).toBe('exec');
    expect(normalizeModule('github')).toBe('git');
    expect(normalizeModule('connector')).toBe('network');
    expect(normalizeModule('database')).toBe('db');
    expect(normalizeModule('secrets')).toBe('env');
    // already canonical values are untouched
    for (const m of GOVERNANCE_MODULES) expect(normalizeModule(m)).toBe(m);
    // dotted skill identifiers contribute their head segment
    expect(normalizeModule('filesystem.read')).toBe('fs');
  });

  it('never passes an unrecognised module through as if it matched', () => {
    expect(normalizeModule('totally-invented')).toBe('unknown');
    expect(normalizeModule(undefined)).toBe('unknown');
    expect(normalizeModule('')).toBe('unknown');
  });

  it('reduces dotted skill ids to a canonical verb', () => {
    expect(normalizeOperation('filesystem.read')).toBe('read');
    expect(normalizeOperation('filesystem.write')).toBe('write');
    expect(normalizeOperation('fs.execute')).toBe('execute');
    expect(normalizeOperation('READ')).toBe('read');
    expect(normalizeOperation('force-push')).toBe('force-push');
  });

  it('treats unrecognised verbs as mutating (fail closed on ambiguity)', () => {
    expect(isMutatingOperation('read')).toBe(false);
    expect(isMutatingOperation('list')).toBe(false);
    expect(isMutatingOperation('write')).toBe(true);
    expect(isMutatingOperation('delete')).toBe(true);
    expect(isMutatingOperation('frobnicate')).toBe(true);
  });
});

describe('the original /etc/passwd bypass is closed', () => {
  it('blocks a sensitive read even when the caller says module="filesystem"', () => {
    const gov = new GovernanceGateway();
    // This is precisely what SkillRunner used to emit.
    const result = gov.intercept(
      intent({ module: 'filesystem', operation: 'filesystem.read', target: '/etc/passwd' })
    );

    expect(result.decision).toBe(PolicyDecision.BLOCK);
    expect(result.auditRecord.matchedRuleId).toBe('POL-001');
    expect(result.approvalRequest).toBeUndefined();
  });

  it('blocks the same read when the caller says module="fs" (unchanged behaviour)', () => {
    const gov = new GovernanceGateway();
    const result = gov.intercept(intent({ module: 'fs', operation: 'read', target: '/etc/passwd' }));
    expect(result.decision).toBe(PolicyDecision.BLOCK);
    expect(result.auditRecord.matchedRuleId).toBe('POL-001');
  });

  it('blocks .ssh and .env reads coming through the legacy spelling', () => {
    const gov = new GovernanceGateway();
    for (const target of ['/home/user/.ssh/id_rsa', '/app/.env.production']) {
      const result = gov.intercept(
        intent({ module: 'filesystem', operation: 'read', target })
      );
      expect(result.decision, target).toBe(PolicyDecision.BLOCK);
      expect(result.auditRecord.matchedRuleId, target).toBe('POL-001');
    }
  });

  it('rates a legacy-spelled filesystem write as risky as a canonical one', () => {
    const risk = new RiskEvaluator();
    const canonical = risk.evaluate(intent({ operation: 'write', target: '/opt/x.txt' }));
    const legacy = risk.evaluate(
      intent({ module: 'filesystem', operation: 'filesystem.write', target: '/opt/x.txt' })
    );
    expect(legacy.riskScore).toBe(canonical.riskScore);
    expect(legacy.riskLevel).toBe(canonical.riskLevel);
  });
});

describe('fail-closed enforcement', () => {
  it('requires approval for an unmatched mutating operation instead of allowing it', () => {
    const engine = new PolicyEngine();
    const verdict = engine.evaluateIntent(
      intent({ module: 'network', operation: 'exfiltrate', target: 'https://evil.example' })
    );
    expect(verdict.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    expect(verdict.matchedRuleId).toBe(FAIL_CLOSED_RULE_ID);
  });

  it('does not escalate read operations (POL-007 remains the read default)', () => {
    const engine = new PolicyEngine();
    for (const operation of ['read', 'list', 'get', 'query', 'inspect']) {
      const verdict = engine.evaluateIntent(
        intent({ module: 'memory', operation, target: 'vector://notes' })
      );
      expect(verdict.decision, operation).toBe(PolicyDecision.ALLOW);
    }
  });

  it('fails closed on an ambiguous verb rather than guessing it is a read', () => {
    const engine = new PolicyEngine();
    // "recall" is not a verb the constitution knows. Guessing "probably a read"
    // is how /etc/passwd got through; ambiguity requires approval instead.
    const verdict = engine.evaluateIntent(
      intent({ module: 'memory', operation: 'recall', target: 'vector://notes' })
    );
    expect(verdict.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    expect(verdict.matchedRuleId).toBe(FAIL_CLOSED_RULE_ID);
  });

  it('does not silently allow a rule whose condition throws', () => {
    const engine = new PolicyEngine();
    engine.addRule({
      id: 'POL-BAD',
      description: 'condition explodes',
      condition: () => {
        throw new Error('boom');
      },
      enforce: PolicyDecision.ALLOW,
      priority: 999,
      enabled: true,
      tags: ['test'],
    });
    const verdict = engine.evaluateIntent(intent({ module: 'fs', operation: 'write', target: 'x.txt' }));
    expect(verdict.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    expect(verdict.matchedRuleId).toContain('RULE_ERROR');
  });

  it('can be relaxed explicitly, and says so', () => {
    const permissive = new PolicyEngine({ failClosed: false });
    expect(permissive.isFailClosed()).toBe(false);
    const verdict = permissive.evaluateIntent(
      intent({ module: 'network', operation: 'exfiltrate', target: 'https://evil.example' })
    );
    expect(verdict.decision).toBe(PolicyDecision.ALLOW);
  });

  it('defaults to fail-closed', () => {
    expect(new PolicyEngine().isFailClosed()).toBe(true);
  });
});

describe('risk model is target-aware, not merely operation-aware', () => {
  it('does not escalate a write inside the workspace to HIGH', () => {
    const risk = new RiskEvaluator({ workspaceRoots: ['/workspace/mission-1'] });
    const inside = risk.evaluate(
      intent({ operation: 'write', target: '/workspace/mission-1/out.txt' })
    );
    expect(inside.factors.some((f) => f.name === 'write_outside_workspace')).toBe(false);
    expect(inside.riskLevel).not.toBe(RiskLevel.CRITICAL);
  });

  it('escalates a write outside every workspace root', () => {
    const risk = new RiskEvaluator({ workspaceRoots: ['/workspace/mission-1'] });
    const outside = risk.evaluate(
      intent({ operation: 'write', target: '/opt/other/place.txt' })
    );
    expect(outside.factors.some((f) => f.name === 'write_outside_workspace')).toBe(true);
    expect(outside.riskLevel).toBe(RiskLevel.HIGH);
    expect(outside.riskScore).toBeGreaterThan(40);
  });

  it('keeps a sensitive target at the top of the scale regardless of location', () => {
    const risk = new RiskEvaluator({ workspaceRoots: ['/workspace'] });
    const sensitive = risk.evaluate(
      intent({ operation: 'write', target: '/workspace/.env.production' })
    );
    expect(sensitive.factors.some((f) => f.name === 'sensitive_target')).toBe(true);
  });

  it('does not treat a workspace-rooted prefix as containment', () => {
    const risk = new RiskEvaluator({ workspaceRoots: ['/sandbox'] });
    // "/sandbox-evil" starts with "/sandbox" but is NOT inside it.
    const sibling = risk.evaluate(intent({ operation: 'write', target: '/sandbox-evil/x.txt' }));
    expect(sibling.factors.some((f) => f.name === 'write_outside_workspace')).toBe(true);
  });

  it('still rates execution above writes', () => {
    const risk = new RiskEvaluator();
    const write = risk.evaluate(intent({ operation: 'write', target: './a.txt' }));
    const exec = risk.evaluate(intent({ module: 'exec', operation: 'execute', target: 'ls' }));
    expect(exec.riskScore).toBeGreaterThan(write.riskScore);
  });
});

describe('sandbox execution is governed by an explicit rule, not by a default', () => {
  it('allows sandboxed execution via POL-008', () => {
    const gov = new GovernanceGateway();
    const result = gov.intercept(
      intent({ module: 'sandbox', operation: 'process', target: 'sandbox:javascript:abc123' })
    );
    expect(result.decision).toBe(PolicyDecision.ALLOW);
    expect(result.auditRecord.matchedRuleId).toBe('POL-008');
  });

  it('is stable across random sandbox ids (no substring false positives)', () => {
    const gov = new GovernanceGateway();
    // A random UUID can contain "dd", which POL-005 used to match as `dd`,
    // intermittently blocking sandbox runs.
    for (let i = 0; i < 50; i++) {
      const id = Math.random().toString(16).slice(2).padEnd(32, 'dd');
      const result = gov.intercept(
        intent({ module: 'sandbox', operation: 'process', target: `sandbox:javascript:${id}` })
      );
      expect(result.decision, id).toBe(PolicyDecision.ALLOW);
    }
  });
});
