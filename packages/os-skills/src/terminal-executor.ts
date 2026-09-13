import { generateId, now } from '@agi-os/kernel';
import type { TerminalResult } from './types.js';

export class TerminalExecutor {
  private history: TerminalResult[] = [];
  private allowedCommands: string[];
  private blockedCommands: string[];

  constructor(params?: { allowed?: string[]; blocked?: string[] }) {
    this.allowedCommands = params?.allowed ?? ['ls', 'cat', 'echo', 'pwd', 'date', 'wc', 'grep', 'head', 'tail', 'find', 'git', 'node', 'npm', 'pnpm'];
    this.blockedCommands = params?.blocked ?? ['rm -rf /', 'mkfs', 'dd', 'sudo', 'su', 'chmod 777', 'shutdown', 'reboot'];
  }

  execute(command: string): TerminalResult {
    const start = Date.now();

    for (const blocked of this.blockedCommands) {
      if (command.includes(blocked)) {
        const result: TerminalResult = { command, exitCode: 1, stdout: '', stderr: `Blocked: ${blocked}`, duration: 0 };
        this.history.push(result);
        return result;
      }
    }

    const baseCmd = command.split(' ')[0];
    if (!this.allowedCommands.includes(baseCmd)) {
      const result: TerminalResult = { command, exitCode: 1, stdout: '', stderr: `Not allowed: ${baseCmd}`, duration: 0 };
      this.history.push(result);
      return result;
    }

    const result: TerminalResult = {
      command,
      exitCode: 0,
      stdout: `Executed: ${command}`,
      stderr: '',
      duration: Date.now() - start,
    };
    this.history.push(result);
    return result;
  }

  getHistory(): TerminalResult[] { return [...this.history]; }
  getAllowedCommands(): string[] { return [...this.allowedCommands]; }
  getBlockedCommands(): string[] { return [...this.blockedCommands]; }
  clearHistory(): void { this.history = []; }
}
