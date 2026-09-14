import { generateId } from '@agi-os/kernel';
import { ParsedSkill } from './SkillParser.js';

export interface ExecutionContext {
  skill: ParsedSkill;
  input: Record<string, unknown>;
  environment: Record<string, string>;
}

export interface ExecutionResult {
  id: string;
  skillName: string;
  success: boolean;
  output: unknown;
  error?: string;
  durationMs: number;
  timestamp: number;
}

export class SkillExecutor {
  private executionHistory: ExecutionResult[] = [];

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executionId = generateId();

    try {
      const result = await this.runSkill(context);
      const execution: ExecutionResult = {
        id: executionId,
        skillName: context.skill.metadata.name,
        success: true,
        output: result,
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      };
      this.executionHistory.push(execution);
      return execution;
    } catch (error) {
      const execution: ExecutionResult = {
        id: executionId,
        skillName: context.skill.metadata.name,
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
        timestamp: Date.now(),
      };
      this.executionHistory.push(execution);
      return execution;
    }
  }

  private async runSkill(context: ExecutionContext): Promise<unknown> {
    const { skill, input } = context;

    // Simulate skill execution
    // In real implementation, this would dynamically execute the code
    return {
      status: 'success',
      skillName: skill.metadata.name,
      input,
      output: `Executed ${skill.metadata.name} successfully`,
    };
  }

  getHistory(): ExecutionResult[] {
    return [...this.executionHistory];
  }

  getHistoryBySkill(skillName: string): ExecutionResult[] {
    return this.executionHistory.filter(e => e.skillName === skillName);
  }

  getSuccessfulExecutions(): ExecutionResult[] {
    return this.executionHistory.filter(e => e.success);
  }

  getFailedExecutions(): ExecutionResult[] {
    return this.executionHistory.filter(e => !e.success);
  }

  clearHistory(): void {
    this.executionHistory = [];
  }
}
