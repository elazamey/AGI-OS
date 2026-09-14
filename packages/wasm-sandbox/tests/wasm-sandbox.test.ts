import { describe, it, expect, beforeEach } from 'vitest';
import { WasmSandbox } from '../src/index.js';

describe('WasmSandbox', () => {
  let sandbox: WasmSandbox;

  beforeEach(() => {
    sandbox = new WasmSandbox({ memoryLimitMB: 128, timeoutMs: 5000 });
  });

  it('should create sandbox with config', () => {
    expect(sandbox).toBeDefined();
    const config = sandbox.getConfig();
    expect(config.memoryLimitMB).toBe(128);
    expect(config.timeoutMs).toBe(5000);
    expect(config.allowFileAccess).toBe(false);
  });

  it('should register module', () => {
    const buffer = new ArrayBuffer(100);
    sandbox.registerModule('test-module', buffer, ['env.log'], ['main']);
    expect(sandbox.getModules()).toContain('test-module');
  });

  it('should validate module with allowed imports', () => {
    const buffer = new ArrayBuffer(100);
    sandbox.registerModule('valid-module', buffer, ['env.log', 'env.memory']);
    const result = sandbox.validateModule('valid-module');
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should reject module with disallowed imports', () => {
    const buffer = new ArrayBuffer(100);
    sandbox.registerModule('bad-module', buffer, ['env.fs.readFile']);
    const result = sandbox.validateModule('bad-module');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should execute valid module', async () => {
    const buffer = new ArrayBuffer(100);
    sandbox.registerModule('exec-module', buffer, ['env.log']);
    const result = await sandbox.execute('exec-module');
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('should fail on non-existent module', async () => {
    const result = await sandbox.execute('nonexistent');
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it('should track execution history', async () => {
    const buffer = new ArrayBuffer(100);
    sandbox.registerModule('hist-module', buffer);
    await sandbox.execute('hist-module');
    await sandbox.execute('hist-module');
    expect(sandbox.getExecutionHistory().length).toBe(2);
  });

  it('should get module info', () => {
    const buffer = new ArrayBuffer(100);
    sandbox.registerModule('info-module', buffer, ['env.log'], ['main', 'init']);
    const module = sandbox.getModule('info-module');
    expect(module).toBeDefined();
    expect(module!.name).toBe('info-module');
    expect(module!.exports).toContain('main');
  });

  it('should delete module', () => {
    const buffer = new ArrayBuffer(100);
    sandbox.registerModule('del-module', buffer);
    expect(sandbox.deleteModule('del-module')).toBe(true);
    expect(sandbox.getModules()).not.toContain('del-module');
  });

  it('should respect memory limit', () => {
    const sandbox2 = new WasmSandbox({ memoryLimitMB: 64 });
    expect(sandbox2.getConfig().memoryLimitMB).toBe(64);
  });
});
