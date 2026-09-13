export interface HiddenTask {
  id: string;
  category: string;
  task: string;
  seed: number;
}

export interface EvaluationResult {
  score: number;
  criteriaScores: Record<string, number>;
  passed: boolean;
}

export interface FreshTaskTemplate {
  pattern: string;
  variables: Record<string, string[]>;
}
