import { describe, it, expect, beforeEach } from 'vitest';
import { AdversarialAttackSuite, AttackVector } from '../src/index.js';

describe('AdversarialAttackSuite', () => {
  let suite: AdversarialAttackSuite;

  beforeEach(() => {
    suite = new AdversarialAttackSuite();
  });

  it('should create suite with default vectors', () => {
    expect(suite).toBeDefined();
    expect(suite.getAllVectors().length).toBeGreaterThanOrEqual(12);
  });

  it('should get vector by id', () => {
    const vector = suite.getVector('di-001');
    expect(vector).toBeDefined();
    expect(vector?.name).toBe('System Prompt Override');
  });

  it('should get vectors by type', () => {
    const direct = suite.getVectorsByType('direct_injection');
    const indirect = suite.getVectorsByType('indirect_injection');
    expect(direct.length).toBe(4);
    expect(indirect.length).toBe(3);
  });

  it('should get vectors by severity', () => {
    const critical = suite.getVectorsBySeverity('critical');
    const high = suite.getVectorsBySeverity('high');
    expect(critical.length).toBeGreaterThanOrEqual(6);
    expect(high.length).toBeGreaterThanOrEqual(4);
  });

  it('should add custom vector', () => {
    const initialCount = suite.getAllVectors().length;
    const custom: AttackVector = {
      id: 'custom-001',
      name: 'Custom Attack',
      type: 'direct_injection',
      payload: 'Custom malicious payload',
      description: 'Custom test attack',
      severity: 'low',
    };

    suite.addVector(custom);
    expect(suite.getAllVectors().length).toBe(initialCount + 1);
    expect(suite.getVector('custom-001')).toBeDefined();
  });

  it('should simulate attack with blocked result', async () => {
    const vector = suite.getVector('di-001')!;
    const result = await suite.simulateAttack(vector, async (payload) => ({
      blocked: true,
      reason: 'Malicious content detected',
    }));

    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('Malicious content detected');
    expect(result.detection_latency_ms).toBeGreaterThanOrEqual(0);
  });

  it('should simulate attack with allowed result', async () => {
    const vector = suite.getVector('di-001')!;
    const result = await suite.simulateAttack(vector, async (payload) => ({
      blocked: false,
    }));

    expect(result.blocked).toBe(false);
    expect(result.policy_response).toBe('allow');
  });

  it('should run full suite with all blocked', async () => {
    const report = await suite.runFullSuite(async (payload) => ({
      blocked: true,
      reason: 'Blocked',
    }));

    expect(report.total_attacks).toBeGreaterThanOrEqual(12);
    expect(report.blocked).toBe(report.total_attacks);
    expect(report.block_rate).toBe(1);
    expect(report.critical_breaches.length).toBe(0);
  });

  it('should run full suite with some breaches', async () => {
    const report = await suite.runFullSuite(async (payload) => ({
      blocked: payload.length < 50,
    }));

    expect(report.total_attacks).toBeGreaterThanOrEqual(12);
    expect(report.blocked).toBeLessThan(report.total_attacks);
    expect(report.succeeded).toBeGreaterThan(0);
  });

  it('should group results by type', async () => {
    const report = await suite.runFullSuite(async (payload) => ({
      blocked: true,
    }));

    expect(report.by_type.direct_injection).toBeDefined();
    expect(report.by_type.indirect_injection).toBeDefined();
    expect(report.by_type.exfiltration).toBeDefined();
    expect(report.by_type.escape).toBeDefined();
    expect(report.by_type.escalation).toBeDefined();
  });

  it('should group results by severity', async () => {
    const report = await suite.runFullSuite(async (payload) => ({
      blocked: true,
    }));

    expect(report.by_severity.critical).toBeDefined();
    expect(report.by_severity.high).toBeDefined();
    expect(report.by_severity.medium).toBeDefined();
  });

  it('should track critical breaches', async () => {
    const report = await suite.runFullSuite(async (payload) => {
      const isCritical = payload.includes('rm -rf') || payload.includes('docker.sock');
      return { blocked: !isCritical };
    });

    expect(report.critical_breaches.length).toBeGreaterThan(0);
  });

  it('should measure detection latency', async () => {
    const report = await suite.runFullSuite(async (payload) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return { blocked: true };
    });

    expect(report.avg_detection_latency_ms).toBeGreaterThanOrEqual(10);
  });

  it('should calculate block rate correctly', async () => {
    let callCount = 0;
    const report = await suite.runFullSuite(async (payload) => {
      callCount++;
      return { blocked: callCount % 2 === 0 };
    });

    expect(report.block_rate).toBeGreaterThan(0);
    expect(report.block_rate).toBeLessThan(1);
  });
});
