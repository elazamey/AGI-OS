import type { PatchResult } from './types.js';

export class CodePatcher {
  applyPatch(original: string, patch: { startLine: number; endLine: number; replacement: string }[]): PatchResult {
    const lines = original.split('\n');
    let hunks = 0;

    const sorted = [...patch].sort((a, b) => b.startLine - a.startLine);
    for (const hunk of sorted) {
      const before = lines.slice(0, hunk.startLine - 1);
      const after = lines.slice(hunk.endLine);
      const replacementLines = hunk.replacement.split('\n');
      lines.splice(0, lines.length, ...before, ...replacementLines, ...after);
      hunks++;
    }

    return { file: 'patched', applied: true, hunks };
  }

  generateDiff(original: string, modified: string): string {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const diff: string[] = [];
    const maxLen = Math.max(origLines.length, modLines.length);

    for (let i = 0; i < maxLen; i++) {
      if (origLines[i] === modLines[i]) {
        diff.push(`  ${origLines[i] || ''}`);
      } else {
        if (origLines[i] !== undefined) diff.push(`- ${origLines[i]}`);
        if (modLines[i] !== undefined) diff.push(`+ ${modLines[i]}`);
      }
    }
    return diff.join('\n');
  }
}
