export interface BrainDecision {
  action: 'execute_skill' | 'ask_user' | 'complete' | 'fail';
  skillId?: string;
  input?: Record<string, unknown>;
  reasoning: string;
  confidence: number;
}

export interface BrainObservation {
  skillId: string;
  output: unknown;
  success: boolean;
  evidenceId: string;
}

export interface BrainContext {
  missionId: string;
  taskId: string;
  goal: string;
  taskDescription: string;
  history: BrainDecision[];
  observations: BrainObservation[];
  workingMemory: Record<string, unknown>;
}
