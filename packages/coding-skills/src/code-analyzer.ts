import type { CodeFile, ReviewComment } from './types.js';

export class CodeAnalyzer {
  analyzeFile(file: CodeFile): { issues: ReviewComment[]; metrics: { lines: number; complexity: number; hasTests: boolean } } {
    const lines = file.content.split('\n');
    const issues: ReviewComment[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.length > 120) {
        issues.push({ file: file.path, line: i + 1, severity: 'warning', message: 'Line exceeds 120 characters' });
      }
      if (line.includes('TODO') || line.includes('FIXME')) {
        issues.push({ file: file.path, line: i + 1, severity: 'info', message: 'TODO/FIXME found' });
      }
      if (line.includes('console.log') || line.includes('console.error')) {
        issues.push({ file: file.path, line: i + 1, severity: 'warning', message: 'Console statement in production code' });
      }
    }

    return {
      issues,
      metrics: {
        lines: lines.length,
        complexity: this.estimateComplexity(file.content),
        hasTests: file.path.includes('.test.') || file.path.includes('.spec.'),
      },
    };
  }

  searchSymbols(files: CodeFile[], query: string): Array<{ file: string; line: number; match: string }> {
    const results: Array<{ file: string; line: number; match: string }> = [];
    for (const file of files) {
      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(query)) {
          results.push({ file: file.path, line: i + 1, match: lines[i].trim() });
        }
      }
    }
    return results;
  }

  getDependencyGraph(files: CodeFile[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const file of files) {
      const imports: string[] = [];
      const importRegex = /import.*from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(file.content)) !== null) {
        imports.push(match[1]);
      }
      graph.set(file.path, imports);
    }
    return graph;
  }

  private estimateComplexity(content: string): number {
    let complexity = 1;
    const keywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'catch'];
    const operators = ['&&', '||'];
    for (const kw of keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) complexity += matches.length;
    }
    for (const op of operators) {
      const count = content.split(op).length - 1;
      complexity += count;
    }
    const ternaryCount = (content.match(/\?/g) || []).length;
    complexity += ternaryCount;
    return complexity;
  }
}
