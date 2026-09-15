// ============================================================================
// Router: the deterministic pipeline a task walks before a provider is chosen.
// ----------------------------------------------------------------------------
//   capability → health → free(FREE_ONLY) → quota → policy → ranking(score)
//
// Two routers share this pipeline and differ only in the plane they draw from:
//
//   AgentRouter  picks a whole-mission adapter (Manus/Claude/Arena) — used when the
//                task needs an agent that can edit files and open PRs.
//   ModelRouter  picks a prompt API (OpenRouter free, Gemini, Cerebras, HF,
//                Cloudflare AI, local) — the default for ordinary work.
//
// The `free` stage sits *before* ranking and *after* health on purpose: an
// exhausted allowance is a fact about the account (it should be visible even when
// the endpoint is healthy), and a dead endpoint costs nothing to check first.
// The predicate set is identical to the operator's ladder
// (available? free? quota? capability? policy?), so no provider survives one order
// and not the other — only the reason strings differ, and every reason is kept.
//
// Ranking is scored (see score.ts), not hard-coded, so tomorrow's Gemini limit
// change moves the ladder without a code change.
// ============================================================================

import { isUsable } from './health.ts';
import { checkQuota, estimateTokens, type QuotaVerdict } from './quota.ts';
import { evaluateFreeFirst, NO_FREE_PROVIDER_AVAILABLE, type FreeVerdict } from './free-first.ts';
import { formatScores, scoreProvider, type ScoreParts } from './score.ts';
import type { CapabilityRequirement, Plane, ProviderRecord } from './types.ts';

export type Stage = 'capability' | 'health' | 'free' | 'quota' | 'policy' | 'ranking';

export interface Rejection {
  provider: string;
  stage: Stage;
  reason: string;
}

export interface ScoredProvider {
  id: string;
  score: number;
  parts: ScoreParts;
}

export interface RouteDecision {
  selected: ProviderRecord | null;
  /** Eligible providers, best first — the failover ladder. */
  ladder: ProviderRecord[];
  rejected: Rejection[];
  /** Providers that would be eligible if a human approved them. */
  awaitingApproval: Array<{ provider: string; capabilities: string[] }>;
  trace: Array<{ stage: Stage; remaining: string[]; note?: string }>;
  /** Score for every provider that reached ranking, and for the rejected ones (0). */
  scores: ScoredProvider[];
  plane: Plane;
  /** `NO_FREE_PROVIDER_AVAILABLE` when FREE_ONLY is what emptied the ladder. */
  blockedReason?: typeof NO_FREE_PROVIDER_AVAILABLE | 'NO_ELIGIBLE_PROVIDER';
  /** Per-provider entitlement results, written straight to the evidence ledger. */
  freeFirst: Array<Record<string, unknown>>;
}

export interface RouteInput {
  providers: ProviderRecord[];
  requirement: CapabilityRequirement;
  prompt?: string;
  now?: number;
  /** Capability names a human has already approved for this mission. */
  grantedApprovals?: string[];
  plane?: Plane;
  /** FREE_ONLY. Default true; disabling it is an operator decision, never a default. */
  freeOnly?: boolean;
}

function hasCapabilities(provider: ProviderRecord, required: string[]): string[] {
  return required.filter((cap) => !provider.capabilities.includes(cap));
}

/** `tools.shell` and `tools:shell` both mean "this task wants the provider to act". */
const TOOL_CAPABILITY = /^tools[.:]/;

function wantsToolExecution(requirement: CapabilityRequirement): boolean {
  return requirement.capabilities.some((cap) => TOOL_CAPABILITY.test(cap));
}

export function routeProviders(input: RouteInput): RouteDecision {
  const now = input.now ?? Date.now();
  const requirement = input.requirement;
  const plane: Plane = input.plane ?? 'model';
  const freeOnly = input.freeOnly !== false;
  const rejected: Rejection[] = [];
  const awaiting: RouteDecision['awaitingApproval'] = [];
  const freeFirst: Array<Record<string, unknown>> = [];
  const trace: RouteDecision['trace'] = [];
  const runways = new Map<string, number>();
  const overrides: string[] = [];
  const record = (stage: Stage, pool: ProviderRecord[], note?: string) => {
    trace.push({ stage, remaining: pool.map((p) => p.id), note });
  };

  const typed = input.providers.filter((p) => p.kind === plane);

  // ── stage 1: capabilities ────────────────────────────────────────────────
  const capable: ProviderRecord[] = [];
  for (const provider of typed) {
    if (!provider.enabled) {
      // Availability, not capability: the operator's ladder asks "provider available?"
      // first, and a disabled entry is a platform we chose not to bind.
      rejected.push({ provider: provider.id, stage: 'health', reason: 'disabled in the manifest (enabled:false) — not available' });
      continue;
    }
    const missing = hasCapabilities(provider, requirement.capabilities);
    if (missing.length > 0) {
      rejected.push({ provider: provider.id, stage: 'capability', reason: `missing: ${missing.join(', ')}` });
      continue;
    }
    capable.push(provider);
  }
  record('capability', capable, `${typed.length} ${plane} provider(s) registered`);

  // ── stage 2: health / cooldown ───────────────────────────────────────────
  const healthy: ProviderRecord[] = [];
  for (const provider of capable) {
    if (!isUsable(provider, now)) {
      const cooling = typeof provider.cooldownUntil === 'number' && provider.cooldownUntil > now;
      rejected.push({
        provider: provider.id,
        stage: 'health',
        reason: cooling
          ? `cooldown for another ${Math.ceil((provider.cooldownUntil - now) / 1000)}s (last: ${provider.probe?.reason ?? provider.health})`
          : `state=${provider.health}${provider.probe?.reason ? ` (${provider.probe.reason})` : ''}`,
      });
      continue;
    }
    healthy.push(provider);
  }
  record('health', healthy, healthy.length < capable.length ? `${capable.length - healthy.length} in cooldown or down` : undefined);

  // ── stage 3: FREE_ONLY entitlement ───────────────────────────────────────
  const entitled: ProviderRecord[] = [];
  for (const provider of healthy) {
    const verdict: FreeVerdict = evaluateFreeFirst({ record: provider, requirement, plane, now });
    freeFirst.push({ provider: provider.id, plane, ...verdict.evidence, allowed: verdict.allowed, reason: verdict.reason });
    if (verdict.allowed) {
      runways.set(provider.id, verdict.runway);
      entitled.push(provider);
      continue;
    }
    // The gate is on: honour the refusal. It is off (operator flag) and the refusal
    // was purely "this is a paid API": log it and continue, since `freeOnly=false`
    // is an explicit human decision rather than an automatic upgrade.
    if (!freeOnly && verdict.evidence.verdict === 'BLOCKED_PAID') {
      runways.set(provider.id, 0.2);
      entitled.push(provider);
      overrides.push(`${provider.id} (paid, operator override)`);
      continue;
    }
    rejected.push({ provider: provider.id, stage: verdict.stage, reason: verdict.reason });
  }
  record('free', entitled, [freeOnly ? 'FREE_ONLY enforced' : 'FREE_ONLY disabled by operator', ...(overrides.length ? [`override: ${overrides.join(', ')}`] : [])].join(' · '));

  // ── stage 4: request pacing (per-minute) ────────────────────────────────
  const estimate = estimateTokens(requirement, input.prompt);
  const affordable: ProviderRecord[] = [];
  for (const provider of entitled) {
    const ceiling = requirement.maxCostPer1kUsd;
    if (freeOnly && ceiling !== undefined && (provider.costPer1kTokensUsd ?? 0) > ceiling) {
      rejected.push({
        provider: provider.id,
        stage: 'quota',
        reason: `cost $${(provider.costPer1kTokensUsd ?? 0).toFixed(4)}/1k exceeds requirement.maxCostPer1kUsd $${ceiling.toFixed(4)}/1k`,
      });
      continue;
    }
    const verdict: QuotaVerdict = checkQuota(provider, estimate, now);
    if (!verdict.allowed) {
      rejected.push({ provider: provider.id, stage: 'quota', reason: `${verdict.state}: ${verdict.reason}` });
      continue;
    }
    affordable.push(provider);
  }
  record('quota', affordable, `estimate ${estimate.promptTokens}+${estimate.completionTokens} tokens`);

  // ── stage 5: policy ─────────────────────────────────────────────────────
  const granted = new Set([...(input.grantedApprovals ?? []), ...(requirement.approvals ?? [])]);
  const permitted: ProviderRecord[] = [];
  for (const provider of affordable) {
    if (requirement.mustBeLocal && provider.policy.dataBoundary && provider.policy.dataBoundary !== 'local-only') {
      rejected.push({ provider: provider.id, stage: 'policy', reason: `dataBoundary=${provider.policy.dataBoundary}, task requires local-only` });
      continue;
    }
    const needs = provider.policy.requiresApprovalFor.filter((cap) => requirement.capabilities.includes(cap) && !granted.has(cap));
    if (needs.length > 0) {
      awaiting.push({ provider: provider.id, capabilities: needs });
      rejected.push({ provider: provider.id, stage: 'policy', reason: `approval required for: ${needs.join(', ')}` });
      continue;
    }
    if (!provider.policy.allowAutoExecute && wantsToolExecution(requirement)) {
      rejected.push({ provider: provider.id, stage: 'policy', reason: 'allowAutoExecute=false and the task needs tool execution' });
      continue;
    }
    permitted.push(provider);
  }
  record('policy', permitted, awaiting.length ? `${awaiting.length} awaiting approval` : undefined);

  // ── stage 6: scored ranking ──────────────────────────────────────────────
  const scored: ScoredProvider[] = permitted.map((provider) => ({
    id: provider.id,
    ...scoreProvider(provider, { requirement, now, runway: runways.get(provider.id) }),
  }));
  const byId = new Map(permitted.map((p) => [p.id, p]));
  const ranked = [...scored]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((entry) => byId.get(entry.id))
    .filter((p): p is ProviderRecord => p !== undefined);

  const allScores = [...scored, ...rejected.map((r) => ({ id: r.provider, score: 0, parts: emptyParts() }))].sort((a, b) => b.score - a.score);
  record('ranking', ranked, formatScores([...scored].sort((a, b) => b.score - a.score)));

  // Which kind of empty ladder is this? "no free provider" and "no provider" are
  // different incidents with different fixes, so they get different outcome names.
  // A provider that was never a candidate for this task (missing capability, or
  // disabled in the manifest) does not get to change the label.
  const isQuotaOrFree = (r: Rejection) =>
    r.stage === 'free' || (r.stage === 'quota' && /allowance exhausted|trial credit spent|window exhausted|usd: need|tokens: need/.test(r.reason));
  const wasCandidate = (r: Rejection) => !(r.stage === 'capability' || (r.stage === 'health' && /disabled in the manifest/.test(r.reason)));
  const candidates = rejected.filter(wasCandidate);
  const blocked =
    ranked.length === 0
      ? candidates.length > 0 && candidates.every(isQuotaOrFree)
        ? NO_FREE_PROVIDER_AVAILABLE
        : ('NO_ELIGIBLE_PROVIDER' as const)
      : undefined;

  return {
    selected: ranked[0] ?? null,
    ladder: ranked,
    rejected,
    awaitingApproval: awaiting,
    trace,
    scores: allScores,
    plane,
    blockedReason: blocked,
    freeFirst,
  };
}

function emptyParts(): ScoreParts {
  return { capability: 0, availability: 0, quota: 0, latency: 0, reliability: 0, taskFit: 0, penalty: 0, bias: 0 };
}

/** Agent Router: whole-mission adapters only. */
export function routeAgents(input: Omit<RouteInput, 'plane'>): RouteDecision {
  return routeProviders({ ...input, plane: 'agent' });
}

/** Model Router: the free-first prompt APIs, i.e. the default operating layer. */
export function routeModels(input: Omit<RouteInput, 'plane'>): RouteDecision {
  return routeProviders({ ...input, plane: 'model' });
}

export function formatDecision(decision: RouteDecision): string {
  const lines = decision.trace.map((step) => `  ${step.stage.padEnd(10)} → ${step.remaining.join(', ') || '(none)'}${step.note ? `   [${step.note}]` : ''}`);
  const rejects = decision.rejected.map((r) => `  ! ${r.provider} @ ${r.stage}: ${r.reason}`);
  const header = `plane: ${decision.plane} · selected: ${decision.selected?.id ?? 'NONE'}`;
  const blocked = decision.blockedReason ? [`blocked: ${decision.blockedReason}`] : [];
  return [header, ...lines, ...blocked, ...(rejects.length ? ['', 'rejected:'] : []), ...rejects].join('\n');
}
