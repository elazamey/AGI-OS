import { generateId, now } from '@agi-os/kernel';
import type { RecoveryAction } from './types.js';

export class RetryManager {
  private actions: RecoveryAction[] = [];
  private retryCounts: Map<string, number> = new Map();

  shouldRetry(stepId: string, maxRetries: number): boolean {
    const count = this.retryCounts.get(stepId) || 0;
    return count < maxRetries;
  }

  recordRetry(stepId: string, reason: string): RecoveryAction {
    const count = (this.retryCounts.get(stepId) || 0) + 1;
    this.retryCounts.set(stepId, count);
    const action: RecoveryAction = { id: generateId(), type: 'retry', stepId, reason, timestamp: now().toISOString() };
    this.actions.push(action);
    return action;
  }

  getRetryCount(stepId: string): number {
    return this.retryCounts.get(stepId) || 0;
  }

  recordSkip(stepId: string, reason: string): RecoveryAction {
    const action: RecoveryAction = { id: generateId(), type: 'skip', stepId, reason, timestamp: now().toISOString() };
    this.actions.push(action);
    return action;
  }

  recordAbort(stepId: string, reason: string): RecoveryAction {
    const action: RecoveryAction = { id: generateId(), type: 'abort', stepId, reason, timestamp: now().toISOString() };
    this.actions.push(action);
    return action;
  }

  getActions(stepId?: string): RecoveryAction[] {
    return stepId ? this.actions.filter(a => a.stepId === stepId) : [...this.actions];
  }

  clear(): void { this.actions = []; this.retryCounts.clear(); }
}
