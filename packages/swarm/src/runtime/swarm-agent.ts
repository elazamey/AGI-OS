import { generateId, now } from '@agi-os/kernel';
import type { EventChannel } from '../event-channel.js';
import type { AgentRole, AgentMessage } from '../types.js';

// ============================================================================
// SwarmAgent — Runtime wrapper binding brain + channel into a runnable agent
// ============================================================================

export type AgentState = 'idle' | 'thinking' | 'executing' | 'completed' | 'failed';

export interface SwarmTask {
  id: string;
  goal: string;
  description: string;
  context?: Record<string, unknown>;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface SwarmAgentResult {
  agentId: string;
  taskId: string;
  success: boolean;
  output: string;
  duration: number;
  stateTransitions: AgentState[];
}

export interface BrainAdapter {
  process(input: string): Promise<string>;
}

export class SwarmAgent {
  private _state: AgentState = 'idle';
  private _stateHistory: AgentState[] = [];
  private _taskCount = 0;
  private _totalDuration = 0;

  constructor(
    public readonly id: string,
    public readonly role: AgentRole,
    public readonly name: string,
    private brain: BrainAdapter,
    private channel: EventChannel
  ) {
    this.channel.subscribe(this.id, (msg) => this.handleMessage(msg));
  }

  get state(): AgentState { return this._state; }
  get taskCount(): number { return this._taskCount; }
  get totalDuration(): number { return this._totalDuration; }
  get stateHistory(): AgentState[] { return [...this._stateHistory]; }

  private transition(newState: AgentState): void {
    this._state = newState;
    this._stateHistory.push(newState);
  }

  private handleMessage(message: AgentMessage): void {
    // Reserved for future inter-agent communication
  }

  async executeTask(task: SwarmTask): Promise<SwarmAgentResult> {
    const startTime = Date.now();
    this._taskCount++;

    this.transition('thinking');

    this.channel.send({
      id: generateId(),
      from: this.id,
      to: 'swarm-kernel',
      type: 'task_delegation',
      payload: { event: 'TASK_STARTED', task },
      requiresGovernance: false,
      timestamp: now().toISOString(),
    });

    try {
      this.transition('executing');
      const output = await this.brain.process(task.description);
      const duration = Date.now() - startTime;

      this.transition('completed');
      this._totalDuration += duration;

      this.channel.send({
        id: generateId(),
        from: this.id,
        to: 'swarm-kernel',
        type: 'result',
        payload: { event: 'TASK_COMPLETED', output, duration },
        requiresGovernance: false,
        timestamp: now().toISOString(),
      });

      return {
        agentId: this.id,
        taskId: task.id,
        success: true,
        output,
        duration,
        stateTransitions: [...this._stateHistory],
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.transition('failed');
      this._totalDuration += duration;

      const errorMsg = error instanceof Error ? error.message : String(error);

      this.channel.send({
        id: generateId(),
        from: this.id,
        to: 'swarm-kernel',
        type: 'alert',
        payload: { event: 'TASK_FAILED', error: errorMsg },
        requiresGovernance: true,
        timestamp: now().toISOString(),
      });

      return {
        agentId: this.id,
        taskId: task.id,
        success: false,
        output: errorMsg,
        duration,
        stateTransitions: [...this._stateHistory],
      };
    }
  }

  reset(): void {
    this._state = 'idle';
    this._stateHistory = [];
  }

  getStats(): { taskCount: number; totalDuration: number; avgDuration: number } {
    return {
      taskCount: this._taskCount,
      totalDuration: this._totalDuration,
      avgDuration: this._taskCount > 0 ? this._totalDuration / this._taskCount : 0,
    };
  }
}
