import type { ChaosResult } from './types.js';

export interface ToolFailure {
  tool: string;
  error: string;
}

export interface NetworkFailure {
  url: string;
  timeout: boolean;
}

export class ChaosEngine {
  private toolFailures: ToolFailure[] = [];
  private networkFailures: NetworkFailure[] = [];
  private failureCount = 0;

  injectToolFailures(failures: ToolFailure[]): void {
    this.toolFailures.push(...failures);
    this.failureCount += failures.length;
  }

  injectNetworkFailures(failures: NetworkFailure[]): void {
    this.networkFailures.push(...failures);
    this.failureCount += failures.length;
  }

  runMission(missionSteps: string[]): ChaosResult {
    let recovered = true;
    let dataLoss = false;
    let duplicateActions = 0;
    let injected = '';

    for (const step of missionSteps) {
      const toolFail = this.toolFailures.find(f => f.tool === step);
      if (toolFail) {
        injected += `tool:${toolFail.error};`;
        duplicateActions++;
      }

      const netFail = this.networkFailures.find(f => f.url === step);
      if (netFail) {
        injected += `network:${netFail.url};`;
        if (netFail.timeout) {
          recovered = false;
          dataLoss = true;
        } else {
          duplicateActions++;
        }
      }
    }

    return {
      scenario: `chaos-${missionSteps.length}-steps`,
      injected: injected || 'none',
      recovered,
      dataLoss,
      duplicateActions,
    };
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  clear(): void {
    this.toolFailures = [];
    this.networkFailures = [];
    this.failureCount = 0;
  }
}
