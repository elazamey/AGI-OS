import { describe, it, expect, beforeEach } from 'vitest';
import { RiskEvaluator } from '../src/risk.js';
import { RiskLevel } from '../src/types.js';
import type { ActionIntent } from '../src/types.js';

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
  it('should rate fs write as HIGH', () => {
    const result = evaluator.evaluate({ id: '4', module: 'fs', operation: 'write', target: '/tmp/output.txt' });
    expect(result.riskLevel).toBe(RiskLevel.HIGH);
  });

  it('should rate db update as HIGH', () => {
    const result = evaluator.evaluate({ id: '5', module: 'db', operation: 'update', target: 'users' });
    expect(result.riskLevel).toBe(RiskLevel.HIGH);
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
