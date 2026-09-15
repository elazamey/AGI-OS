import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { impliesAgentAdapter, planMission } from '../src/orchestrator.ts';
import { loadControlPlaneConfig } from '../src/config.ts';

const REPO_CONFIG = join(import.meta.dirname, '..', '..', '..', 'agi-os-providers.json');

function liveConfig() {
  return loadControlPlaneConfig(REPO_CONFIG);
}

describe('orchestrator: Agent Router above the Model Router, one policy under both', () => {
  it('routes a prompt task to the free-first model plane', () => {
    const config = liveConfig();
    const plan = planMission({ registry: config.registry, requirement: { capabilities: ['chat'] }, prompt: 'summarise the gate', freeOnly: config.freeOnly });
    assert.equal(plan.plane, 'model');
    assert.equal(plan.provider?.id, 'openrouter-free');
    assert.equal(plan.agent, null, 'a plain prompt task must not spend an agent adapter');
    assert.ok(plan.ladder.length >= 4, 'the whole free ladder must stay available as fallbacks');
    assert.deepEqual(config.models.filter((m) => m.id === 'cloudflare-ai').length, 1);
    assert.ok(plan.ladder.every((p) => p.billing === 'free-tier' || p.billing === 'trial-credit'), 'the operating layer contains no metered provider');
    assert.ok(!plan.ladder.some((p) => p.billing === 'paid'));
    assert.match(plan.reason, /free-first model provider "openrouter-free" scored \d+/);
  });

  it('routes a mission that touches the repo to an agent adapter, keeping the model ladder as fallback', () => {
    const config = liveConfig();
    const requirement = { capabilities: ['chat', 'repo.work', 'tools.shell'] };
    assert.equal(impliesAgentAdapter(requirement), true);
    const plan = planMission({ registry: config.registry, requirement, prompt: 'land the gate in CI', freeOnly: true });
    assert.equal(plan.plane, 'agent');
    assert.equal(plan.provider?.id, 'arena');
    assert.equal(plan.model.plane, 'model');
    assert.ok(plan.model.ladder.length >= 0);
    assert.match(plan.reason, /agent adapter "arena" is available and valid/);
    const paid = plan.agent?.rejected.find((r) => r.provider === 'claude-api');
    assert.equal(paid?.stage, 'free', 'the repo manifest ships a real paid adapter, and FREE_ONLY must be provable against it');
    assert.match(paid?.reason ?? '', /forbids an automatic upgrade/);
  });

  it('drops to the model plane when the only adapter is down', () => {
    const config = liveConfig();
    for (const adapter of config.agents) {
      config.registry.replace({ ...adapter, health: 'unhealthy', probe: { at: Date.now(), state: 'unhealthy', reason: 'no credentials in this sandbox' } });
    }
    const plan = planMission({ registry: config.registry, requirement: { capabilities: ['chat', 'repo.work'] }, freeOnly: true });
    assert.equal(plan.provider, null, 'a repo-touching task cannot be served by a prompt API, and the adapters are down');
    assert.equal(plan.plane, 'model');
    assert.equal(plan.blockedReason, 'NO_ELIGIBLE_PROVIDER', 'this is an outage, not a quota event — the label must not send someone to the billing page');
    assert.match(plan.reason, /NO_ELIGIBLE_PROVIDER → BLOCKED: .*arena@health/);
    assert.match(plan.model.rejected.find((x) => x.provider === 'openrouter-free')?.reason ?? '', /missing: repo\.work/);
  });

  it('ends in NO_FREE_PROVIDER_AVAILABLE when every free rung is spent and local is down', () => {
    const config = liveConfig();
    for (const model of config.models) {
      config.registry.replace({
        ...model,
        freeTier: model.freeTier ? { ...model.freeTier, remaining: 0, used: model.freeTier.limit } : undefined,
        enabled: model.id === 'local' ? false : model.enabled,
      });
    }
    const events: Array<Record<string, unknown>> = [];
    const plan = planMission({
      registry: config.registry,
      requirement: { capabilities: ['chat'] },
      prompt: 'keep going',
      freeOnly: true,
      onEvent: (event) => events.push(event),
    });
    assert.equal(plan.provider, null);
    assert.equal(plan.blockedReason, 'NO_FREE_PROVIDER_AVAILABLE');
    assert.match(plan.reason, /NO_FREE_PROVIDER_AVAILABLE → BLOCKED/);
    assert.deepEqual(events.map((e) => e.type), ['plan:model']);
    assert.equal(events[0].blockedReason, 'NO_FREE_PROVIDER_AVAILABLE');
    for (const rung of ['openrouter-free', 'gemini-free', 'cerebras', 'hf-inference']) {
      const rejection = plan.model.rejected.find((r) => r.provider === rung);
      assert.equal(rejection?.stage, 'quota', `${rung} must be stopped by its allowance, not by an error`);
    }
    assert.equal(plan.model.rejected.find((r) => r.provider === 'cloudflare-ai')?.stage, 'health');
  });

  it('records the operator override in the plan instead of hiding it', () => {
    const config = liveConfig();
    const need = { capabilities: ['chat', 'repo.work'] };
    const strict = planMission({ registry: config.registry, requirement: need, freeOnly: true });
    const loose = planMission({ registry: config.registry, requirement: need, freeOnly: false });
    assert.ok(!strict.model.ladder.some((p) => p.billing === 'paid'));
    assert.ok(loose.model.freeFirst.every((entry) => entry.allowed === true || typeof entry.reason === 'string'), 'the free-stage decisions stay visible even when overridden');
    const strictAgents = strict.agent?.ladder.map((p) => p.id) ?? [];
    const looseAgents = loose.agent?.ladder.map((p) => p.id) ?? [];
    assert.ok(!strictAgents.includes('claude-api'), 'paid adapter is unreachable under FREE_ONLY');
    assert.ok(looseAgents.includes('claude-api'), 'and reachable exactly when an operator turned the policy off');
    const looseTrace = loose.agent?.trace.find((x) => x.stage === 'free');
    assert.match(looseTrace?.note ?? '', /FREE_ONLY disabled by operator · override: claude-api/, 'the override is written into the trace, not applied silently');
  });

  it('never lets a manifest typo open a paid path', () => {
    const config = liveConfig();
    assert.equal(config.freeOnly, true, 'the repository manifest declares FREE_ONLY');
    assert.ok(config.models.every((m) => m.freeTier), 'every model provider declares an enforceable allowance');
    assert.ok(config.models.every((m) => m.freeTier?.hardStop !== false), 'no model provider may roll over into billing');
    assert.ok(config.issues.length === 0, config.issues.map((i) => `${i.provider}: ${i.problem}`).join('; '));
  });
});
