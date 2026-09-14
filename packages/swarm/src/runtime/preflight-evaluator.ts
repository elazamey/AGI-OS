import { ConflictDetector } from '@agi-os/multi-agent-eval';
import { CoordinationEvaluator } from '@agi-os/multi-agent-eval';
import { SwarmAgent } from '../runtime/swarm-agent.js';
import type { SwarmTask } from '../runtime/swarm-agent.js';
import type { DecomposedTask } from '../swarm-kernel.js';

// ============================================================================
// PreflightEvaluator — Pre-flight safety interception before task dispatch
// ============================================================================

export interface PreflightResult {
  passed: boolean;
  checks: CheckResult[];
  riskScore: number;
  blockingReason?: string;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

export interface PreflightConfig {
  maxRiskScore: number;
  requireCapabilityMatch: boolean;
  detectConflicts: boolean;
  detectRaceConditions: boolean;
}

const DEFAULT_CONFIG: PreflightConfig = {
  maxRiskScore: 0.7,
  requireCapabilityMatch: true,
  detectConflicts: true,
  detectRaceConditions: true,
};

export class PreflightEvaluator {
  private conflictDetector: ConflictDetector;
  private coordinationEvaluator: CoordinationEvaluator;
  private config: PreflightConfig;
  private recentActions: { agentId: string; target: string; action: string }[] = [];

  constructor(config?: Partial<PreflightConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.conflictDetector = new ConflictDetector();
    this.coordinationEvaluator = new CoordinationEvaluator();
  }

  recordAction(agentId: string, target: string, action: string): void {
    this.recentActions.push({ agentId, target, action });
    // Keep last 100 actions
    if (this.recentActions.length > 100) {
      this.recentActions = this.recentActions.slice(-100);
    }
  }

  clearActions(): void {
    this.recentActions = [];
  }

  evaluate(
    task: SwarmTask | DecomposedTask,
    agents: SwarmAgent[],
    assignedAgentId: string
  ): PreflightResult {
    const checks: CheckResult[] = [];
    let riskScore = 0;

    // Check 1: Agent exists
    const agentExists = agents.some(a => a.id === assignedAgentId);
    checks.push({
      name: 'agent_exists',
      passed: agentExists,
      details: agentExists
        ? `Agent ${assignedAgentId} found in registry`
        : `Agent ${assignedAgentId} not found in registry`,
    });
    if (!agentExists) riskScore += 0.4;

    // Check 2: Capability match
    if (this.config.requireCapabilityMatch) {
      const agent = agents.find(a => a.id === assignedAgentId);
      const taskGoal = 'goal' in task ? task.goal : task.description;
      const hasCapability = agent !== undefined && this.matchesCapability(agent, taskGoal);
      checks.push({
        name: 'capability_match',
        passed: hasCapability,
        details: hasCapability
          ? `Agent ${assignedAgentId} has required capability`
          : `Agent ${assignedAgentId} may lack capability for: ${taskGoal}`,
      });
      if (!hasCapability) riskScore += 0.2;
    }

    // Check 3: Resource conflict detection
    if (this.config.detectConflicts) {
      const taskTarget = 'goal' in task ? task.goal : (task as SwarmTask).description;
      const conflicting = this.conflictDetector.detectConflicts([
        ...this.recentActions,
        { agentId: assignedAgentId, target: taskTarget, action: 'execute' },
      ]);
      const noConflicts = conflicting.length === 0;
      checks.push({
        name: 'no_resource_conflicts',
        passed: noConflicts,
        details: noConflicts
          ? 'No resource conflicts detected'
          : `${conflicting.length} conflict(s) detected: ${conflicting.map(c => c.target).join(', ')}`,
      });
      if (!noConflicts) riskScore += 0.3;
    }

    // Check 4: Task complexity risk
    const taskGoal = 'goal' in task ? task.goal : (task as SwarmTask).description;
    const complexity = this.assessComplexity(taskGoal);
    checks.push({
      name: 'complexity_assessment',
      passed: complexity <= this.config.maxRiskScore,
      details: `Complexity score: ${complexity.toFixed(2)} (threshold: ${this.config.maxRiskScore})`,
    });
    if (complexity > this.config.maxRiskScore) riskScore += 0.2;

    // Check 5: Concurrent task safety
    if (this.config.detectRaceConditions) {
      const safe = this.checkConcurrentSafety(assignedAgentId);
      checks.push({
        name: 'concurrent_safety',
        passed: safe,
        details: safe
          ? 'No concurrent task race conditions'
          : `Agent ${assignedAgentId} may have concurrent task conflicts`,
      });
      if (!safe) riskScore += 0.15;
    }

    const passed = checks.every(c => c.passed) && riskScore <= this.config.maxRiskScore;
    const blockingCheck = checks.find(c => !c.passed);

    return {
      passed,
      checks,
      riskScore: Math.min(riskScore, 1.0),
      blockingReason: blockingCheck
        ? `Check '${blockingCheck.name}' failed: ${blockingCheck.details}`
        : undefined,
    };
  }

  private matchesCapability(agent: SwarmAgent, taskGoal: string): boolean {
    const lower = taskGoal.toLowerCase();
    const roleMap: Record<string, string[]> = {
      researcher: ['research', 'analyze', 'investigate', 'study', 'review'],
      coder: ['build', 'create', 'implement', 'code', 'develop', 'write'],
      auditor: ['audit', 'verify', 'review', 'check', 'validate', 'test'],
      planner: ['plan', 'design', 'architect', 'organize'],
    };
    const keywords = roleMap[agent.role] || [];
    return keywords.some(kw => lower.includes(kw)) || agent.role === 'custom';
  }

  private assessComplexity(taskGoal: string): number {
    let score = 0.1;
    const lower = taskGoal.toLowerCase();
    if (lower.includes('multi') || lower.includes('complex')) score += 0.2;
    if (lower.includes('security') || lower.includes('critical')) score += 0.3;
    if (lower.includes('deploy') || lower.includes('production')) score += 0.15;
    if (lower.includes('data') || lower.includes('database')) score += 0.1;
    if (taskGoal.length > 100) score += 0.1;
    return Math.min(score, 1.0);
  }

  private checkConcurrentSafety(agentId: string): boolean {
    // Simple heuristic: if agent has >2 recent actions pending, risk increases
    const pendingCount = this.recentActions.filter(a => a.agentId === agentId).length;
    return pendingCount <= 2;
  }

  getRecentActions(): { agentId: string; target: string; action: string }[] {
    return [...this.recentActions];
  }
}
