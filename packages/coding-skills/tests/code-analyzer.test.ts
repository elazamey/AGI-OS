import { describe, it, expect } from 'vitest';
import { CodeAnalyzer } from '../src/code-analyzer.js';
import type { CodeFile } from '../src/types.js';

describe('CodeAnalyzer', () => {
  const analyzer = new CodeAnalyzer();

  it('analyzes file and finds issues', () => {
    const file: CodeFile = { path: 'test.ts', content: 'const x = 1;\nconsole.log(x);\n// TODO fix this', language: 'typescript', size: 100 };
    const result = analyzer.analyzeFile(file);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.metrics.lines).toBe(3);
  });

  it('searches symbols', () => {
    const files: CodeFile[] = [{ path: 'a.ts', content: 'function hello() {}\nconst world = 1;', language: 'typescript', size: 50 }];
    const results = analyzer.searchSymbols(files, 'hello');
    expect(results.length).toBe(1);
    expect(results[0].line).toBe(1);
  });

  it('gets dependency graph', () => {
    const files: CodeFile[] = [{ path: 'a.ts', content: "import { x } from './b';", language: 'typescript', size: 30 }];
    const graph = analyzer.getDependencyGraph(files);
    expect(graph.get('a.ts')).toContain('./b');
  });

  it('estimates complexity', () => {
    const file: CodeFile = { path: 'test.ts', content: 'if (a) { for (b) { while (c) {} } }', language: 'typescript', size: 50 };
    const result = analyzer.analyzeFile(file);
    expect(result.metrics.complexity).toBeGreaterThan(1);
  });
});
