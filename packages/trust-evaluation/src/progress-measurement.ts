import type { ProgressResult } from './types.js';

export class ProgressMeasurement {
  private progressHistory: number[] = [];
  private stagnationThreshold: number = 3;

  record(progress: number): void {
    this.progressHistory.push(progress);
  }

  measure(totalSteps: number): ProgressResult {
    const stepsCompleted = this.progressHistory.length;
    const progressRate = totalSteps > 0 ? stepsCompleted / totalSteps : 0;

    let stagnationSteps = 0;
    for (let i = this.progressHistory.length - 1; i > 0; i--) {
      if (this.progressHistory[i] <= this.progressHistory[i - 1]) {
        stagnationSteps++;
      } else {
        break;
      }
    }

    const isProgressing = stagnationSteps < this.stagnationThreshold;
    const stuckDetected = stagnationSteps >= this.stagnationThreshold;

    return { stepsCompleted, totalSteps, progressRate, isProgressing, stuckDetected, stagnationSteps };
  }

  clear(): void {
    this.progressHistory = [];
  }
}
