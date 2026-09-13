import { describe, it, expect, beforeEach } from 'vitest';
import { CostAuditor } from '../src/cost-auditor.js';

describe('G3 — CostAuditor', () => {
  let auditor: CostAuditor;
  beforeEach(() => { auditor = new CostAuditor(); });

  it('blocks paid provider (openai)', () => {
    const entry = auditor.auditRequest('openai-gpt4', 0.001);
    expect(entry.allowed).toBe(false);
    expect(entry.reason).toContain('Paid provider');
  });

  it('blocks paid provider (anthropic)', () => {
    const entry = auditor.auditRequest('anthropic-claude', 0.002);
    expect(entry.allowed).toBe(false);
  });

  it('allows local provider with $0 cost', () => {
    const entry = auditor.auditRequest('local-ollama', 0);
    expect(entry.allowed).toBe(true);
  });

  it('blocks non-zero cost for any provider', () => {
    const entry = auditor.auditRequest('free-tier-api', 0.0001);
    expect(entry.allowed).toBe(false);
    expect(entry.reason).toContain('Non-zero cost');
  });

  it('runs gate audit', () => {
    auditor.auditRequest('openai', 0.001);
    auditor.auditRequest('local-ollama', 0);
    const gate = auditor.runGate();
    expect(gate.gate).toBe('G3-CostEnforcement');
    expect(gate.tests).toBeGreaterThan(0);
    expect(gate.details.length).toBeGreaterThan(0);
  });

  it('gate passes when all paid blocked', () => {
    auditor.auditRequest('openai', 0.001);
    auditor.auditRequest('anthropic', 0.002);
    auditor.auditRequest('local-ollama', 0);
    const gate = auditor.runGate();
    expect(gate.status).toBe('PASS');
  });

  it('gets audit log', () => {
    auditor.auditRequest('openai', 0.001);
    auditor.auditRequest('local-ollama', 0);
    expect(auditor.getLog().length).toBe(2);
  });

  it('clears log', () => {
    auditor.auditRequest('openai', 0.001);
    auditor.clear();
    expect(auditor.getLog().length).toBe(0);
  });
});
