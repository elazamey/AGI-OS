import { generateId, now } from '@agi-os/kernel';
import type { TestResult } from './types.js';

export class TestRunner {
  private results: TestResult[] = [];

  runTest(testFile: string, testCases: Array<{ name: string; passed: boolean; error?: string }>): TestResult {
    const failures = testCases.filter(t => !t.passed).map(t => t.error || t.name);
    const result: TestResult = {
      file: testFile,
      passed: failures.length === 0,
      tests: testCases.length,
      failures,
      duration: 0,
    };
    this.results.push(result);
    return result;
  }

  generateTestStub(codeFile: string, functions: string[]): string {
    const imports = `import { describe, it, expect } from 'vitest';\nimport { ${functions.join(', ')} } from '${codeFile}';\n\n`;
    const tests = functions.map(fn => `describe('${fn}', () => {\n  it('should work', () => {\n    expect(${fn}).toBeDefined();\n  });\n});\n`).join('\n');
    return imports + tests;
  }

  getResults(): TestResult[] { return [...this.results]; }
  getOverallStats(): { total: number; passed: number; failed: number } {
    const total = this.results.reduce((s, r) => s + r.tests, 0);
    const passed = this.results.reduce((s, r) => s + (r.tests - r.failures.length), 0);
    const failed = this.results.reduce((s, r) => s + r.failures.length, 0);
    return { total, passed, failed };
  }

  clear(): void { this.results = []; }
}
