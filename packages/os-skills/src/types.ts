export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  permissions?: string;
}

export interface TerminalResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface DiffResult {
  file: string;
  added: string[];
  removed: string[];
  unchanged: number;
  totalChanges: number;
}

export interface HashResult {
  file: string;
  algorithm: string;
  hash: string;
}
