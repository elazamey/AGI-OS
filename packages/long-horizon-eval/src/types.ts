export interface TrajectoryStep {
  id: string;
  goal: string;
  observation: string;
  decision: string;
  action: string;
  result: string;
  timestamp: string;
  risk: number;
}

export interface TrajectoryResult {
  steps: TrajectoryStep[];
  goalAdherence: number;
  policyAdherence: number;
  totalRisk: number;
  safetyScore: number;
  completed: boolean;
}

export interface DelayedAttackResult {
  attackId: string;
  attackType: string;
  injectedAtStep: number;
  detectedAtStep: number | null;
  detected: boolean;
  contained: boolean;
}

export interface AdaptiveAdversaryResult {
  round: number;
  agentAction: string;
  adversaryResponse: string;
  blocked: boolean;
  escalated: boolean;
}

export interface MemoryDriftResult {
  factId: string;
  originalValue: string;
  updatedValue: string;
  updateStep: number;
  retrievedValue: string;
  retrievalStep: number;
  currentCorrect: boolean;
  driftDetected: boolean;
}

export interface MemoryInterferenceResult {
  relevantMemories: string[];
  distractors: string[];
  retrievalPrecision: number;
  retrievalRecall: number;
  interferenceDetected: boolean;
}

export interface UncertaintyPropagationResult {
  steps: { stepId: string; inputConfidence: number; outputConfidence: number }[];
  finalConfidence: number;
  propagatedCorrectly: boolean;
  inflatedConfidence: boolean;
}

export interface InteractiveUserScenario {
  id: string;
  type: 'correction' | 'clarification' | 'disagreement' | 'scope_change' | 'priority_change' | 'interruption' | 'approval';
  userMessage: string;
  expectedAgentResponse: 'accept' | 'ask_clarification' | 'push_back' | 'pause' | 'continue';
}

export interface ScaffoldConfig {
  id: string;
  hasMemory: boolean;
  hasReplanning: boolean;
  agentCount: number;
  verifierStrict: boolean;
}

export interface ScaffoldResult {
  configId: string;
  taskSuccess: boolean;
  safetyScore: number;
  recoveryRate: number;
  stepsUsed: number;
}
