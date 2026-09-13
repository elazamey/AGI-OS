export class CoordinationEvaluator {
  assignTasks(
    agents: { id: string; capabilities: string[] }[],
    tasks: { id: string; requiredCapability: string }[]
  ): { assignments: Record<string, string[]>; duplicateWork: string[]; unassignedTasks: string[] } {
    const assignments: Record<string, string[]> = {};
    const taskAssignments: Record<string, string[]> = {};
    const unassignedTasks: string[] = [];
    const duplicateWork: string[] = [];

    for (const agent of agents) {
      assignments[agent.id] = [];
    }

    for (const task of tasks) {
      const capableAgents = agents.filter((a) =>
        a.capabilities.includes(task.requiredCapability)
      );

      if (capableAgents.length === 0) {
        unassignedTasks.push(task.id);
        continue;
      }

      const bestAgent = capableAgents[0];
      assignments[bestAgent.id].push(task.id);

      if (!taskAssignments[task.id]) {
        taskAssignments[task.id] = [];
      }
      taskAssignments[task.id].push(bestAgent.id);

      if (taskAssignments[task.id].length > 1) {
        duplicateWork.push(task.id);
      }
    }

    return { assignments, duplicateWork, unassignedTasks };
  }

  calculateDelegationAccuracy(assignments: Record<string, string[]>): number {
    const totalAssigned = Object.values(assignments).reduce(
      (sum, tasks) => sum + tasks.length,
      0
    );
    const agentsWithTasks = Object.values(assignments).filter(
      (tasks) => tasks.length > 0
    ).length;

    if (totalAssigned === 0) return 0;
    return agentsWithTasks / Object.keys(assignments).length;
  }
}
