import { SwarmAgent } from './swarm-agent.js';
import { PreflightEvaluator, type PreflightResult } from './preflight-evaluator.js';
import { SwarmKernel, type SwarmMission, type DecomposedTask } from '../swarm-kernel.js';
import { AgentRegistry } from '../agent-registry.js';
import { EventChannel } from '../event-channel.js';
import type { AgentRole } from '../types.js';
import { generateId, now } from '@agi-os/kernel';

// ============================================================================
// SwarmRuntime — Bridges SwarmKernel with actual SwarmAgent execution
// ============================================================================

export interface RuntimeConfig {
  maxConcurrent: number;
  taskTimeoutMs: number;
  enableGovernance: boolean;
}

export interface ExecutionRecord {
  taskId: string;
  agentId: string;
  missionId: string;
  success: boolean;
  output: string;
  duration: number;
  startedAt: string;
  completedAt: string;
}

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  maxConcurrent: 5,
  taskTimeoutMs: 30000,
  enableGovernance: true,
};

export class SwarmRuntime {
  private agents: Map<string, SwarmAgent> = new Map();
  private executionHistory: ExecutionRecord[] = [];
  private activeCount = 0;
  private config: RuntimeConfig;
  private preflight: PreflightEvaluator;

  constructor(
    private kernel: SwarmKernel,
    config?: Partial<RuntimeConfig>
  ) {
    this.config = { ...DEFAULT_RUNTIME_CONFIG, ...config };
    this.preflight = new PreflightEvaluator({
      maxRiskScore: this.config.enableGovernance ? 0.7 : 1.0,
      detectConflicts: this.config.enableGovernance,
    });
  }

  registerAgent(agent: SwarmAgent): void {
    this.agents.set(agent.id, agent);
    // Register in kernel with agent's own ID
    const registry = this.kernel.getRegistry();
    registry.register({
      id: agent.id,
      role: agent.role,
      name: agent.name,
      capabilities: [],
      trustLevel: 'standard',
    });
  }

  unregisterAgent(agentId: string): boolean {
    this.agents.delete(agentId);
    return this.kernel.unregisterAgent(agentId);
  }

  getAgent(agentId: string): SwarmAgent | undefined {
    return this.agents.get(agentId);
  }

  getRegisteredAgents(): SwarmAgent[] {
    return Array.from(this.agents.values());
  }

  async executeMission(goal: string): Promise<ExecutionRecord[]> {
    const missionId = generateId();
    const mission = this.kernel.decomposeMission(missionId, goal);
    mission.status = 'executing';

    const records: ExecutionRecord[] = [];
    const allAgents = this.getRegisteredAgents();

    for (const task of mission.decomposedTasks) {
      const agent = this.findBestAgent(task);
      if (!agent) {
        records.push({
          taskId: task.id,
          agentId: 'unassigned',
          missionId,
          success: false,
          output: `No suitable agent for role: ${task.requiredRole}`,
          duration: 0,
          startedAt: now().toISOString(),
          completedAt: now().toISOString(),
        });
        continue;
      }

      // Pre-flight safety evaluation
      const preflightResult = this.preflight.evaluate(task, allAgents, agent.id);
      if (!preflightResult.passed) {
        records.push({
          taskId: task.id,
          agentId: agent.id,
          missionId,
          success: false,
          output: `Pre-flight check failed: ${preflightResult.blockingReason}`,
          duration: 0,
          startedAt: now().toISOString(),
          completedAt: now().toISOString(),
        });
        continue;
      }

      const delegation = this.kernel.assignTask(missionId, task.id, agent.id);
      if (!delegation) {
        records.push({
          taskId: task.id,
          agentId: agent.id,
          missionId,
          success: false,
          output: 'Governance blocked task assignment',
          duration: 0,
          startedAt: now().toISOString(),
          completedAt: now().toISOString(),
        });
        continue;
      }

      this.activeCount++;
      this.preflight.recordAction(agent.id, task.goal, 'execute');
      try {
        const result = await this.executeWithTimeout(agent, {
          id: task.id,
          goal: task.goal,
          description: task.goal,
          priority: task.priority,
        });

        const record: ExecutionRecord = {
          taskId: task.id,
          agentId: agent.id,
          missionId,
          success: result.success,
          output: result.output,
          duration: result.duration,
          startedAt: now().toISOString(),
          completedAt: now().toISOString(),
        };

        records.push(record);
        this.executionHistory.push(record);

        this.kernel.reportResult(delegation.id, {
          agentId: agent.id,
          success: result.success,
          outcome: result.output,
          duration: result.duration,
        });
      } finally {
        this.activeCount--;
      }
    }

    this.kernel.consolidateMission(missionId);
    return records;
  }

  private async executeWithTimeout(
    agent: SwarmAgent,
    task: { id: string; goal: string; description: string; priority?: string }
  ): Promise<{ success: boolean; output: string; duration: number }> {
    return Promise.race([
      agent.executeTask(task).then(r => ({
        success: r.success,
        output: r.output,
        duration: r.duration,
      })),
      new Promise<{ success: boolean; output: string; duration: number }>((resolve) => {
        setTimeout(() => {
          resolve({
            success: false,
            output: `Timeout after ${this.config.taskTimeoutMs}ms`,
            duration: this.config.taskTimeoutMs,
          });
        }, this.config.taskTimeoutMs);
      }),
    ]);
  }

  private findBestAgent(task: DecomposedTask): SwarmAgent | undefined {
    const candidates = Array.from(this.agents.values()).filter(
      (a) => a.role === task.requiredRole || a.role === 'custom'
    );
    // Return agent with fewest completed tasks (load balancing)
    return candidates.sort((a, b) => a.taskCount - b.taskCount)[0];
  }

  getExecutionHistory(): ExecutionRecord[] {
    return [...this.executionHistory];
  }

  getActiveCount(): number { return this.activeCount; }

  getStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgDuration: number;
    activeAgents: number;
  } {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(r => r.success).length;
    const totalDuration = this.executionHistory.reduce((sum, r) => sum + r.duration, 0);
    return {
      totalExecutions: total,
      successfulExecutions: successful,
      failedExecutions: total - successful,
      avgDuration: total > 0 ? totalDuration / total : 0,
      activeAgents: this.agents.size,
    };
  }
}
