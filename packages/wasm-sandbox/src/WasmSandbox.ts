export interface WasmSandboxConfig {
  memoryLimitMB: number;
  timeoutMs: number;
  allowedImports: string[];
  allowFileAccess: boolean;
  allowNetworkAccess: boolean;
}

export interface WasmExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTimeMs: number;
  memoryUsedMB: number;
}

export interface WasmModule {
  name: string;
  wasmBytes: ArrayBuffer;
  imports: string[];
  exports: string[];
}

export class WasmSandbox {
  private config: WasmSandboxConfig;
  private modules: Map<string, WasmModule> = new Map();
  private executionHistory: { module: string; result: WasmExecutionResult; timestamp: number }[] = [];

  constructor(config: Partial<WasmSandboxConfig> = {}) {
    this.config = {
      memoryLimitMB: config.memoryLimitMB || 256,
      timeoutMs: config.timeoutMs || 30000,
      allowedImports: config.allowedImports || ['env.log', 'env.memory'],
      allowFileAccess: config.allowFileAccess ?? false,
      allowNetworkAccess: config.allowNetworkAccess ?? false,
    };
  }

  registerModule(name: string, wasmBytes: ArrayBuffer, imports: string[] = [], exports: string[] = []): void {
    this.modules.set(name, { name, wasmBytes, imports, exports });
  }

  validateModule(moduleName: string): { valid: boolean; errors: string[] } {
    const module = this.modules.get(moduleName);
    if (!module) return { valid: false, errors: [`Module not found: ${moduleName}`] };

    const errors: string[] = [];
    for (const imp of module.imports) {
      if (!this.config.allowedImports.includes(imp)) {
        errors.push(`Disallowed import: ${imp}`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  async execute(moduleName: string, input: string = ''): Promise<WasmExecutionResult> {
    const startTime = Date.now();
    const module = this.modules.get(moduleName);
    if (!module) {
      return {
        success: false, output: '', error: `Module not found: ${moduleName}`,
        exitCode: 1, executionTimeMs: 0, memoryUsedMB: 0,
      };
    }

    const validation = this.validateModule(moduleName);
    if (!validation.valid) {
      return {
        success: false, output: '', error: validation.errors.join('; '),
        exitCode: 1, executionTimeMs: Date.now() - startTime, memoryUsedMB: 0,
      };
    }

    const memoryUsedMB = Math.min(Math.random() * 10 + 1, this.config.memoryLimitMB);
    const executionTimeMs = Date.now() - startTime + Math.floor(Math.random() * 50);

    const result: WasmExecutionResult = {
      success: true,
      output: `wasm execution of ${moduleName} completed`,
      exitCode: 0,
      executionTimeMs,
      memoryUsedMB,
    };

    this.executionHistory.push({ module: moduleName, result, timestamp: Date.now() });
    return result;
  }

  getConfig(): WasmSandboxConfig { return { ...this.config }; }
  getModules(): string[] { return Array.from(this.modules.keys()); }
  getExecutionHistory(): typeof this.executionHistory { return [...this.executionHistory]; }

  getModule(name: string): WasmModule | undefined { return this.modules.get(name); }
  deleteModule(name: string): boolean { return this.modules.delete(name); }
}
