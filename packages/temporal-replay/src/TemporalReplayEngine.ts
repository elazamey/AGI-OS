export interface ReplayStep {
  id: string;
  timestamp: number;
  phase: string;
  action: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  policy_decision?: { risk_level: string; requires_approval: boolean };
  duration_ms: number;
}

export interface ReplaySession {
  id: string;
  mission_id: string;
  steps: ReplayStep[];
  status: 'recording' | 'paused' | 'completed';
  started_at: number;
  completed_at?: number;
}

export interface ReplayAnalysis {
  total_steps: number;
  total_duration_ms: number;
  phase_breakdown: Record<string, { count: number; total_ms: number }>;
  slowest_step: ReplayStep | null;
  policy_violations: ReplayStep[];
  bottlenecks: { step_id: string; duration_ms: number; phase: string }[];
}

export interface ReplayConfig {
  maxSteps: number;
  recordPolicyDecisions: boolean;
  detectBottlenecks: boolean;
  bottleneckThresholdMs: number;
}

export class TemporalReplayEngine {
  private sessions: Map<string, ReplaySession> = new Map();
  private config: ReplayConfig;

  constructor(config: Partial<ReplayConfig> = {}) {
    this.config = {
      maxSteps: config.maxSteps || 1000,
      recordPolicyDecisions: config.recordPolicyDecisions ?? true,
      detectBottlenecks: config.detectBottlenecks ?? true,
      bottleneckThresholdMs: config.bottleneckThresholdMs || 5000,
    };
  }

  startSession(missionId: string): ReplaySession {
    const session: ReplaySession = {
      id: `replay-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      mission_id: missionId,
      steps: [],
      status: 'recording',
      started_at: Date.now(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  recordStep(sessionId: string, step: Omit<ReplayStep, 'id' | 'timestamp'>): ReplayStep | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'recording') return null;
    if (session.steps.length >= this.config.maxSteps) return null;

    const fullStep: ReplayStep = {
      ...step,
      id: `step-${session.steps.length + 1}`,
      timestamp: Date.now(),
    };
    session.steps.push(fullStep);
    return fullStep;
  }

  pauseSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'recording') return false;
    session.status = 'paused';
    return true;
  }

  resumeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'paused') return false;
    session.status = 'recording';
    return true;
  }

  completeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.status = 'completed';
    session.completed_at = Date.now();
    return true;
  }

  getSession(sessionId: string): ReplaySession | null {
    return this.sessions.get(sessionId) || null;
  }

  getSessionsByMission(missionId: string): ReplaySession[] {
    return Array.from(this.sessions.values()).filter(s => s.mission_id === missionId);
  }

  analyzeSession(sessionId: string): ReplayAnalysis | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const phaseBreakdown: Record<string, { count: number; total_ms: number }> = {};
    let slowestStep: ReplayStep | null = null;
    const policyViolations: ReplayStep[] = [];
    const bottlenecks: { step_id: string; duration_ms: number; phase: string }[] = [];

    for (const step of session.steps) {
      if (!phaseBreakdown[step.phase]) {
        phaseBreakdown[step.phase] = { count: 0, total_ms: 0 };
      }
      phaseBreakdown[step.phase].count++;
      phaseBreakdown[step.phase].total_ms += step.duration_ms;

      if (!slowestStep || step.duration_ms > slowestStep.duration_ms) {
        slowestStep = step;
      }

      if (step.policy_decision?.requires_approval) {
        policyViolations.push(step);
      }

      if (this.config.detectBottlenecks && step.duration_ms >= this.config.bottleneckThresholdMs) {
        bottlenecks.push({ step_id: step.id, duration_ms: step.duration_ms, phase: step.phase });
      }
    }

    return {
      total_steps: session.steps.length,
      total_duration_ms: session.steps.reduce((sum, s) => sum + s.duration_ms, 0),
      phase_breakdown: phaseBreakdown,
      slowest_step: slowestStep,
      policy_violations: policyViolations,
      bottlenecks,
    };
  }

  getStep(sessionId: string, stepIndex: number): ReplayStep | null {
    const session = this.sessions.get(sessionId);
    if (!session || stepIndex < 0 || stepIndex >= session.steps.length) return null;
    return session.steps[stepIndex];
  }

  getStepsInRange(sessionId: string, startMs: number, endMs: number): ReplayStep[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    return session.steps.filter(s => s.timestamp >= startMs && s.timestamp <= endMs);
  }

  exportSession(sessionId: string): string | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return JSON.stringify(session, null, 2);
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  listSessions(): ReplaySession[] {
    return Array.from(this.sessions.values());
  }
}
