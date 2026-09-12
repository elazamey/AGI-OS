import { describe, it, expect, beforeEach } from 'vitest';
import { SelfModel } from '../src/self-model.js';
import type { SelfModelUpdateEvent } from '../src/types.js';

describe('SelfModel', () => {
  let model: SelfModel;

  beforeEach(() => {
    model = new SelfModel();
  });

  // ---- Event processing --------------------------------------------------
  describe('Event processing', () => {
    it('should process tool_succeeded event', () => {
      model.processEvent({
        type: 'tool_succeeded',
        componentId: 'read-file',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 50 },
      });
      const tools = model.getToolCapabilities();
      expect(tools).toHaveLength(1);
      expect(tools[0].toolId).toBe('read-file');
      expect(tools[0].successRate).toBe(1);
    });

    it('should process tool_failed event', () => {
      model.processEvent({
        type: 'tool_failed',
        componentId: 'exec',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 100, errorType: 'timeout', errorMessage: 'timed out' },
      });
      const tools = model.getToolCapabilities();
      expect(tools[0].failedUses).toBe(1);
      const rel = model.getReliabilityRecords();
      expect(rel[0].consecutiveFailures).toBe(1);
    });

    it('should process provider_succeeded event', () => {
      model.processEvent({
        type: 'provider_succeeded',
        componentId: 'ollama',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 200, tokensPerSecond: 30 },
      });
      expect(model.getProviderCapabilities()).toHaveLength(1);
    });

    it('should process provider_failed event', () => {
      model.processEvent({
        type: 'provider_failed',
        componentId: 'gemini',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 500 },
      });
      expect(model.getProviderCapabilities()[0].failedUses).toBe(1);
    });

    it('should process limitation_hit event', () => {
      model.processEvent({
        type: 'limitation_hit',
        componentId: 'network',
        timestamp: new Date().toISOString(),
        data: { category: 'resource', description: 'No GPU', severity: 'minor' },
      });
      expect(model.getLimitations()).toHaveLength(1);
    });

    it('should process limitation_discovered event', () => {
      model.processEvent({
        type: 'limitation_discovered',
        componentId: 'disk',
        timestamp: new Date().toISOString(),
        data: { category: 'resource', description: 'Disk full', severity: 'major' },
      });
      expect(model.getLimitations()).toHaveLength(1);
    });

    it('should process mission_completed event', () => {
      model.processEvent({
        type: 'mission_completed',
        componentId: 'm1',
        timestamp: new Date().toISOString(),
        data: { domain: 'software', confidence: 0.85 },
      });
      expect(model.getDomainConfidence()).toHaveLength(1);
      expect(model.getConfidenceScorer().getScore('software')).toBeCloseTo(0.85);
    });

    it('should process mission_failed event', () => {
      model.processEvent({
        type: 'mission_failed',
        componentId: 'm1',
        timestamp: new Date().toISOString(),
        data: { domain: 'software', confidence: 0.2 },
      });
      expect(model.getConfidenceScorer().getScore('software')).toBeCloseTo(0.2);
    });
  });

  // ---- Snapshot ----------------------------------------------------------
  describe('Snapshot', () => {
    it('should produce a full snapshot', () => {
      model.processEvent({
        type: 'tool_succeeded',
        componentId: 't1',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 10 },
      });
      model.processEvent({
        type: 'limitation_hit',
        componentId: 'l1',
        timestamp: new Date().toISOString(),
        data: { category: 'tool', description: 'limit1', severity: 'minor' },
      });
      model.processEvent({
        type: 'mission_completed',
        componentId: 'm1',
        timestamp: new Date().toISOString(),
        data: { domain: 'software', confidence: 0.9 },
      });

      const snap = model.snapshot();
      expect(snap.knownCapabilityCount).toBe(1);
      expect(snap.knownLimitationCount).toBe(1);
      expect(snap.overallHealth).toBeGreaterThanOrEqual(0);
      expect(snap.overallHealth).toBeLessThanOrEqual(1);
      expect(snap.timestamp).toBeDefined();
    });
  });

  // ---- Overall health ----------------------------------------------------
  describe('Overall health', () => {
    it('should compute health as 0 when nothing recorded', () => {
      expect(model.getOverallHealth()).toBe(0);
    });

    it('should reduce health for systemic patterns', () => {
      const pd = model.getPatternDetector();
      pd.register({
        name: 'Systemic',
        description: 'x',
        signatures: [{ field: 'errorType', operator: 'equals', value: 'e' }],
        frequency: 'systemic',
        impact: 'high',
      });
      // Health should be reduced by 0.05 per systemic pattern
      model.processEvent({
        type: 'tool_succeeded',
        componentId: 't1',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 10 },
      });
      const health = model.getOverallHealth();
      expect(health).toBeLessThan(1);
    });

    it('should reduce health for critical limitations', () => {
      model.processEvent({
        type: 'limitation_discovered',
        componentId: 'l1',
        timestamp: new Date().toISOString(),
        data: { category: 'tool', description: 'critical limit', severity: 'critical' },
      });
      model.processEvent({
        type: 'tool_succeeded',
        componentId: 't1',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 10 },
      });
      expect(model.getOverallHealth()).toBeLessThan(1);
    });
  });

  // ---- Event history -----------------------------------------------------
  describe('Event history', () => {
    it('should track all events', () => {
      model.processEvent({
        type: 'tool_succeeded',
        componentId: 't1',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 10 },
      });
      model.processEvent({
        type: 'mission_completed',
        componentId: 'm1',
        timestamp: new Date().toISOString(),
        data: { domain: 'a', confidence: 0.5 },
      });
      expect(model.getEventHistory()).toHaveLength(2);
    });
  });

  // ---- Sub-module access -------------------------------------------------
  describe('Sub-module access', () => {
    it('should expose capability tracker', () => {
      expect(model.getCapabilityTracker()).toBeDefined();
    });

    it('should expose limitation registry', () => {
      expect(model.getLimitationRegistry()).toBeDefined();
    });

    it('should expose confidence scorer', () => {
      expect(model.getConfidenceScorer()).toBeDefined();
    });

    it('should expose reliability tracker', () => {
      expect(model.getReliabilityTracker()).toBeDefined();
    });

    it('should expose pattern detector', () => {
      expect(model.getPatternDetector()).toBeDefined();
    });
  });

  // ---- Reset -------------------------------------------------------------
  describe('Reset', () => {
    it('should clear everything', () => {
      model.processEvent({
        type: 'tool_succeeded',
        componentId: 't1',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 10 },
      });
      model.reset();
      expect(model.getToolCapabilities()).toHaveLength(0);
      expect(model.getLimitations()).toHaveLength(0);
      expect(model.getEventHistory()).toHaveLength(0);
    });
  });

  // ---- Golden test: full lifecycle ----------------------------------------
  describe('Golden: full lifecycle', () => {
    it('should track tool success/failure, confidence, and produce snapshot', () => {
      // Tool succeeds
      model.processEvent({
        type: 'tool_succeeded',
        componentId: 'bash',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 200 },
      });
      // Tool fails
      model.processEvent({
        type: 'tool_failed',
        componentId: 'bash',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 500, errorType: 'timeout', errorMessage: 'command timed out' },
      });
      // Provider succeeds
      model.processEvent({
        type: 'provider_succeeded',
        componentId: 'ollama',
        timestamp: new Date().toISOString(),
        data: { latencyMs: 300, tokensPerSecond: 25 },
      });
      // Mission completes
      model.processEvent({
        type: 'mission_completed',
        componentId: 'm1',
        timestamp: new Date().toISOString(),
        data: { domain: 'software', confidence: 0.9 },
      });
      // Mission fails
      model.processEvent({
        type: 'mission_failed',
        componentId: 'm2',
        timestamp: new Date().toISOString(),
        data: { domain: 'software', confidence: 0.3 },
      });

      const snap = model.snapshot();
      expect(snap.knownCapabilityCount).toBe(2); // bash + ollama
      expect(snap.knownLimitationCount).toBe(0);
      expect(snap.knownPatternCount).toBe(0);
      expect(snap.overallHealth).toBeGreaterThan(0);
      expect(snap.overallHealth).toBeLessThanOrEqual(1);
      expect(snap.toolCapabilities).toHaveLength(1);
      expect(snap.providerCapabilities).toHaveLength(1);
      expect(snap.domainConfidence).toHaveLength(1);
    });
  });
});
