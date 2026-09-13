import type { SkillRegistry } from '@agi-os/skills';
import type { ProviderBroker } from '@agi-os/providers';
import type { BrainContext, BrainDecision, BrainObservation } from './types.js';
import { PromptEngine } from './PromptEngine.js';
import { ToolRouter } from './ToolRouter.js';
import { generateId } from '@agi-os/kernel';

export class AgentBrain {
  private promptEngine: PromptEngine;
  private toolRouter: ToolRouter;
  private provider: ProviderBroker;
  private registry: SkillRegistry;

  constructor(deps: {
    provider: ProviderBroker;
    registry: SkillRegistry;
  }) {
    this.provider = deps.provider;
    this.registry = deps.registry;
    this.promptEngine = new PromptEngine();
    this.toolRouter = new ToolRouter();
  }

  async decide(context: BrainContext): Promise<BrainDecision> {
    const availableSkills = this.registry.getEnabledSkills();
    const systemPrompt = this.promptEngine.buildSystemPrompt(availableSkills);
    const taskPrompt = this.promptEngine.buildTaskPrompt(context);

    const response = await this.provider.complete({
      id: `brain-${context.missionId}-${context.taskId}`,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: taskPrompt },
      ],
      maxTokens: 1024,
    });

    const decision = this.toolRouter.parseResponse(response.content);

    if (!this.toolRouter.validateDecision(decision, availableSkills.map(s => s.contract.id))) {
      return { action: 'fail', reasoning: 'Invalid skill selection', confidence: 0 };
    }

    return decision;
  }

  async observe(decision: BrainDecision, result: unknown): Promise<BrainObservation> {
    return {
      skillId: decision.skillId ?? 'unknown',
      output: result,
      success: true,
      evidenceId: generateId(),
    };
  }
}
