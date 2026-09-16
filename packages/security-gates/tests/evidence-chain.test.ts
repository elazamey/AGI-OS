import { describe, it, expect, beforeEach } from 'vitest';
import { EvidenceChain } from '../src/evidence-chain.js';

describe('G5 — EvidenceChain', () => {
  let chain: EvidenceChain;
  beforeEach(() => { chain = new EvidenceChain(); });

  it('records evidence with hash chain', () => {
    const r1 = chain.record({ missionId: 'm1', executionId: 'e1', agentId: 'a1', tool: 'fs_read', input: 'test', output: 'result', policyDecision: 'ALLOW', result: 'success' });
    const r2 = chain.record({ missionId: 'm1', executionId: 'e2', agentId: 'a1', tool: 'fs_write', input: 'data', output: 'written', policyDecision: 'ALLOW', result: 'success' });
    expect(r1.parentEventId).toBeUndefined();
    expect(r2.parentEventId).toBe(r1.id);
  });

  it('generates different hashes for different inputs', () => {
    const r1 = chain.record({ missionId: 'm1', executionId: 'e1', agentId: 'a1', tool: 't', input: 'A', output: 'B', policyDecision: 'ALLOW', result: 'ok' });
    const r2 = chain.record({ missionId: 'm1', executionId: 'e2', agentId: 'a1', tool: 't', input: 'C', output: 'D', policyDecision: 'ALLOW', result: 'ok' });
    expect(r1.inputHash).not.toBe(r2.inputHash);
    expect(r1.outputHash).not.toBe(r2.outputHash);
  });

  it('verifies intact chain', () => {
    chain.record({ missionId: 'm1', executionId: 'e1', agentId: 'a1', tool: 't', input: 'a', output: 'b', policyDecision: 'ALLOW', result: 'ok' });
    chain.record({ missionId: 'm1', executionId: 'e2', agentId: 'a1', tool: 't', input: 'c', output: 'd', policyDecision: 'ALLOW', result: 'ok' });
    chain.record({ missionId: 'm1', executionId: 'e3', agentId: 'a1', tool: 't', input: 'e', output: 'f', policyDecision: 'ALLOW', result: 'ok' });
    expect(chain.verify().valid).toBe(true);
  });

  it('gets records for mission', () => {
    chain.record({ missionId: 'm1', executionId: 'e1', agentId: 'a1', tool: 't', input: 'a', output: 'b', policyDecision: 'ALLOW', result: 'ok' });
    chain.record({ missionId: 'm2', executionId: 'e2', agentId: 'a1', tool: 't', input: 'a', output: 'b', policyDecision: 'ALLOW', result: 'ok' });
    expect(chain.getRecordsFor('m1').length).toBe(1);
    expect(chain.getRecordsFor('m2').length).toBe(1);
  });

  it('counts records', () => {
    chain.record({ missionId: 'm1', executionId: 'e1', agentId: 'a1', tool: 't', input: 'a', output: 'b', policyDecision: 'ALLOW', result: 'ok' });
    expect(chain.count()).toBe(1);
  });

  it('clears chain', () => {
    chain.record({ missionId: 'm1', executionId: 'e1', agentId: 'a1', tool: 't', input: 'a', output: 'b', policyDecision: 'ALLOW', result: 'ok' });
    chain.clear();
    expect(chain.count()).toBe(0);
  });
});
