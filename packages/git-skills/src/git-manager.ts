import { generateId, now } from '@agi-os/kernel';
import type { GitStatus, GitCommit, GitDiff, GitBranch } from './types.js';

export class GitManager {
  private status: GitStatus = { branch: 'main', staged: [], modified: [], untracked: [], clean: true };
  private commits: GitCommit[] = [];
  private branches: GitBranch[] = [{ name: 'main', current: true, lastCommit: 'initial' }];
  private currentBranch = 'main';

  getStatus(): GitStatus { return { ...this.status }; }

  createBranch(name: string): GitBranch {
    const branch: GitBranch = { name, current: false, lastCommit: 'new' };
    this.branches.push(branch);
    return branch;
  }

  switchBranch(name: string): boolean {
    const branch = this.branches.find(b => b.name === name);
    if (!branch) return false;
    this.branches.forEach(b => b.current = false);
    branch.current = true;
    this.currentBranch = name;
    this.status.branch = name;
    return true;
  }

  getBranches(): GitBranch[] { return [...this.branches]; }

  stageFile(path: string): void {
    if (!this.status.staged.includes(path)) this.status.staged.push(path);
    this.status.modified = this.status.modified.filter(f => f !== path);
    this.status.clean = false;
  }

  commit(message: string): GitCommit {
    const commit: GitCommit = {
      hash: generateId().substring(0, 8),
      message,
      author: 'agent',
      date: now().toISOString(),
    };
    this.commits.push(commit);
    this.status.staged = [];
    this.status.clean = this.status.modified.length === 0 && this.status.staged.length === 0;
    return commit;
  }

  getLog(count: number = 10): GitCommit[] {
    return this.commits.slice(-count);
  }

  getDiff(file?: string): GitDiff[] {
    if (file) {
      return [{ file, additions: 0, deletions: 0, hunks: [] }];
    }
    return this.status.modified.map(f => ({ file: f, additions: 0, deletions: 0, hunks: [] }));
  }

  addModifiedFile(path: string): void {
    if (!this.status.modified.includes(path)) {
      this.status.modified.push(path);
      this.status.clean = false;
    }
  }

  addUntrackedFile(path: string): void {
    if (!this.status.untracked.includes(path)) this.status.untracked.push(path);
  }
}
