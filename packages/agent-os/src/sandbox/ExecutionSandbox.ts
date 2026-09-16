import { spawn, ChildProcess } from 'child_process';

export interface SandboxConfig {
  timeout_seconds: number;
  allowed_executables: string[];
  shell: false;
}

export interface SandboxResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
  timed_out: boolean;
  command: string;
  duration_ms: number;
}

export class ExecutionSandbox {
  private config: SandboxConfig;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = {
      timeout_seconds: config.timeout_seconds || parseInt(process.env.SANDBOX_TIMEOUT_SECONDS || '30'),
      allowed_executables: config.allowed_executables || (
        process.env.ALLOWED_EXECUTABLES || 'python,python3,pytest,npm,npx,node'
      ).split(','),
      shell: false,
    };
  }

  validateCommand(command: string[]): { valid: boolean; reason?: string } {
    if (command.length === 0) {
      return { valid: false, reason: 'Empty command' };
    }

    const executable = command[0];

    if (!this.config.allowed_executables.includes(executable)) {
      return {
        valid: false,
        reason: `Executable '${executable}' not in whitelist: ${this.config.allowed_executables.join(', ')}`,
      };
    }

    return { valid: true };
  }

  async execute(command: string[], cwd?: string): Promise<SandboxResult> {
    const startTime = Date.now();
    const commandStr = command.join(' ');

    const validation = this.validateCommand(command);
    if (!validation.valid) {
      return {
        success: false,
        stdout: '',
        stderr: validation.reason || 'Invalid command',
        exit_code: 1,
        timed_out: false,
        command: commandStr,
        duration_ms: 0,
      };
    }

    return new Promise((resolve) => {
      const proc = spawn(command[0], command.slice(1), {
        cwd,
        shell: this.config.shell,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timed_out = false;

      const timer = setTimeout(() => {
        timed_out = true;
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 1000);
      }, this.config.timeout_seconds * 1000);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exit_code: code || 1,
          timed_out,
          command: commandStr,
          duration_ms: Date.now() - startTime,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        resolve({
          success: false,
          stdout,
          stderr: error.message,
          exit_code: 1,
          timed_out: false,
          command: commandStr,
          duration_ms: Date.now() - startTime,
        });
      });
    });
  }

  async executeTest(testCommand: string, cwd?: string): Promise<SandboxResult> {
    const command = testCommand.split(' ');
    return this.execute(command, cwd);
  }

  getConfig(): SandboxConfig {
    return { ...this.config };
  }
}
