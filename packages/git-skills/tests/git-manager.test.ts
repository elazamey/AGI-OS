import { describe, it, expect, beforeEach } from 'vitest';
import { GitManager } from '../src/git-manager.js';

describe('GitManager', () => {
  let git: GitManager;
  beforeEach(() => { git = new GitManager(); });

  it('gets status', () => {
    expect(git.getStatus().branch).toBe('main');
    expect(git.getStatus().clean).toBe(true);
  });

  it('creates branch', () => {
    const branch = git.createBranch('feature');
    expect(branch.name).toBe('feature');
    expect(git.getBranches().length).toBe(2);
  });

  it('switches branch', () => {
    git.createBranch('dev');
    expect(git.switchBranch('dev')).toBe(true);
    expect(git.getStatus().branch).toBe('dev');
  });

  it('fails switching to nonexistent branch', () => {
    expect(git.switchBranch('nope')).toBe(false);
  });

  it('stages and commits', () => {
    git.stageFile('a.txt');
    expect(git.getStatus().staged).toContain('a.txt');
    const commit = git.commit('add a.txt');
    expect(commit.hash).toBeDefined();
    expect(git.getStatus().staged.length).toBe(0);
  });

  it('tracks modified files', () => {
    git.addModifiedFile('b.txt');
    expect(git.getStatus().modified).toContain('b.txt');
    expect(git.getStatus().clean).toBe(false);
  });

  it('gets log', () => {
    git.commit('first');
    git.commit('second');
    expect(git.getLog().length).toBe(2);
  });
});
