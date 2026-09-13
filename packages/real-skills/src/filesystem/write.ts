import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { SkillHandler, SkillExecutionContext } from '@agi-os/skill-executor';

export class FileSystemWriteSkill implements SkillHandler {
  readonly skillId = 'filesystem.write';
  readonly category = 'filesystem';

  async execute(input: Record<string, unknown>, context: SkillExecutionContext): Promise<{
    bytesWritten: number;
    path: string;
  }> {
    const filePath = input.path as string;
    const content = input.content as string;

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');

    return {
      bytesWritten: Buffer.byteLength(content, 'utf-8'),
      path: filePath,
    };
  }
}
