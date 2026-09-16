import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityTracker } from '../src/capabilities.js';

describe('CapabilityTracker', () => {
  let tracker: CapabilityTracker;

  beforeEach(() => {
    tracker = new CapabilityTracker();
  });

  // ---- Tool tracking -----------------------------------------------------
  describe('Tool tracking', () => {
    it('should record a tool use', () => {
      tracker.recordToolUse('read-file', true, 50);
      const tool = tracker.getTool('read-file');
      expect(tool).toBeDefined();
      expect(tool!.totalUses).toBe(1);
      expect(tool!.successfulUses).toBe(1);
      expect(tool!.successRate).toBe(1);
      expect(tool!.avgLatencyMs).toBe(50);
    });

    it('should record tool failure with error type', () => {
      tracker.recordToolUse('exec', false, 100, 'timeout');
      const tool = tracker.getTool('exec');
      expect(tool!.failedUses).toBe(1);
      expect(tool!.successRate).toBe(0);
      expect(tool!.errorTypes['timeout']).toBe(1);
    });

    it('should compute rolling average latency', () => {
      tracker.recordToolUse('t1', true, 100);
      tracker.recordToolUse('t1', true, 200);
      tracker.recordToolUse('t1', true, 300);
      expect(tracker.getTool('t1')!.avgLatencyMs).toBe(200);
    });

    it('should track multiple error types', () => {
      tracker.recordToolUse('t1', false, 10, 'timeout');
      tracker.recordToolUse('t1', false, 10, 'timeout');
      tracker.recordToolUse('t1', false, 10, 'not_found');
      const tool = tracker.getTool('t1')!;
      expect(tool.errorTypes['timeout']).toBe(2);
      expect(tool.errorTypes['not_found']).toBe(1);
    });

    it('should set tool metadata', () => {
      tracker.setToolMetadata('read-file', 'filesystem', 'Read file contents');
      const tool = tracker.getTool('read-file')!;
      expect(tool.category).toBe('filesystem');
      expect(tool.description).toBe('Read file contents');
    });

    it('should set metadata on existing tool', () => {
      tracker.recordToolUse('t1', true, 10);
      tracker.setToolMetadata('t1', 'exec', 'Execute command');
      expect(tracker.getTool('t1')!.category).toBe('exec');
    });

    it('should get tools by category', () => {
      tracker.recordToolUse('t1', true, 10);
      tracker.setToolMetadata('t1', 'fs', 'd');
      tracker.recordToolUse('t2', true, 10);
      tracker.setToolMetadata('t2', 'exec', 'd');
      expect(tracker.getToolsByCategory('fs')).toHaveLength(1);
    });

    it('should get top tools', () => {
      tracker.recordToolUse('good', true, 10);
      tracker.recordToolUse('bad', false, 10);
      const top = tracker.getTopTools(1);
      expect(top[0].toolId).toBe('good');
    });

    it('should get worst tools', () => {
      tracker.recordToolUse('good', true, 10);
      tracker.recordToolUse('bad', false, 10);
      const worst = tracker.getWorstTools(1);
      expect(worst[0].toolId).toBe('bad');
    });

    it('should return empty for unknown tool', () => {
      expect(tracker.getTool('nonexistent')).toBeUndefined();
    });
  });

  // ---- Provider tracking -------------------------------------------------
  describe('Provider tracking', () => {
    it('should record provider use', () => {
      tracker.recordProviderUse('ollama', true, 200, 30);
      const p = tracker.getProvider('ollama')!;
      expect(p.totalUses).toBe(1);
      expect(p.successRate).toBe(1);
      expect(p.avgLatencyMs).toBe(200);
      expect(p.avgTokensPerSecond).toBe(30);
    });

    it('should record provider failure', () => {
      tracker.recordProviderUse('gemini', false, 500, 0);
      expect(tracker.getProvider('gemini')!.failedUses).toBe(1);
    });

    it('should set provider metadata', () => {
      tracker.setProviderMetadata('ollama', { type: 'local', model: 'llama3' });
      const p = tracker.getProvider('ollama')!;
      expect(p.type).toBe('local');
      expect(p.model).toBe('llama3');
    });

    it('should increment quota', () => {
      tracker.recordProviderUse('gemini', true, 100, 50);
      tracker.setProviderMetadata('gemini', { currentQuotaLimit: 10000 });
      tracker.incrementQuota('gemini', 500);
      expect(tracker.getProvider('gemini')!.currentQuotaUsed).toBe(500);
    });

    it('should filter available providers', () => {
      tracker.recordProviderUse('a', true, 10, 10);
      tracker.setProviderMetadata('a', { currentQuotaLimit: 100 });
      tracker.incrementQuota('a', 100);
      tracker.recordProviderUse('b', true, 10, 10);
      expect(tracker.getAvailableProviders()).toHaveLength(1);
      expect(tracker.getAvailableProviders()[0].providerId).toBe('b');
    });
  });

  // ---- Aggregate ---------------------------------------------------------
  describe('Aggregate', () => {
    it('should compute overall tool success rate', () => {
      tracker.recordToolUse('t1', true, 10);
      tracker.recordToolUse('t1', true, 10);
      tracker.recordToolUse('t2', false, 10);
      expect(tracker.getOverallToolSuccessRate()).toBeCloseTo(2 / 3);
    });

    it('should return 0 for empty tools', () => {
      expect(tracker.getOverallToolSuccessRate()).toBe(0);
    });

    it('should reset', () => {
      tracker.recordToolUse('t1', true, 10);
      tracker.reset();
      expect(tracker.getTools()).toHaveLength(0);
    });
  });
});
