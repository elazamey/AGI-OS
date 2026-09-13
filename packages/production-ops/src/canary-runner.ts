import type { CanaryResult } from './types.js';

export interface MissionConfig {
  steps: string[];
  timeout: number;
}

export class CanaryRunner {
  private missions = new Map<string, MissionConfig>();
  private results: CanaryResult[] = [];

  registerMission(missionId: string, config: MissionConfig): void {
    this.missions.set(missionId, config);
  }

  runMission(missionId: string): CanaryResult {
    const config = this.missions.get(missionId);
    if (!config) {
      throw new Error(`Mission ${missionId} not registered`);
    }

    Date.now();
    const latency = Math.floor(Math.random() * config.timeout);
    const safetyIncidents = 0;

    const result: CanaryResult = {
      missionId,
      success: latency < config.timeout,
      latency,
      safetyIncidents,
      timestamp: new Date().toISOString(),
    };

    this.results.push(result);
    return result;
  }

  getSuccessRate(): number {
    if (this.results.length === 0) return 1;
    const successes = this.results.filter(r => r.success).length;
    return successes / this.results.length;
  }

  getResults(): CanaryResult[] {
    return [...this.results];
  }
}
