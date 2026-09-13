export interface GitStatus {
  branch: string;
  staged: string[];
  modified: string[];
  untracked: string[];
  clean: boolean;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  hunks: Array<{ start: number; lines: string[] }>;
}

export interface GitBranch {
  name: string;
  current: boolean;
  lastCommit: string;
}
