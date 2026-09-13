import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalExecutor } from '../src/terminal-executor.js';

describe('TerminalExecutor', () => {
  let exec: TerminalExecutor;
  beforeEach(() => { exec = new TerminalExecutor(); });

  it('executes allowed command', () => {
    const result = exec.execute('ls -la');
    expect(result.exitCode).toBe(0);
  });

  it('blocks dangerous command', () => {
    const result = exec.execute('rm -rf /');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Blocked');
  });

  it('blocks unknown command', () => {
    const result = exec.execute('hack');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Not allowed');
  });

  it('tracks history', () => {
    exec.execute('ls');
    exec.execute('pwd');
    expect(exec.getHistory().length).toBe(2);
  });

  it('clears history', () => {
    exec.execute('ls');
    exec.clearHistory();
    expect(exec.getHistory().length).toBe(0);
  });
});
