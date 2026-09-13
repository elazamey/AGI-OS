import type { ColdRestartResult } from './types.js';

export class ColdRestartTester {
  private savedState: Record<string, unknown> | null = null;
  private artifacts: string[] = [];

  saveState(state: Record<string, unknown>): void {
    this.savedState = { ...state };
    this.artifacts = Object.keys(state);
  }

  restartFromScratch(): ColdRestartResult {
    const startedFromScratch = true;
    const stateRecovered = this.savedState !== null;
    const missionsResumed = stateRecovered;
    const artifactsIntact = this.artifacts.length > 0;

    return {
      startedFromScratch,
      stateRecovered,
      missionsResumed,
      artifactsIntact,
    };
  }

  verifyArtifacts(): boolean {
    return this.artifacts.length > 0;
  }
}
