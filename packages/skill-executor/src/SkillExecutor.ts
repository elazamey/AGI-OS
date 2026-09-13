import { SkillRunner } from './SkillRunner.js';
import type { SkillExecutionRequest, SkillExecutionResult, SkillExecutionContext } from './types.js';

export class SkillExecutor {
  constructor(private runner: SkillRunner) {}

  async execute(request: SkillExecutionRequest, context: SkillExecutionContext): Promise<SkillExecutionResult> {
    return this.runner.execute(request, context);
  }
}
