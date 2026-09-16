import { describe, it, expect, beforeEach } from 'vitest';
import { CostGuard } from '../src/cost-guard.js';

describe('CostGuard', () => {
  let guard: CostGuard;

  beforeEach(() => {
    guard = new CostGuard();
  });

  it('should allow $0 cost requests', () => {
    const result = guard.check(0);
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain('OK');
  });

  it('should block non-zero cost requests', () => {
    const result = guard.check(0.001);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('$0 limit');
  });

  it('should block any positive cost', () => {
    expect(guard.check(0.000001).allowed).toBe(false);
    expect(guard.check(1).allowed).toBe(false);
    expect(guard.check(100).allowed).toBe(false);
  });

  it('should track blocked count', () => {
    guard.check(0.01);
    guard.check(0.02);
    expect(guard.getState().blockedCount).toBe(2);
  });

  it('should record spend (must be 0 for our system)', () => {
    guard.recordSpend(0);
    const state = guard.getState();
    expect(state.spentToday).toBe(0);
    expect(state.requestCount).toBe(1);
  });

  it('should throw on negative spend', () => {
    expect(() => guard.recordSpend(-1)).toThrow('negative');
  });

  it('should validate provider config — reject non-zero costs', () => {
    const result = guard.validateProviderConfig({
      id: 'paid-provider',
      costPerInputToken: 0.00001,
      costPerOutputToken: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('non-zero input cost');
  });

  it('should validate provider config — accept $0 costs', () => {
    const result = guard.validateProviderConfig({
      id: 'free-provider',
      costPerInputToken: 0,
      costPerOutputToken: 0,
    });
    expect(result.valid).toBe(true);
  });

  it('should estimate cost for free providers', () => {
    const cost = guard.estimateCost(
      { costPerInputToken: 0, costPerOutputToken: 0 },
      1000,
      500
    );
    expect(cost).toBe(0);
  });

  it('should estimate cost for paid providers', () => {
    const cost = guard.estimateCost(
      { costPerInputToken: 0.001, costPerOutputToken: 0.002 },
      1000,
      500
    );
    expect(cost).toBeCloseTo(2);
  });

  it('should warn at threshold', () => {
    const customGuard = new CostGuard({ maxSpendPerDay: 100, warnAtPercent: 80 });
    expect(customGuard.isWarning()).toBe(false);
  });

  it('should get config', () => {
    const config = guard.getConfig();
    expect(config.maxSpendPerRequest).toBe(0);
    expect(config.maxSpendPerDay).toBe(0);
  });

  it('should reset', () => {
    guard.recordSpend(0);
    guard.check(0.01);
    guard.reset();
    const state = guard.getState();
    expect(state.requestCount).toBe(0);
    expect(state.blockedCount).toBe(0);
  });

  it('should enforce maxSpendPerRequest config', () => {
    const guard2 = new CostGuard({ maxSpendPerRequest: 0.005 });
    // $0 cost always allowed (within any positive limit)
    expect(guard2.check(0).allowed).toBe(true);
    // Non-zero cost blocked by $0 global enforcement
    expect(guard2.check(0.01).allowed).toBe(false);
  });
});
