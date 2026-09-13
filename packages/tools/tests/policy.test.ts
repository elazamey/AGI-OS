import { describe, it, expect, beforeEach } from 'vitest';
import type {
  PolicyEngine} from '../src/policy.js';
import {
  createPolicyEngine,
  READ_ONLY_POLICY,
  WRITE_REQUIRES_APPROVAL_POLICY,
  DANGEROUS_PATHS_DENY_POLICY
} from '../src/policy.js';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = createPolicyEngine();
  });

  describe('addPolicy', () => {
    it('should add a policy', () => {
      engine.addPolicy(READ_ONLY_POLICY);

      const policies = engine.getAllPolicies();
      expect(policies).toHaveLength(1);
      expect(policies[0].id).toBe('read-only');
    });

    it('should reject invalid policy', () => {
      expect(() => engine.addPolicy({} as any)).toThrow();
    });
  });

  describe('removePolicy', () => {
    it('should remove a policy', () => {
      engine.addPolicy(READ_ONLY_POLICY);
      expect(engine.removePolicy('read-only')).toBe(true);
      expect(engine.getAllPolicies()).toHaveLength(0);
    });

    it('should return false for non-existent policy', () => {
      expect(engine.removePolicy('non-existent')).toBe(false);
    });
  });

  describe('enable/disable', () => {
    it('should disable and enable policy', () => {
      engine.addPolicy(READ_ONLY_POLICY);

      engine.disablePolicy('read-only');
      expect(engine.getPolicy('read-only')!.enabled).toBe(false);

      engine.enablePolicy('read-only');
      expect(engine.getPolicy('read-only')!.enabled).toBe(true);
    });
  });

  describe('evaluate', () => {
    beforeEach(() => {
      engine.addPolicy(READ_ONLY_POLICY);
      engine.addPolicy(WRITE_REQUIRES_APPROVAL_POLICY);
      engine.addPolicy(DANGEROUS_PATHS_DENY_POLICY);
    });

    it('should allow read operations', () => {
      const decision = engine.evaluate('filesystem.read', { path: '/workspace/file.txt' });

      expect(decision.allowed).toBe(true);
      expect(decision.effect).toBe('allow');
    });

    it('should require approval for write operations', () => {
      const decision = engine.evaluate('filesystem.write', { path: '/workspace/file.txt' });

      expect(decision.allowed).toBe(false);
      expect(decision.effect).toBe('approval_required');
    });

    it('should deny dangerous paths', () => {
      const decision = engine.evaluate('filesystem.write', { path: 'C:\\Windows\\system32' });

      expect(decision.allowed).toBe(false);
      expect(decision.effect).toBe('deny');
    });

    it('should deny .env files', () => {
      const decision = engine.evaluate('filesystem.read', { path: '/workspace/.env' });

      expect(decision.allowed).toBe(false);
      expect(decision.effect).toBe('deny');
    });

    it('should deny unknown tools', () => {
      const decision = engine.evaluate('unknown.tool', {});

      expect(decision.allowed).toBe(false);
      expect(decision.effect).toBe('deny');
    });

    it('should return matched rules', () => {
      const decision = engine.evaluate('filesystem.read', { path: '/workspace/file.txt' });

      expect(decision.matchedRules.length).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should get policy stats', () => {
      engine.addPolicy(READ_ONLY_POLICY);
      engine.addPolicy(WRITE_REQUIRES_APPROVAL_POLICY);

      const policies = engine.getAllPolicies();
      expect(policies).toHaveLength(2);
    });
  });
});
