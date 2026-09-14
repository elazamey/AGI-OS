import { describe, it, expect, beforeEach } from 'vitest';
import { CostTracker } from '../src/index.js';

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it('should create tracker', () => {
    expect(tracker).toBeDefined();
  });

  it('should record token usage', () => {
    const entry = tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'planning',
      tokens: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latency_ms: 500,
    });

    expect(entry.id).toBeDefined();
    expect(entry.cost_usd).toBeGreaterThanOrEqual(0);
    expect(entry.timestamp).toBeGreaterThan(0);
  });

  it('should calculate cost correctly', () => {
    const entry = tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'planning',
      tokens: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      latency_ms: 500,
    });

    const expectedCost = (1000 * 0.00059) + (500 * 0.00079);
    expect(entry.cost_usd).toBeCloseTo(expectedCost, 4);
  });

  it('should handle free models', () => {
    const entry = tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      provider: 'openrouter',
      phase: 'execution',
      tokens: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      latency_ms: 1000,
    });

    expect(entry.cost_usd).toBe(0);
  });

  it('should get mission cost', () => {
    tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'planning',
      tokens: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latency_ms: 500,
    });

    tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'execution',
      tokens: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      latency_ms: 800,
    });

    const cost = tracker.getMissionCost('mission-1');
    expect(cost.mission_id).toBe('mission-1');
    expect(cost.total_cost_usd).toBeGreaterThan(0);
    expect(cost.total_tokens.total_tokens).toBe(450);
    expect(cost.phases.planning).toBeDefined();
    expect(cost.phases.execution).toBeDefined();
  });

  it('should generate cost report', () => {
    tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'planning',
      tokens: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latency_ms: 500,
    });

    tracker.recordUsage({
      mission_id: 'mission-2',
      model: 'llama3.2:3b',
      provider: 'ollama',
      phase: 'execution',
      tokens: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      latency_ms: 200,
    });

    const report = tracker.getReport();
    expect(report.total_missions).toBe(2);
    expect(report.total_cost_usd).toBeGreaterThanOrEqual(0);
    expect(report.total_tokens.total_tokens).toBe(450);
    expect(report.cost_by_model['llama-3.3-70b-versatile']).toBeDefined();
    expect(report.cost_by_model['llama3.2:3b']).toBeDefined();
    expect(report.cost_by_provider.groq).toBeDefined();
    expect(report.cost_by_provider.ollama).toBeDefined();
  });

  it('should track cost by phase', () => {
    tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'planning',
      tokens: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latency_ms: 500,
    });

    tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'execution',
      tokens: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      latency_ms: 800,
    });

    tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'verification',
      tokens: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
      latency_ms: 300,
    });

    const report = tracker.getReport();
    expect(report.cost_by_phase.planning).toBeDefined();
    expect(report.cost_by_phase.execution).toBeDefined();
    expect(report.cost_by_phase.verification).toBeDefined();
  });

  it('should calculate efficiency score', () => {
    tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'planning',
      tokens: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latency_ms: 500,
    });

    tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'execution',
      tokens: { prompt_tokens: 500, completion_tokens: 250, total_tokens: 750 },
      latency_ms: 1000,
    });

    const report = tracker.getReport();
    expect(report.efficiency_score).toBeGreaterThan(0);
    expect(report.efficiency_score).toBeLessThanOrEqual(1);
  });

  it('should set custom model pricing', () => {
    tracker.setModelPricing('custom-model', 0.001, 0.002);

    const entry = tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'custom-model',
      provider: 'custom',
      phase: 'execution',
      tokens: { prompt_tokens: 100, completion_tokens: 100, total_tokens: 200 },
      latency_ms: 500,
    });

    const expectedCost = (100 * 0.001) + (100 * 0.002);
    expect(entry.cost_usd).toBeCloseTo(expectedCost, 4);
  });

  it('should get entries', () => {
    tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'planning',
      tokens: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latency_ms: 500,
    });

    expect(tracker.getEntries().length).toBe(1);
  });

  it('should clear entries', () => {
    tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'planning',
      tokens: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latency_ms: 500,
    });

    tracker.clear();
    expect(tracker.getEntries().length).toBe(0);
  });

  it('should calculate average cost per mission', () => {
    tracker.recordUsage({
      mission_id: 'mission-1',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'planning',
      tokens: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      latency_ms: 500,
    });

    tracker.recordUsage({
      mission_id: 'mission-2',
      model: 'llama-3.3-70b-versatile',
      provider: 'groq',
      phase: 'planning',
      tokens: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      latency_ms: 600,
    });

    const report = tracker.getReport();
    expect(report.avg_cost_per_mission).toBeGreaterThan(0);
  });
});
