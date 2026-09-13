import type { ConflictResult } from "./types.js";

export class ConflictDetector {
  detectConflicts(
    actions: { agentId: string; target: string; action: string }[]
  ): ConflictResult[] {
    const conflicts: ConflictResult[] = [];
    const grouped: Record<string, { agentId: string; action: string }[]> = {};

    for (const a of actions) {
      const key = a.target;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({ agentId: a.agentId, action: a.action });
    }

    for (const [target, group] of Object.entries(grouped)) {
      if (group.length > 1) {
        const agentIds = group.map((g) => g.agentId);
        const uniqueAgents = [...new Set(agentIds)];
        if (uniqueAgents.length > 1) {
          conflicts.push({
            agents: uniqueAgents,
            target,
            action: group[0].action,
            severity: group.length > 2 ? "high" : "medium",
          });
        }
      }
    }

    return conflicts;
  }

  detectFileConflicts(
    actions: { agentId: string; file: string; operation: string }[]
  ): { conflicts: string[]; resolutionNeeded: boolean } {
    const conflicts: string[] = [];
    const fileOps: Record<string, { agentId: string; operation: string }[]> = {};

    for (const a of actions) {
      if (!fileOps[a.file]) fileOps[a.file] = [];
      fileOps[a.file].push({ agentId: a.agentId, operation: a.operation });
    }

    for (const [file, ops] of Object.entries(fileOps)) {
      const uniqueAgents = [...new Set(ops.map((o) => o.agentId))];
      const hasWrite = ops.some((o) => o.operation === "write" || o.operation === "delete");

      if (uniqueAgents.length > 1 && hasWrite) {
        conflicts.push(file);
      }
    }

    return { conflicts, resolutionNeeded: conflicts.length > 0 };
  }
}
