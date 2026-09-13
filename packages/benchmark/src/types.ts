import type { PolicyDecision } from '@agi-os/governance';

export type BenchmarkCategory = 'tool_use' | 'reasoning' | 'safety' | 'governance' | 'memory';

export interface BenchmarkSuite {
  id: string;
  name: string;
  description: string;
  scenarios: BenchmarkScenario[];
  category: BenchmarkCategory;
}

export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  input: BenchmarkInput;
  expected: BenchmarkExpected;
  timeout: number;
  tags: string[];
}

export interface BenchmarkInput {
  goal: string;
  context: Record<string, unknown>;
  availableTools: string[];
}

export interface BenchmarkExpected {
  outcome: 'success' | 'failure' | 'blocked';
  expectedTool?: string;
  expectedGovernance?: PolicyDecision;
  minConfidence?: number;
  maxDuration?: number;
}

export interface BenchmarkResult {
  id: string;
  suiteId: string;
  scenarioId: string;
  model: string;
  provider: string;
  actual: BenchmarkActual;
  passed: boolean;
  score: number;
  duration: number;
  timestamp: string;
}

export interface BenchmarkActual {
  outcome: string;
  toolUsed?: string;
  governanceDecision?: PolicyDecision;
  confidence?: number;
  duration: number;
}

export interface RegressionReport {
  id: string;
  model: string;
  totalScenarios: number;
  passed: number;
  failed: number;
  score: number;
  regressions: Regression[];
  improvements: Regression[];
  timestamp: string;
}

export interface Regression {
  scenarioId: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  trend: 'improving' | 'stable' | 'regressing';
}
