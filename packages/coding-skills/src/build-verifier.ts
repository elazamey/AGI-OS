import type { BuildResult } from './types.js';

export class BuildVerifier {
  verify(command: string, output: string, exitCode: number): BuildResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      if (line.toLowerCase().includes('error')) errors.push(line);
      if (line.toLowerCase().includes('warning')) warnings.push(line);
    }

    return {
      success: exitCode === 0 && errors.length === 0,
      errors,
      warnings,
      duration: 0,
    };
  }
}
