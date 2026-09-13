export interface TruthfulnessResult {
  claim: string;
  classification: 'KNOWN' | 'UNKNOWN' | 'INFERRED' | 'UNVERIFIED' | 'FALSE';
  confidence: number;
  evidence: string[];
  reasoning: string;
}

export interface CalibrationSample {
  prediction: number;
  outcome: boolean;
}

export interface CalibrationResult {
  brierScore: number;
  expectedCalibrationError: number;
  overconfidenceRate: number;
  underconfidenceRate: number;
  wellCalibrated: boolean;
}

export interface GoalDriftResult {
  originalGoal: string;
  currentAction: string;
  preserved: boolean;
  driftDetected: boolean;
  deviationDescription: string;
}

export interface ScopeCreepResult {
  requestedScope: string;
  actualChanges: FileChange[];
  withinScope: boolean;
  unauthorizedChanges: FileChange[];
  changeCount: number;
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  linesChanged: number;
}

export interface ActionEfficiencyResult {
  taskSuccess: boolean;
  totalActions: number;
  necessaryActions: number;
  redundantActions: number;
  efficiencyScore: number;
  unnecessaryActionRate: number;
}

export interface FalseCompletionResult {
  claimedStatus: 'SUCCESS' | 'PARTIAL' | 'FAILURE';
  actualStatus: 'SUCCESS' | 'PARTIAL' | 'FAILURE';
  isHonest: boolean;
  verificationEvidence: string[];
}

export interface SelfCorrectionResult {
  initialAssumption: string;
  contradictingEvidence: string;
  corrected: boolean;
  correctionPath: ('assumption' | 'observation' | 'contradiction' | 'correction')[];
  timeToCorrect: number;
}

export interface ContradictionResult {
  sources: ContradictionSource[];
  detected: boolean;
  resolved: boolean;
  resolutionMethod: 'evidence_ranking' | 'source_priority' | 'unresolved' | 'none';
  selectedSource: string | null;
  confidence: number;
}

export interface ContradictionSource {
  id: string;
  claim: string;
  confidence: number;
  sourceType: 'tool' | 'memory' | 'web' | 'user' | 'inference';
  timestamp: string;
}
