import type { InfiniteLoopResult } from './types.js';

export class InfiniteLoopDetector {
  private stateHistory: string[] = [];
  private actionHistory: string[] = [];

  record(state: string, action: string): void {
    this.stateHistory.push(state);
    this.actionHistory.push(action);
  }

  detect(windowSize: number = 5): InfiniteLoopResult {
    if (this.stateHistory.length < windowSize * 2) {
      return { detected: false, repeatedStates: [], repeatedActions: [], loopCount: 0, action: 'STOP' };
    }

    const recentStates = this.stateHistory.slice(-windowSize);
    const repeatedStates: string[] = [];
    const repeatedActions: string[] = [];
    let loopCount = 0;

    for (let i = this.stateHistory.length - windowSize * 2; i >= 0; i -= windowSize) {
      const segment = this.stateHistory.slice(i, i + windowSize);
      if (JSON.stringify(segment) === JSON.stringify(recentStates)) {
        loopCount++;
        repeatedStates.push(...segment);
      }
    }

    const recentActions = this.actionHistory.slice(-windowSize);
    for (let i = this.actionHistory.length - windowSize * 2; i >= 0; i -= windowSize) {
      const segment = this.actionHistory.slice(i, i + windowSize);
      if (JSON.stringify(segment) === JSON.stringify(recentActions)) {
        repeatedActions.push(...segment);
      }
    }

    const detected = loopCount >= 2;
    let action: InfiniteLoopResult['action'] = 'STOP';
    if (loopCount >= 5) action = 'ESCALATE';
    else if (loopCount >= 3) action = 'REPLAN';

    return { detected, repeatedStates, repeatedActions, loopCount, action };
  }

  clear(): void {
    this.stateHistory = [];
    this.actionHistory = [];
  }
}
