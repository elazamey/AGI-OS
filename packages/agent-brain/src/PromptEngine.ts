import type { SkillInstance } from '@agi-os/skills';
import type { BrainContext, BrainDecision } from './types.js';

export class PromptEngine {
  buildSystemPrompt(availableSkills: SkillInstance[]): string {
    const skillList = availableSkills
      .map(s => `- ${s.contract.id}: ${s.contract.description}`)
      .join('\n');

    return `You are an AI agent that executes tasks using available skills.

Available skills:
${skillList}

When given a task, respond with a JSON object:
{
  "action": "execute_skill" | "complete" | "fail",
  "skillId": "skill.id" (if action is execute_skill),
  "input": { ... } (if action is execute_skill),
  "reasoning": "why you chose this action",
  "confidence": 0.0-1.0
}

Rules:
- Only use available skills
- If the task is complete, use action "complete"
- If you cannot complete the task, use action "fail"
- Always explain your reasoning`;
  }

  buildTaskPrompt(context: BrainContext): string {
    const historyStr = context.history.length > 0
      ? `\nPrevious decisions:\n${context.history.map(h => `- ${h.action}: ${h.reasoning}`).join('\n')}`
      : '';

    const observationsStr = context.observations.length > 0
      ? `\nObservations:\n${context.observations.map(o => `- ${o.skillId}: ${o.success ? 'success' : 'failed'}`).join('\n')}`
      : '';

    return `Task: ${context.taskDescription}

Goal: ${context.goal}${historyStr}${observationsStr}

What should I do next?`;
  }

  parseLLMResponse(response: string): BrainDecision {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { action: 'fail', reasoning: 'No JSON found in response', confidence: 0 };
      }
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || 'fail',
        skillId: parsed.skillId,
        input: parsed.input,
        reasoning: parsed.reasoning || 'No reasoning',
        confidence: parsed.confidence || 0.5,
      };
    } catch {
      return { action: 'fail', reasoning: 'Failed to parse JSON', confidence: 0 };
    }
  }
}
