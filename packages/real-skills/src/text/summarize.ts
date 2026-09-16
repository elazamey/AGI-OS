import type { SkillHandler, SkillExecutionContext } from '@agi-os/skill-executor';
import type { ProviderBroker } from '@agi-os/providers';

export class TextSummarizeSkill implements SkillHandler {
  readonly skillId = 'text.summarize';
  readonly category = 'core';

  constructor(private provider: ProviderBroker) {}

  async execute(input: Record<string, unknown>, context: SkillExecutionContext): Promise<{
    summary: string;
    originalLength: number;
    summaryLength: number;
  }> {
    const text = input.text as string;

    const response = await this.provider.complete({
      id: `summarize-${context.missionId}`,
      messages: [
        { role: 'system', content: 'You are a text summarizer. Summarize the following text concisely. Return ONLY the summary.' },
        { role: 'user', content: text },
      ],
      maxTokens: 512,
    });

    return {
      summary: response.content,
      originalLength: text.length,
      summaryLength: response.content.length,
    };
  }
}
