import { describe, it, expect, beforeEach } from 'vitest';
import { AdversarialSuite } from '../src/adversarial-suite.js';
import { SandboxEnforcer } from '../src/sandbox-enforcer.js';
import { ESCAPE_ATTEMPTS } from '../src/escape-attempts.js';

describe('AdversarialSuite', () => {
  let suite: AdversarialSuite;
  beforeEach(() => { suite = new AdversarialSuite(); });

  it('creates instance', () => { expect(suite).toBeDefined(); });

  it('runs all escape attempts', () => {
    const result = suite.runAll();
    expect(result.total).toBe(ESCAPE_ATTEMPTS.length);
    expect(result.passed + result.failed).toBe(result.total);
  });

  it('has no escapes (all blocked or contained)', () => {
    const result = suite.runAll();
    expect(result.escaped).toBe(0);
  });

  it('runs individual attempt', () => {
    const attempt = ESCAPE_ATTEMPTS[0];
    const result = suite.runAttempt(attempt);
    expect(result.passed).toBe(true);
    expect(result.actual).toBe('blocked');
  });

  it('gets breaches (should be empty)', () => {
    suite.runAll();
    expect(suite.getBreaches().length).toBe(0);
  });

  it('verifies path traversal is blocked', () => {
    const result = suite.runAttempt(ESCAPE_ATTEMPTS.find(a => a.id === 'esc-fs-01')!);
    expect(result.actual).toBe('blocked');
  });

  it('verifies eval injection is blocked', () => {
    const result = suite.runAttempt(ESCAPE_ATTEMPTS.find(a => a.id === 'esc-inj-01')!);
    expect(result.actual).toBe('blocked');
  });

  it('verifies fork bomb is blocked', () => {
    const result = suite.runAttempt(ESCAPE_ATTEMPTS.find(a => a.id === 'esc-proc-01')!);
    expect(result.actual).toBe('blocked');
  });

  it('verifies rm -rf is blocked', () => {
    const result = suite.runAttempt(ESCAPE_ATTEMPTS.find(a => a.id === 'esc-proc-02')!);
    expect(result.actual).toBe('blocked');
  });
});

describe('SandboxEnforcer', () => {
  let enforcer: SandboxEnforcer;
  beforeEach(() => { enforcer = new SandboxEnforcer(); });

  it('blocks filesystem.delete', () => {
    const result = enforcer.checkCapability('filesystem.delete');
    expect(result.allowed).toBe(false);
  });

  it('allows filesystem.read', () => {
    const result = enforcer.checkCapability('filesystem.read');
    expect(result.allowed).toBe(true);
  });

  it('blocks process.execute', () => {
    const result = enforcer.checkCapability('process.execute');
    expect(result.allowed).toBe(false);
  });

  it('blocks network by default', () => {
    const result = enforcer.checkCapability('network.outbound');
    expect(result.allowed).toBe(false);
  });

  it('denies unknown capabilities', () => {
    const result = enforcer.checkCapability('unknown.capability');
    expect(result.allowed).toBe(false);
  });

  it('blocks denied modules', () => {
    const result = enforcer.checkModule('child_process');
    expect(result.allowed).toBe(false);
  });

  it('allows permitted modules', () => {
    const result = enforcer.checkModule('fs');
    expect(result.allowed).toBe(true);
  });

  it('blocks path traversal', () => {
    const result = enforcer.checkPath('../../../etc/passwd');
    expect(result.allowed).toBe(false);
  });

  it('allows paths within sandbox', () => {
    const result = enforcer.checkPath('/sandbox/test.txt');
    expect(result.allowed).toBe(true);
  });

  it('enforces memory limits', () => {
    expect(enforcer.checkMemoryUsage(1024 * 1024).allowed).toBe(true);
    expect(enforcer.checkMemoryUsage(1024 * 1024 * 1024).allowed).toBe(false);
  });

  it('enforces CPU time limits', () => {
    expect(enforcer.checkCpuTime(1000).allowed).toBe(true);
    expect(enforcer.checkCpuTime(60000).allowed).toBe(false);
  });
});
