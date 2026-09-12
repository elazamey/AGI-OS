import { describe, it, expect, beforeEach } from 'vitest';
import {
  matchesScope,
  validateToolDefinition,
  validateCapability,
  validatePolicy
} from '../src/types.js';
import type { CapabilityScope, ToolDefinition, Capability, Policy } from '../src/types.js';

describe('Types', () => {
  describe('matchesScope', () => {
    it('should match exact scope', () => {
      const scope: CapabilityScope = {
        type: 'exact',
        pattern: '/workspace/file.txt',
        description: 'Exact file'
      };

      expect(matchesScope(scope, '/workspace/file.txt')).toBe(true);
      expect(matchesScope(scope, '/workspace/other.txt')).toBe(false);
    });

    it('should match prefix scope', () => {
      const scope: CapabilityScope = {
        type: 'prefix',
        pattern: '/workspace',
        description: 'Workspace directory'
      };

      expect(matchesScope(scope, '/workspace/file.txt')).toBe(true);
      expect(matchesScope(scope, '/workspace/subdir/file.txt')).toBe(true);
      expect(matchesScope(scope, '/other/file.txt')).toBe(false);
    });

    it('should match glob scope', () => {
      const scope: CapabilityScope = {
        type: 'glob',
        pattern: '/workspace/*.txt',
        description: 'Text files in workspace'
      };

      expect(matchesScope(scope, '/workspace/file.txt')).toBe(true);
      expect(matchesScope(scope, '/workspace/subdir/file.txt')).toBe(false);
    });

    it('should match regex scope', () => {
      const scope: CapabilityScope = {
        type: 'regex',
        pattern: '/workspace/.*\\.txt',
        description: 'Text files'
      };

      expect(matchesScope(scope, '/workspace/file.txt')).toBe(true);
      expect(matchesScope(scope, '/workspace/file.js')).toBe(false);
    });

    it('should match all scope', () => {
      const scope: CapabilityScope = {
        type: 'all',
        pattern: '*',
        description: 'All'
      };

      expect(matchesScope(scope, 'anything')).toBe(true);
    });
  });

  describe('validateToolDefinition', () => {
    it('should validate correct tool definition', () => {
      const tool: ToolDefinition = {
        id: 'test.tool',
        name: 'Test Tool',
        version: '1.0.0',
        description: 'A test tool',
        category: 'filesystem',
        capability: 'test.capability',
        inputSchema: {},
        outputSchema: {},
        risk: 'low',
        sideEffects: false,
        requiresApproval: false,
        tags: [],
        metadata: {}
      };

      expect(validateToolDefinition(tool)).toBe(true);
    });

    it('should reject invalid tool definition', () => {
      expect(validateToolDefinition(null)).toBe(false);
      expect(validateToolDefinition({})).toBe(false);
      expect(validateToolDefinition({ id: '123' })).toBe(false);
    });
  });

  describe('validateCapability', () => {
    it('should validate correct capability', () => {
      const cap: Capability = {
        id: 'test.cap',
        name: 'Test Capability',
        description: 'A test capability',
        toolId: 'test.tool',
        scope: {
          type: 'prefix',
          pattern: '/workspace',
          description: 'Workspace'
        },
        risk: 'low',
        requiresApproval: false,
        enabled: true,
        metadata: {}
      };

      expect(validateCapability(cap)).toBe(true);
    });

    it('should reject invalid capability', () => {
      expect(validateCapability(null)).toBe(false);
      expect(validateCapability({})).toBe(false);
    });
  });

  describe('validatePolicy', () => {
    it('should validate correct policy', () => {
      const policy: Policy = {
        id: 'test.policy',
        name: 'Test Policy',
        description: 'A test policy',
        priority: 100,
        enabled: true,
        rules: [],
        metadata: {}
      };

      expect(validatePolicy(policy)).toBe(true);
    });

    it('should reject invalid policy', () => {
      expect(validatePolicy(null)).toBe(false);
      expect(validatePolicy({})).toBe(false);
    });
  });
});
