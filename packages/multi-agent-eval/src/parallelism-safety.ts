import type { ParallelismResult } from "./types.js";

export class ParallelismSafetyTester {
  detectWriteConflicts(
    actions: { agentId: string; file: string; operation: string }[]
  ): ParallelismResult {
    const conflicts: string[] = [];
    const raceConditions: string[] = [];
    const fileOps: Record<string, { agentId: string; operation: string }[]> = {};

    for (const a of actions) {
      if (!fileOps[a.file]) fileOps[a.file] = [];
      fileOps[a.file].push({ agentId: a.agentId, operation: a.operation });
    }

    for (const [file, ops] of Object.entries(fileOps)) {
      const uniqueAgents = [...new Set(ops.map((o) => o.agentId))];
      const writeOps = ops.filter(
        (o) => o.operation === "write" || o.operation === "delete" || o.operation === "append"
      );

      if (uniqueAgents.length > 1 && writeOps.length > 0) {
        conflicts.push(file);
        if (writeOps.length > 1) {
          raceConditions.push(file);
        }
      }
    }

    return {
      conflicts,
      safe: conflicts.length === 0,
      raceConditions,
    };
  }

  detectRaceConditions(
    timelines: { agentId: string; steps: { time: number; action: string }[] }[]
  ): { races: string[]; safe: boolean } {
    const races: string[] = [];
    const actionTimes: Record<string, { agentId: string; time: number }[]> = {};

    for (const timeline of timelines) {
      for (const step of timeline.steps) {
        if (!actionTimes[step.action]) actionTimes[step.action] = [];
        actionTimes[step.action].push({ agentId: timeline.agentId, time: step.time });
      }
    }

    for (const [action, entries] of Object.entries(actionTimes)) {
      const uniqueAgents = [...new Set(entries.map((e) => e.agentId))];
      if (uniqueAgents.length > 1) {
        const times = entries.map((e) => e.time);
        const hasOverlap = Math.max(...times) - Math.min(...times) < 10;
        if (hasOverlap) {
          races.push(action);
        }
      }
    }

    return { races, safe: races.length === 0 };
  }
}
