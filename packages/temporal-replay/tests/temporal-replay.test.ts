import { describe, it, expect, beforeEach } from 'vitest';
import { TemporalReplayEngine } from '../src/index.js';

describe('TemporalReplayEngine', () => {
  let engine: TemporalReplayEngine;

  beforeEach(() => {
    engine = new TemporalReplayEngine({ bottleneckThresholdMs: 100 });
  });

  it('should create engine', () => {
    expect(engine).toBeDefined();
  });

  it('should start session', () => {
    const session = engine.startSession('mission-1');
    expect(session.id).toBeDefined();
    expect(session.mission_id).toBe('mission-1');
    expect(session.status).toBe('recording');
    expect(session.steps.length).toBe(0);
  });

  it('should record steps', () => {
    const session = engine.startSession('mission-1');
    const step = engine.recordStep(session.id, {
      phase: 'planner',
      action: 'analyze',
      input: { task: 'test' },
      output: { plan: 'step1' },
      duration_ms: 50,
    });

    expect(step).not.toBeNull();
    expect(step!.id).toBeDefined();
    expect(step!.phase).toBe('planner');
  });

  it('should pause and resume session', () => {
    const session = engine.startSession('mission-1');
    expect(engine.pauseSession(session.id)).toBe(true);
    expect(engine.getSession(session.id)!.status).toBe('paused');

    expect(engine.resumeSession(session.id)).toBe(true);
    expect(engine.getSession(session.id)!.status).toBe('recording');
  });

  it('should complete session', () => {
    const session = engine.startSession('mission-1');
    expect(engine.completeSession(session.id)).toBe(true);
    expect(engine.getSession(session.id)!.status).toBe('completed');
    expect(engine.getSession(session.id)!.completed_at).toBeDefined();
  });

  it('should not record on paused session', () => {
    const session = engine.startSession('mission-1');
    engine.pauseSession(session.id);
    const step = engine.recordStep(session.id, {
      phase: 'test', action: 'test', input: {}, output: {}, duration_ms: 10,
    });
    expect(step).toBeNull();
  });

  it('should analyze session', () => {
    const session = engine.startSession('mission-1');
    engine.recordStep(session.id, { phase: 'planner', action: 'a1', input: {}, output: {}, duration_ms: 50 });
    engine.recordStep(session.id, { phase: 'execution', action: 'a2', input: {}, output: {}, duration_ms: 150 });
    engine.recordStep(session.id, {
      phase: 'policy', action: 'a3', input: {}, output: {},
      policy_decision: { risk_level: 'CRITICAL', requires_approval: true },
      duration_ms: 30,
    });

    const analysis = engine.analyzeSession(session.id);
    expect(analysis).not.toBeNull();
    expect(analysis!.total_steps).toBe(3);
    expect(analysis!.phase_breakdown['planner'].count).toBe(1);
    expect(analysis!.phase_breakdown['execution'].count).toBe(1);
    expect(analysis!.policy_violations.length).toBe(1);
  });

  it('should detect bottlenecks', () => {
    const session = engine.startSession('mission-1');
    engine.recordStep(session.id, { phase: 'fast', action: 'a1', input: {}, output: {}, duration_ms: 10 });
    engine.recordStep(session.id, { phase: 'slow', action: 'a2', input: {}, output: {}, duration_ms: 200 });

    const analysis = engine.analyzeSession(session.id);
    expect(analysis!.bottlenecks.length).toBe(1);
    expect(analysis!.bottlenecks[0].phase).toBe('slow');
  });

  it('should get step by index', () => {
    const session = engine.startSession('mission-1');
    engine.recordStep(session.id, { phase: 'p1', action: 'a1', input: {}, output: {}, duration_ms: 10 });
    engine.recordStep(session.id, { phase: 'p2', action: 'a2', input: {}, output: {}, duration_ms: 10 });

    const step = engine.getStep(session.id, 1);
    expect(step).not.toBeNull();
    expect(step!.phase).toBe('p2');
  });

  it('should get steps in time range', () => {
    const session = engine.startSession('mission-1');
    engine.recordStep(session.id, { phase: 'p1', action: 'a1', input: {}, output: {}, duration_ms: 10 });
    const steps = engine.getStepsInRange(session.id, 0, Date.now() + 10000);
    expect(steps.length).toBe(1);
  });

  it('should export session', () => {
    const session = engine.startSession('mission-1');
    engine.recordStep(session.id, { phase: 'p1', action: 'a1', input: {}, output: {}, duration_ms: 10 });
    const exported = engine.exportSession(session.id);
    expect(exported).not.toBeNull();
    const parsed = JSON.parse(exported!);
    expect(parsed.steps.length).toBe(1);
  });

  it('should find slowest step', () => {
    const session = engine.startSession('mission-1');
    engine.recordStep(session.id, { phase: 'fast', action: 'a1', input: {}, output: {}, duration_ms: 10 });
    engine.recordStep(session.id, { phase: 'slow', action: 'a2', input: {}, output: {}, duration_ms: 500 });

    const analysis = engine.analyzeSession(session.id);
    expect(analysis!.slowest_step!.phase).toBe('slow');
  });

  it('should delete session', () => {
    const session = engine.startSession('mission-1');
    expect(engine.deleteSession(session.id)).toBe(true);
    expect(engine.getSession(session.id)).toBeNull();
  });

  it('should list sessions', () => {
    engine.startSession('m1');
    engine.startSession('m2');
    expect(engine.listSessions().length).toBe(2);
  });

  it('should get sessions by mission', () => {
    engine.startSession('m1');
    engine.startSession('m1');
    engine.startSession('m2');
    expect(engine.getSessionsByMission('m1').length).toBe(2);
  });
});
