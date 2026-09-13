import type { TOCTOUResult } from './types.js';

export class TOCTOUDetector {
  private snapshots: Map<string, { timestamp: string; state: Record<string, unknown> }> = new Map();

  recordCheck(id: string, state: Record<string, unknown>): void {
    this.snapshots.set(id, { timestamp: new Date().toISOString(), state });
  }

  detect(id: string, currentState: Record<string, unknown>): TOCTOUResult {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      return {
        checkTimestamp: '',
        useTimestamp: new Date().toISOString(),
        stateChanged: false,
        delta: [],
      };
    }

    const delta: string[] = [];
    for (const key of Object.keys(currentState)) {
      if (JSON.stringify(snapshot.state[key]) !== JSON.stringify(currentState[key])) {
        delta.push(key);
      }
    }

    return {
      checkTimestamp: snapshot.timestamp,
      useTimestamp: new Date().toISOString(),
      stateChanged: delta.length > 0,
      delta,
    };
  }

  clear(): void {
    this.snapshots.clear();
  }
}
