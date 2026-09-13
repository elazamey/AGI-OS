import { describe, it, expect, beforeEach } from 'vitest';
import { RiskEvaluator } from '../src/risk.js';
import { RiskLevel } from '../src/types.js';

describe('RiskEvaluator', () => {
  let evaluator: RiskEvaluator;

  beforeEach(() => {
    evaluator = new RiskEvaluator();
  });

  // ---- Destructive operations → CRITICAL ---------------------------------
  it('should rate delete as CRITICAL', () => {
    const result = evaluator.evaluate({ id: '1', module: 'fs', operation: 'delete', target: '/tmp/file.txt' });
    expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
    expect(result.riskScore).toBeGreaterThanOrEqual(40);
  });

  it('should rate drop as CRITICAL', () => {
    const result = evaluator.evaluate({ id: '2', module: 'db', operation: 'drop', target: 'users' });
    expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
  });

  it('should rate destroy as CRITICAL', () => {
    const result = evaluator.evaluate({ id: '3', module: 'exec', operation: 'destroy', target: 'container-1' });
    expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
  });

  // ---- Write operations → HIGH -------------------------------------------
  it('rates a workspace-local fs write as ordinary, not HIGH', () => {
    // The old flat "any write is HIGH" penalty made every file write inside the
    // mission's own workspace require a human, which made the agent unusable.
    // Blast radius now depends on where the write lands.
    const local = evaluator.evaluate({ id: '4a', module: 'fs', operation: 'write', target: './output.txt' });
    expect(local.factors.some((f) => f.name === 'write_outside_workspace')).toBe(false);
    expect([RiskLevel.LOW, RiskLevel.MEDIUM]).toContain(local.riskLevel);

    const scratch = evaluator.evaluate({ id: '4b', module: 'fs', operation: 'write', target: '/tmp/output.txt' });
    expect([RiskLevel.LOW, RiskLevel.MEDIUM]).toContain(scratch.riskLevel);
  });

  it('rates a write outside the workspace as HIGH', () => {
    const outside = new RiskEvaluator({ workspaceRoots: ['/workspace/m1'] }).evaluate({
      id: '4c', module: 'fs', operation: 'write', target: '/opt/other/out.txt',
    });
    expect(outside.riskLevel).toBe(RiskLevel.HIGH);
    expect(outside.factors.some((f) => f.name === 'write_outside_workspace')).toBe(true);
  });

  it('rates a write to a sensitive target as HIGH even inside the workspace', () => {
    const sensitive = evaluator.evaluate({
      id: '4d', module: 'fs', operation: 'write', target: './config/.env.production',
    });
    expect(sensitive.riskLevel).toBe(RiskLevel.HIGH);
    expect(sensitive.factors.some((f) => f.name === 'sensitive_target')).toBe(true);
  });

  it('flags a db update as elevated risk (POL-002 is what requires approval)', () => {
    const result = evaluator.evaluate({ id: '5', module: 'db', operation: 'update', target: 'users' });
    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.factors.some((f) => f.name === 'write_operation')).toBe(true);
    // The decision does not rest on the score: database mutations are gated by
    // an explicit policy rule, so assert the invariant that actually holds.
    expect(result.riskLevel === RiskLevel.MEDIUM || result.riskLevel === RiskLevel.HIGH).toBe(true);
  });

  // ---- Execute operations → HIGH -----------------------------------------
  it('should rate execute as HIGH', () => {
    const result = evaluator.evaluate({ id: '6', module: 'exec', operation: 'execute', target: 'ls -la' });
    expect(result.riskLevel).toBe(RiskLevel.HIGH);
  });

  it('should rate run as HIGH', () => {
    const result = evaluator.evaluate({ id: '7', module: 'process', operation: 'run', target: 'node server.js' });
    expect(result.riskLevel).toBe(RiskLevel.HIGH);
  });

  // ---- Network operations → MEDIUM ---------------------------------------
  it('should rate network request as MEDIUM', () => {
    const result = evaluator.evaluate({ id: '8', module: 'network', operation: 'request', target: 'https://api.example.com' });
    expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
  });

  // ---- Sensitive targets → elevated risk ----------------------------------
  it('should rate .env access as elevated risk', () => {
    const result = evaluator.evaluate({ id: '9', module: 'fs', operation: 'read', target: '/app/.env' });
    expect(result.riskScore).toBeGreaterThanOrEqual(15);
  });

  it('should rate /etc/passwd access as elevated risk', () => {
    const result = evaluator.evaluate({ id: '10', module: 'fs', operation: 'read', target: '/etc/passwd' });
    expect(result.riskScore).toBeGreaterThanOrEqual(15);
  });

  it('should rate .ssh access as elevated risk', () => {
    const result = evaluator.evaluate({ id: '11', module: 'fs', operation: 'read', target: '~/.ssh/id_rsa' });
    expect(result.riskScore).toBeGreaterThanOrEqual(15);
  });

  // ---- Safe reads → LOW --------------------------------------------------
  it('should rate safe read as LOW', () => {
    const result = evaluator.evaluate({ id: '12', module: 'fs', operation: 'read', target: './public/img.png' });
    expect(result.riskLevel).toBe(RiskLevel.LOW);
  });

  it('should rate list as LOW', () => {
    const result = evaluator.evaluate({ id: '13', module: 'fs', operation: 'list', target: './src' });
    expect(result.riskLevel).toBe(RiskLevel.LOW);
  });

  // ---- Git operations ----------------------------------------------------
  it('should rate git push as elevated risk', () => {
    const result = evaluator.evaluate({ id: '14', module: 'git', operation: 'push', target: 'origin main' });
    expect(result.riskScore).toBeGreaterThanOrEqual(15);
  });

  it('should rate git force-push as higher risk', () => {
    const result = evaluator.evaluate({ id: '15', module: 'git', operation: 'force-push', target: 'origin main' });
    expect(result.riskScore).toBeGreaterThanOrEqual(40);
  });

  // ---- Factors -----------------------------------------------------------
  it('should include risk factors', () => {
    const result = evaluator.evaluate({ id: '16', module: 'fs', operation: 'write', target: '/tmp/file.txt' });
    expect(result.factors.length).toBeGreaterThan(0);
    expect(result.reason).toBeDefined();
  });

  it('should handle unknown modules', () => {
    const result = evaluator.evaluate({ id: '17', module: 'unknown', operation: 'read', target: 'x' });
    expect(result.riskLevel).toBe(RiskLevel.LOW);
  });
});
