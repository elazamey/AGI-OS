import type { BrainContext, BrainDecision, BrainObservation } from './types.js';
import type { SkillExecutor, SkillExecutionContext } from '@agi-os/skill-executor';
import type { GovernanceGateway } from '@agi-os/governance';
import type { AgentBrain } from './AgentBrain.js';
import type { MemoryBridge } from './MemoryBridge.js';

export class DecisionLoop {
  constructor(deps: {
    brain: AgentBrain;
    skillExecutor: SkillExecutor;
    memoryBridge: MemoryBridge;
    governance: GovernanceGateway;
    maxDecisions: number;
    timeoutMs: number;
  }) {
    this.brain = deps.brain;
    this.skillExecutor = deps.skillExecutor;
    this.memoryBridge = deps.memoryBridge;
    this.governance = deps.governance;
    this.maxDecisions = deps.maxDecisions;
    this.timeoutMs = deps.timeoutMs;
  }

  private brain: AgentBrain;
  private skillExecutor: SkillExecutor;
  private memoryBridge: MemoryBridge;
  private governance: GovernanceGateway;
  private maxDecisions: number;
  private timeoutMs: number;

  async run(context: BrainContext): Promise<{
    success: boolean;
    output: unknown;
    decisions: BrainDecision[];
    observations: BrainObservation[];
  }> {
    const decisions: BrainDecision[] = [];
    const observations: BrainObservation[] = [];
    const startTime = Date.now();

    for (let i = 0; i < this.maxDecisions; i++) {
      if (Date.now() - startTime > this.timeoutMs) {
        return { success: false, output: null, decisions, observations };
      }

      context.history = decisions;
      context.observations = observations;

      const decision = await this.brain.decide(context);
      decisions.push(decision);

      if (decision.action === 'complete') {
        return { success: true, output: decision.input, decisions, observations };
      }

      if (decision.action === 'fail') {
        return { success: false, output: null, decisions, observations };
      }

      if (decision.action === 'execute_skill' && decision.skillId) {
        const skillContext: SkillExecutionContext = {
          missionId: context.missionId,
          taskId: context.taskId,
          workingDir: process.cwd(),
          timeout: this.timeoutMs,
          governance: this.governance,
        };

        const result = await this.skillExecutor.execute(
          {
            missionId: context.missionId,
            taskId: context.taskId,
            skillId: decision.skillId,
            input: decision.input ?? {},
            requestedBy: 'agent-brain',
          },
          skillContext
        );

        const observation = await this.brain.observe(decision, result.output);
        observations.push(observation);
        await this.memoryBridge.recordObservation(context.missionId, observation);
      }
    }

    return { success: false, output: null, decisions, observations };
  }
}
