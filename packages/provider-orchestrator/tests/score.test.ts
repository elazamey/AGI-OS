import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatScores, scoreProvider, WEIGHTS } from '../src/score.ts';
import type { CapabilityRequirement, ProviderRecord } from '../src/types.ts';

const AT = 1_700_000_000_000;

function provider(over: Partial<ProviderRecord> = {}): ProviderRecord {
  return {
    id: 'p', kind: 'model', label: 'p', capabilities: ['chat'], health: 'available', priority: 50, enabled: true,
    policy: { allowAutoExecute: true, requiresApprovalFor: [], dataBoundary: 'any' }, quota: {},
    billing: 'free-tier', freeTier: { basis: 'requests-per-day', limit: 100, remaining: 100, hardStop: true },
    probe: null, cooldownUntil: null, consecutiveFailures: 0, ...over,
  };
}

const requirement: CapabilityRequirement = { capabilities: ['chat'], taskKind: 'coding' };

describe('score: the ranking is computed, not configured', () => {
  it('returns the six terms the operator specified, and a bounded total', () => {
    const { score, parts } = scoreProvider(provider(), { requirement, now: AT });
    assert.deepEqual(Object.keys(parts), ['capability', 'availability', 'quota', 'latency', 'reliability', 'taskFit', 'penalty', 'bias']);
    assert.ok(score >= 0 && score <= 100, `score out of range: ${score}`);
    assert.equal(parts.penalty, 0);
    const sum = parts.capability + parts.availability + parts.quota + parts.latency + parts.reliability + parts.taskFit + parts.bias;
    assert.equal(score, Math.round(Math.min(100, sum - parts.penalty)));
    assert.ok(WEIGHTS.capability + WEIGHTS.availability + WEIGHTS.quota + WEIGHTS.latency + WEIGHTS.reliability + WEIGHTS.taskFit <= 100);
  });

  it('health moves the score without touching eligibility', () => {
    const healthy = scoreProvider(provider({ health: 'available' }), { requirement, now: AT }).score;
    const degraded = scoreProvider(provider({ health: 'degraded' }), { requirement, now: AT }).score;
    const cooled = scoreProvider(provider({ health: 'rate_limited' }), { requirement, now: AT }).score;
    assert.ok(healthy > degraded && degraded > cooled, `${healthy} > ${degraded} > ${cooled}`);
  });

  it('a shrinking allowance shrinks the score, continuously', () => {
    const full = scoreProvider(provider({ freeTier: { basis: 'requests-per-day', limit: 100, remaining: 100, hardStop: true } }), { requirement, now: AT }).score;
    const half = scoreProvider(provider({ freeTier: { basis: 'requests-per-day', limit: 100, remaining: 50, hardStop: true } }), { requirement, now: AT }).score;
    const dregs = scoreProvider(provider({ freeTier: { basis: 'requests-per-day', limit: 100, remaining: 3, hardStop: true } }), { requirement, now: AT }).score;
    assert.ok(full > half && half > dregs, `a nearly-empty free tier must fall in the ladder before it empties: ${full} > ${half} > ${dregs}`);
    assert.equal(scoreProvider(provider({ freeTier: { basis: 'unlimited-local', limit: 1, hardStop: true } }), { requirement, now: AT }).parts.quota, WEIGHTS.quota, 'local never runs out, so it gets the full allowance term');
  });

  it('failures are punished, and capped so a bad day is not a permanent exile', () => {
    const once = scoreProvider(provider({ consecutiveFailures: 1, probe: { at: AT, state: 'available' } }), { requirement, now: AT });
    const many = scoreProvider(provider({ consecutiveFailures: 9, probe: { at: AT, state: 'available' } }), { requirement, now: AT });
    assert.ok(once.score < scoreProvider(provider({ probe: { at: AT, state: 'available' } }), { requirement, now: AT }).score);
    assert.equal(many.parts.penalty, 30, 'the penalty saturates');
    const cooling = scoreProvider(provider({ cooldownUntil: AT + 60_000, consecutiveFailures: 1, probe: { at: AT, state: 'rate_limited' } }), { requirement, now: AT });
    assert.ok(cooling.parts.penalty >= 10, 'an active cooldown costs more than a stale failure');
  });

  it('task fit is a real signal, so a coding task does not land on a chat-only model', () => {
    const coder = provider({ id: 'coder', capabilities: ['chat', 'code.edit', 'tool.calling', 'structured.output', 'long.context'], taskFit: ['coding'] });
    const chatty = provider({ id: 'chatty', capabilities: ['chat'], taskFit: ['chat'] });
    assert.ok(scoreProvider(coder, { requirement, now: AT }).score > scoreProvider(chatty, { requirement, now: AT }).score);
    assert.ok(scoreProvider(chatty, { requirement: { capabilities: ['chat'], taskKind: 'chat' }, now: AT }).parts.taskFit >= 6);
  });

  it('the ranking reads like the operator’s example and is fully auditable', () => {
    const entries = [
      { id: 'openrouter-free', ...scoreProvider(provider({ id: 'openrouter-free', priority: 10, lastLatencyMs: 300 }), { requirement, now: AT }) },
      { id: 'gemini-free', ...scoreProvider(provider({ id: 'gemini-free', priority: 20, lastLatencyMs: 600 }), { requirement, now: AT }) },
      { id: 'local', ...scoreProvider(provider({ id: 'local', priority: 60, lastLatencyMs: 40 }), { requirement, now: AT }) },
    ];
    const rendered = formatScores(entries.map((e) => ({ id: e.id, score: e.score })));
    assert.match(rendered, /^openrouter-free: \d+ · gemini-free: \d+ · local: \d+$/);
    assert.ok(entries.every((e) => Number.isInteger(e.score)), 'scores are integers so a report diff is meaningful');
  });
});
