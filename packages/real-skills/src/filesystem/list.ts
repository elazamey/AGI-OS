import * as fs from 'node:fs/promises';
import type { SkillHandler, SkillExecutionContext } from '@agi-os/skill-executor';

export class FileSystemListSkill implements SkillHandler {
  readonly skillId = 'filesystem.list';
  readonly category = 'filesystem';

  async execute(input: Record<string, unknown>, context: SkillExecutionContext): Promise<{
    entries: Array<{ name: string; type: 'file' | 'directory'; size: number }>;
  }> {
    const dirPath = input.path as string;
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    const entries = await Promise.all(
      items.map(async (item) => {
        const fullPath = `${dirPath}/${item.name}`;
        const stat = await fs.stat(fullPath);
        return {
          name: item.name,
          type: item.isDirectory() ? 'directory' as const : 'file' as const,
          size: stat.size,
        };
      })
    );

    return { entries };
  }
}
