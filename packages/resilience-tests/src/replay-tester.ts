import { generateId, now } from '@agi-os/kernel';
import type { ReplayResult } from './types.js';

export class ReplayTester {
  private recordings: Map<string, { input: unknown; output: unknown; fn: (input: unknown) => unknown }> = new Map();

  record(id: string, input: unknown, fn: (input: unknown) => unknown): void {
    const output = fn(input);
    this.recordings.set(id, { input, output, fn });
  }

  replay(id: string): ReplayResult | null {
    const recording = this.recordings.get(id);
    if (!recording) return null;

    const replayedOutput = recording.fn(recording.input);
    const match = JSON.stringify(recording.output) === JSON.stringify(replayedOutput);

    return {
      id,
      originalTimestamp: now().toISOString(),
      replayedTimestamp: now().toISOString(),
      input: recording.input,
      originalOutput: recording.output,
      replayedOutput,
      match,
      deterministic: match,
    };
  }

  replayAll(): ReplayResult[] {
    const results: ReplayResult[] = [];
    for (const id of this.recordings.keys()) {
      const result = this.replay(id);
      if (result) results.push(result);
    }
    return results;
  }

  getDeterminismRate(): number {
    const results = this.replayAll();
    if (results.length === 0) return 1;
    return results.filter(r => r.deterministic).length / results.length;
  }

  getRecordings(): string[] {
    return Array.from(this.recordings.keys());
  }
}
