import * as fs from 'node:fs/promises';
import type { SkillHandler, SkillExecutionContext } from '@agi-os/skill-executor';

export class FileSystemReadSkill implements SkillHandler {
  readonly skillId = 'filesystem.read';
  readonly category = 'filesystem';

  async execute(input: Record<string, unknown>, context: SkillExecutionContext): Promise<{
    content: string;
    size: number;
    lastModified: string;
  }> {
    const filePath = input.path as string;
    const stat = await fs.stat(filePath);
    const content = await fs.readFile(filePath, 'utf-8');

    return {
      content,
      size: stat.size,
      lastModified: stat.mtime.toISOString(),
    };
  }
}
