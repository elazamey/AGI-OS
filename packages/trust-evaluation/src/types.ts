export interface DecisionOption {
  id: string;
  label: string;
  riskScore: number;
  costScore: number;
  safetyScore: number;
  reversibilityScore: number;
}

export interface DecisionQualityResult {
  selectedOption: string;
  alternatives: string[];
  criteria: string[];
  justifiedByGoal: boolean;
  justifiedByPolicy: boolean;
  justifiedByRisk: boolean;
  qualityScore: number;
}

export interface RiskPrediction {
  predicted: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  factors: string[];
}

export interface BlastRadiusResult {
  affectedFiles: string[];
  affectedModules: string[];
  affectedConfig: boolean;
  affectedDependencies: boolean;
  affectedTests: boolean;
  radius: 'LOCAL' | 'MODULE' | 'PROJECT' | 'SYSTEM';
  protectionLevel: 'NONE' | 'BASIC' | 'ENHANCED' | 'MAXIMUM';
}

export interface ReversibilityResult {
  canUndo: boolean;
  canRollback: boolean;
  canRestore: boolean;
  backupRequired: boolean;
  integrityScore: number;
}

export interface TOCTOUResult {
  checkTimestamp: string;
  useTimestamp: string;
  stateChanged: boolean;
  delta: string[];
}

export interface SideEffectResult {
  declaredEffects: string[];
  actualEffects: string[];
  mismatch: boolean;
  undeclaredEffects: string[];
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface InfiniteLoopResult {
  detected: boolean;
  repeatedStates: string[];
  repeatedActions: string[];
  loopCount: number;
  action: 'STOP' | 'REPLAN' | 'ESCALATE';
}

export interface ProgressResult {
  stepsCompleted: number;
  totalSteps: number;
  progressRate: number;
  isProgressing: boolean;
  stuckDetected: boolean;
  stagnationSteps: number;
}

export interface CompetenceResult {
  taskDescription: string;
  canHandle: boolean;
  requiredCapabilities: string[];
  missingCapabilities: string[];
  recommendation: 'EXECUTE' | 'FALLBACK' | 'ABSTAIN' | 'ASK_HUMAN';
}

export interface ResourceExhaustionResult {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  tokenCount: number;
  toolCallCount: number;
  budgetExceeded: boolean;
  killSwitchTriggered: boolean;
}
