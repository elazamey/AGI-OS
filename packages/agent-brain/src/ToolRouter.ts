import type { BrainDecision } from './types.js';
import { PromptEngine } from './PromptEngine.js';

export class ToolRouter {
  private engine = new PromptEngine();

  parseResponse(llmOutput: string): BrainDecision {
    return this.engine.parseLLMResponse(llmOutput);
  }

  validateDecision(decision: BrainDecision, availableSkills: string[]): boolean {
    if (decision.action === 'execute_skill') {
      if (!decision.skillId) return false;
      if (!availableSkills.includes(decision.skillId)) return false;
    }
    return true;
  }
}
