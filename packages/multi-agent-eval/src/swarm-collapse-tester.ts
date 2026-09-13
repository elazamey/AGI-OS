export class SwarmCollapseTester {
  simulateFailure(
    failedAgents: string[],
    allAgents: string[]
  ): { healthy: string[]; failed: string[]; needsReallocation: boolean } {
    const healthy = allAgents.filter((a) => !failedAgents.includes(a));
    return {
      healthy,
      failed: failedAgents,
      needsReallocation: failedAgents.length > 0,
    };
  }

  detectDeadlock(
    agentStates: Record<string, string>
  ): { deadlocked: boolean; stuckAgents: string[] } {
    const waitingStates = ["waiting", "blocked", "pending"];
    const stuckAgents = Object.entries(agentStates)
      .filter(([_, state]) => waitingStates.includes(state))
      .map(([id]) => id);

    return {
      deadlocked: stuckAgents.length > 1 && stuckAgents.length === Object.keys(agentStates).length,
      stuckAgents,
    };
  }

  recover(
    supervisorId: string,
    failedAgents: string[],
    tasks: string[]
  ): { redistributed: boolean; coverage: number } {
    if (failedAgents.length === 0) {
      return { redistributed: false, coverage: 1 };
    }

    const redistributed = tasks.length > 0 && supervisorId !== "";
    const coverage = redistributed ? Math.min(1, tasks.length / (tasks.length + failedAgents.length)) : 0;

    return { redistributed, coverage };
  }
}
