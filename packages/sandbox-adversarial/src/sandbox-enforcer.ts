// NOTE: SandboxEnforcer describes the *declared* capability boundary. It is not
// a verdict oracle. The previous AdversarialSuite used checkCapability's answer
// as the containment verdict, which meant the suite reported "blocked" for every
// attempt without executing anything. AdversarialSuite now measures containment
// from real execution output; this class is kept for policy introspection.
import type { SandboxConfig, CapabilityBoundary } from './types.js';

const DEFAULT_CONFIG: SandboxConfig = {
  maxMemoryBytes: 512 * 1024 * 1024,
  maxCpuTimeMs: 30000,
  allowedModules: ['fs', 'path', 'crypto'],
  deniedModules: ['child_process', 'cluster', 'worker_threads'],
  networkAccess: false,
  filesystemRoot: '/sandbox',
};

export class SandboxEnforcer {
  private config: SandboxConfig;

  constructor(config?: Partial<SandboxConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  checkCapability(capability: string): CapabilityBoundary {
    const boundaries: Record<string, () => CapabilityBoundary> = {
      'filesystem.read': () => ({ capability, allowed: true, reason: 'Read access within sandbox' }),
      'filesystem.write': () => ({ capability, allowed: true, reason: 'Write access within sandbox' }),
      'filesystem.delete': () => ({ capability, allowed: false, reason: 'Delete not permitted in sandbox' }),
      'process.execute': () => ({ capability, allowed: false, reason: 'Process execution not permitted' }),
      'process.spawn': () => ({ capability, allowed: false, reason: 'Process spawning not permitted' }),
      'filesystem.execute': () => ({ capability, allowed: false, reason: 'Execution is not a filesystem capability' }),
      'network.execute': () => ({ capability, allowed: false, reason: 'Execution is not a network capability' }),
      'exec.execute': () => ({ capability, allowed: false, reason: 'Execution is not permitted from inside the sandbox' }),
      'injection.execute': () => ({ capability, allowed: false, reason: 'Code injection is never permitted' }),
      'memory.execute': () => ({ capability, allowed: false, reason: 'Execution is not a memory capability' }),
      'privilege.execute': () => ({ capability, allowed: false, reason: 'Privilege escalation is never permitted' }),
      'network.outbound': () => ({ capability, allowed: this.config.networkAccess, reason: this.config.networkAccess ? 'Network allowed' : 'Network access disabled' }),
      'network.inbound': () => ({ capability, allowed: false, reason: 'Inbound connections not permitted' }),
    };
    return (boundaries[capability] ?? (() => ({ capability, allowed: false, reason: 'Unknown capability — deny by default' })))();
  }

  checkModule(moduleName: string): { allowed: boolean; reason: string } {
    if (this.config.deniedModules.includes(moduleName)) {
      return { allowed: false, reason: `Module "${moduleName}" is explicitly denied` };
    }
    if (this.config.allowedModules.length > 0 && !this.config.allowedModules.includes(moduleName)) {
      return { allowed: false, reason: `Module "${moduleName}" is not in allowlist` };
    }
    return { allowed: true, reason: `Module "${moduleName}" is allowed` };
  }

  checkPath(path: string): { allowed: boolean; reason: string } {
    if (path.includes('..')) {
      return { allowed: false, reason: 'Path traversal detected' };
    }
    if (!path.startsWith(this.config.filesystemRoot) && !path.startsWith('/tmp/') && !path.startsWith('/var/tmp/')) {
      return { allowed: false, reason: `Path "${path}" is outside sandbox root "${this.config.filesystemRoot}"` };
    }
    return { allowed: true, reason: 'Path is within sandbox' };
  }

  checkMemoryUsage(bytes: number): { allowed: boolean; reason: string } {
    if (bytes > this.config.maxMemoryBytes) {
      return { allowed: false, reason: `Memory ${bytes} exceeds limit ${this.config.maxMemoryBytes}` };
    }
    return { allowed: true, reason: 'Memory within limits' };
  }

  checkCpuTime(ms: number): { allowed: boolean; reason: string } {
    if (ms > this.config.maxCpuTimeMs) {
      return { allowed: false, reason: `CPU time ${ms}ms exceeds limit ${this.config.maxCpuTimeMs}ms` };
    }
    return { allowed: true, reason: 'CPU time within limits' };
  }

  getConfig(): SandboxConfig { return { ...this.config }; }
}
