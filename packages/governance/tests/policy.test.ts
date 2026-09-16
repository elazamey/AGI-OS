import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from '../src/policy.js';
import { PolicyDecision } from '../src/types.js';
import type { ActionIntent } from '../src/types.js';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  // ---- Default policies --------------------------------------------------
  describe('Default policies', () => {
    it('should block access to .env files', () => {
      const intent: ActionIntent = { id: '1', module: 'fs', operation: 'read', target: './.env' };
      const result = engine.evaluateIntent(intent);
      expect(result.decision).toBe(PolicyDecision.BLOCK);
      expect(result.matchedRuleId).toBe('POL-001');
    });

    it('should block access to /etc/ files', () => {
      const intent: ActionIntent = { id: '2', module: 'fs', operation: 'read', target: '/etc/passwd' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.BLOCK);
    });

    it('should block access to .ssh/ files', () => {
      const intent: ActionIntent = { id: '3', module: 'fs', operation: 'read', target: '~/.ssh/id_rsa' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.BLOCK);
    });

    it('should require approval for db delete', () => {
      const intent: ActionIntent = { id: '4', module: 'db', operation: 'delete', target: 'users' };
      const result = engine.evaluateIntent(intent);
      expect(result.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
      expect(result.matchedRuleId).toBe('POL-002');
    });

    it('should require approval for db insert', () => {
      const intent: ActionIntent = { id: '5', module: 'db', operation: 'insert', target: 'users' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    });

    it('should block force-push', () => {
      const intent: ActionIntent = { id: '6', module: 'git', operation: 'force-push', target: 'origin main' };
      const result = engine.evaluateIntent(intent);
      expect(result.decision).toBe(PolicyDecision.BLOCK);
      expect(result.matchedRuleId).toBe('POL-003');
    });

    it('should block reset-hard', () => {
      const intent: ActionIntent = { id: '7', module: 'git', operation: 'reset-hard', target: 'HEAD~1' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.BLOCK);
    });

    it('should require approval for network requests', () => {
      const intent: ActionIntent = { id: '8', module: 'network', operation: 'request', target: 'https://api.example.com' };
      const result = engine.evaluateIntent(intent);
      expect(result.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
      expect(result.matchedRuleId).toBe('POL-004');
    });

    it('should block rm -rf', () => {
      const intent: ActionIntent = { id: '9', module: 'exec', operation: 'execute', target: 'rm -rf /' };
      const result = engine.evaluateIntent(intent);
      expect(result.decision).toBe(PolicyDecision.BLOCK);
      expect(result.matchedRuleId).toBe('POL-005');
    });

    it('should block writes outside workspace', () => {
      const intent: ActionIntent = { id: '10', module: 'fs', operation: 'write', target: '/usr/bin/malware' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.BLOCK);
    });

    it('should allow safe reads', () => {
      const intent: ActionIntent = { id: '11', module: 'fs', operation: 'read', target: './src/index.ts' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.ALLOW);
    });

    it('should allow list operations', () => {
      const intent: ActionIntent = { id: '12', module: 'fs', operation: 'list', target: './src' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.ALLOW);
    });
  });

  // ---- Rule management ---------------------------------------------------
  describe('Rule management', () => {
    it('should add custom rule', () => {
      engine.addRule({
        id: 'CUSTOM-001',
        description: 'Block all npm install',
        condition: (i) => i.module === 'exec' && i.target.includes('npm install'),
        enforce: PolicyDecision.BLOCK,
        priority: 200,
        enabled: true,
        tags: ['exec', 'npm'],
      });
      const intent: ActionIntent = { id: 'c1', module: 'exec', operation: 'execute', target: 'npm install express' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.BLOCK);
    });

    it('should remove rule', () => {
      expect(engine.removeRule('POL-001')).toBe(true);
      const intent: ActionIntent = { id: 'r1', module: 'fs', operation: 'read', target: './.env' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.ALLOW);
    });

    it('should disable rule', () => {
      engine.disableRule('POL-001');
      const intent: ActionIntent = { id: 'd1', module: 'fs', operation: 'read', target: './.env' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.ALLOW);
    });

    it('should enable rule', () => {
      engine.disableRule('POL-001');
      engine.enableRule('POL-001');
      const intent: ActionIntent = { id: 'e1', module: 'fs', operation: 'read', target: './.env' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.BLOCK);
    });

    it('should get rules by tag', () => {
      const rules = engine.getRulesByTag('filesystem');
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should get enabled rules only', () => {
      engine.disableRule('POL-001');
      const enabled = engine.getEnabledRules();
      expect(enabled.every((r) => r.enabled)).toBe(true);
    });

    it('should evaluate highest priority first', () => {
      engine.addRule({
        id: 'HIGH-PRIORITY',
        description: 'Override',
        condition: () => true,
        enforce: PolicyDecision.BLOCK,
        priority: 1000,
        enabled: true,
        tags: [],
      });
      const intent: ActionIntent = { id: 'p1', module: 'fs', operation: 'read', target: './safe.txt' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.BLOCK);
    });

    it('should reset to defaults', () => {
      engine.addRule({
        id: 'TEMP',
        description: 'temp',
        condition: () => true,
        enforce: PolicyDecision.BLOCK,
        priority: 999,
        enabled: true,
        tags: [],
      });
      engine.reset();
      const intent: ActionIntent = { id: 'rs1', module: 'fs', operation: 'read', target: './.env' };
      expect(engine.evaluateIntent(intent).decision).toBe(PolicyDecision.BLOCK); // default POL-001
    });
  });

  // ---- wouldAllow --------------------------------------------------------
  describe('wouldAllow', () => {
    it('should return true for safe reads', () => {
      const intent: ActionIntent = { id: 'w1', module: 'fs', operation: 'read', target: './src/index.ts' };
      expect(engine.wouldAllow(intent)).toBe(true);
    });

    it('should return false for blocked actions', () => {
      const intent: ActionIntent = { id: 'w2', module: 'fs', operation: 'read', target: './.env' };
      expect(engine.wouldAllow(intent)).toBe(false);
    });

    it('should return false for approval-required actions', () => {
      const intent: ActionIntent = { id: 'w3', module: 'db', operation: 'delete', target: 'users' };
      expect(engine.wouldAllow(intent)).toBe(false);
    });
  });
});
