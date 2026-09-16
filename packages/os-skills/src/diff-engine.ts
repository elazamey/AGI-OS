import type { DiffResult } from './types.js';

export class DiffEngine {
  diff(oldContent: string, newContent: string, filePath: string = 'unknown'): DiffResult {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const added: string[] = [];
    const removed: string[] = [];
    let unchanged = 0;

    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];
      if (oldLine === newLine) {
        unchanged++;
      } else {
        if (oldLine !== undefined) removed.push(oldLine);
        if (newLine !== undefined) added.push(newLine);
      }
    }

    return { file: filePath, added, removed, unchanged, totalChanges: added.length + removed.length };
  }

  hasChanges(diff: DiffResult): boolean {
    return diff.totalChanges > 0;
  }

  summary(diff: DiffResult): string {
    return `+${diff.added.length} -${diff.removed.length} ~${diff.unchanged} (${diff.totalChanges} changes)`;
  }
}
