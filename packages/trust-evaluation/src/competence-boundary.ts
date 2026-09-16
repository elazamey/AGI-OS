import type { CompetenceResult } from './types.js';

export class CompetenceBoundary {
  private availableCapabilities: Set<string> = new Set();

  register(capability: string): void {
    this.availableCapabilities.add(capability);
  }

  registerMany(capabilities: string[]): void {
    capabilities.forEach(c => this.availableCapabilities.add(c));
  }

  evaluate(taskDescription: string, requiredCapabilities: string[]): CompetenceResult {
    const missingCapabilities = requiredCapabilities.filter(
      c => !this.availableCapabilities.has(c)
    );
    const canHandle = missingCapabilities.length === 0;

    let recommendation: CompetenceResult['recommendation'];
    if (canHandle) recommendation = 'EXECUTE';
    else if (missingCapabilities.length < requiredCapabilities.length) recommendation = 'FALLBACK';
    else if (requiredCapabilities.length === 0) recommendation = 'EXECUTE';
    else recommendation = 'ABSTAIN';

    return { taskDescription, canHandle, requiredCapabilities, missingCapabilities, recommendation };
  }

  getCapabilities(): string[] {
    return Array.from(this.availableCapabilities);
  }

  clear(): void {
    this.availableCapabilities.clear();
  }
}
