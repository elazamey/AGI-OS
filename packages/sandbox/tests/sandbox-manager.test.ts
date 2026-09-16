import { describe, it, expect, beforeEach } from 'vitest';
import { SandboxManager } from '../src/sandbox-manager.js';
import { GovernanceGateway } from '@agi-os/governance';

describe('SandboxManager', () => {
  let sm: SandboxManager;
  beforeEach(() => { sm = new SandboxManager({ governance: new GovernanceGateway() }); });

  it('creates sandbox', () => {
    const s = sm.createSandbox({ language: 'javascript' });
    expect(s.id).toBeDefined();
    expect(s.language).toBe('javascript');
    expect(s.networkAccess).toBe(false);
  });

  it('destroys sandbox', () => {
    const s = sm.createSandbox();
    expect(sm.destroySandbox(s.id)).toBe(true);
    expect(sm.getSandbox(s.id)).toBeUndefined();
  });

  it('gets all sandboxes', () => {
    sm.createSandbox();
    sm.createSandbox();
    expect(sm.getAllSandboxes().length).toBe(2);
  });

  it('executes safe code', async () => {
    const s = sm.createSandbox();
    const r = await sm.execute(s.id, 'console.log("hello")');
    expect(r.success).toBe(true);
    expect(r.output).toContain('hello');
  });

  it('executes code with return value', async () => {
    const s = sm.createSandbox();
    const r = await sm.execute(s.id, 'console.log(1 + 2)');
    expect(r.output).toContain('3');
  });

  it('blocks dangerous code via validation', async () => {
    const s = sm.createSandbox();
    const r = await sm.execute(s.id, "require('child_process')");
    expect(r.success).toBe(false);
    expect(r.error).toContain('Validation failed');
  });

  it('blocks eval', async () => {
    const s = sm.createSandbox();
    const r = await sm.execute(s.id, 'eval("alert(1)")');
    expect(r.success).toBe(false);
  });

  it('governance blocks sandbox exec', async () => {
    const gov = new GovernanceGateway();
    const sm2 = new SandboxManager({ governance: gov });
    const s = sm2.createSandbox();
    const r = await sm2.execute(s.id, 'console.log("test")');
    expect(r.execution.governanceDecision).toBeDefined();
  });

  it('throws for non-existent sandbox', async () => {
    await expect(sm.execute('x', 'code')).rejects.toThrow();
  });

  it('tracks executions', async () => {
    const s = sm.createSandbox();
    await sm.execute(s.id, 'console.log("a")');
    await sm.execute(s.id, 'console.log("b")');
    expect(sm.getExecutionsBySandbox(s.id).length).toBe(2);
  });

  it('gets execution by id', async () => {
    const s = sm.createSandbox();
    const r = await sm.execute(s.id, 'console.log("x")');
    expect(sm.getExecution(r.execution.id)).toBeDefined();
  });

  it('gets all executions', async () => {
    const s = sm.createSandbox();
    await sm.execute(s.id, 'console.log("a")');
    expect(sm.getAllExecutions().length).toBe(1);
  });

  it('returns code validator', () => {
    expect(sm.getCodeValidator()).toBeDefined();
  });

  it('handles execution error', async () => {
    const s = sm.createSandbox();
    const r = await sm.execute(s.id, 'throw new Error("fail")');
    expect(r.success).toBe(false);
    expect(r.error).toContain('fail');
  });
});
