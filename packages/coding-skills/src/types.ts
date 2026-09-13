export interface CodeFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

export interface PatchResult {
  file: string;
  applied: boolean;
  hunks: number;
  error?: string;
}

export interface TestResult {
  file: string;
  passed: boolean;
  tests: number;
  failures: string[];
  duration: number;
}

export interface BuildResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  duration: number;
}

export interface ReviewComment {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export interface RefactorResult {
  file: string;
  changes: Array<{ line: number; old: string; new: string }>;
  description: string;
}
