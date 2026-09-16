export interface Goal {
  id: string;
  description: string;
  constraints: string[];
  priority: number;
  deadline?: string;
}

export interface TaskPlan {
  id: string;
  goalId: string;
  steps: PlanStep[];
  dependencies: Map<string, string[]>;
  estimatedDuration: number;
  riskLevel: string;
}

export interface PlanStep {
  id: string;
  skillId: string;
  description: string;
  input: Record<string, unknown>;
  dependencies: string[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: unknown;
  error?: string;
}

export interface DecomposedTask {
  id: string;
  parentGoalId: string;
  steps: PlanStep[];
  parallelGroups: string[][];
  criticalPath: string[];
}

export interface IntentAnalysis {
  id: string;
  rawInput: string;
  goals: Goal[];
  constraints: string[];
  riskAssessment: string;
  suggestedSkills: string[];
}

export interface ReplanResult {
  originalPlanId: string;
  newPlanId: string;
  changes: string[];
  reason: string;
  timestamp: string;
}
