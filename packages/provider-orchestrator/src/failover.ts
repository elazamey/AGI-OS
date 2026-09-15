// ============================================================================
// Failover: the ladder Arena → OpenRouter → HF → Local → BLOCKED.
// ----------------------------------------------------------------------------
// Two rules, both learned from the deployment it replaced:
//   1. a failed provider is *recorded* and put on cooldown before the next one is
//      tried, so the ladder never re-enters the provider that just refused it;
//   2. exhaustion is a first-class outcome (BLOCKED with the hop trace), never a
//      silent retry loop — an agent that cannot reach a model must say so.
// ============================================================================

import { applyProbe, type CooldownOptions } from './health.ts';
import { consumeQuota, estimateTokens } from './quota.ts';
import { consumeAllowance } from './free-first.ts';
import { routeProviders } from './router.ts';
import type { ProviderRegistry } from './registry.ts';
import type { CapabilityRequirement, Plane, ProviderRecord } from './types.ts';

export interface Hop {
  provider: string;
  attempt: number;
  outcome: 'ok' | 'failed';
  ms: number;
  error?: string;
  classification?: string;
}

export interface LadderInput<A> {
  registry: ProviderRegistry;
  requirement: CapabilityRequirement;
  prompt?: string;
  grantedApprovals?: string[];
  /** Which router runs the ladder. Model plane is FREE_ONLY-enforced by default. */
  plane?: Plane;
  /** Default true. Only an operator flag may set it false, and it is recorded. */
  freeOnly?: boolean;
  maxAttempts?: number;
  cooldown?: CooldownOptions;
  invoke: (provider: ProviderRecord, attempt: number) => Promise<A>;
  onEvent?: (event: { type: string; [key: string]: unknown }) => void;
  now?: () => number;
}

export type LadderResult<A> =
  | { status: 'OK'; provider: string; result: A; hops: Hop[]; usageTokens: number }
  | { status: 'BLOCKED'; reason: string; hops: Hop[]; rejected: ReturnType<typeof routeProviders>['rejected']; awaitingApproval: ReturnType<typeof routeProviders>['awaitingApproval'] };

/**
 * Turn an arbitrary failure into a health classification. Substring matching here
 * is deliberate: SDK errors are strings, and the quota/rate-limit distinction is
 * what decides whether the provider goes on a long cooldown or a short one.
 */
export function classifyError(error: unknown): { state: 'rate_limited' | 'quota_exceeded' | 'unhealthy'; message: string } {
  const err = error as { message?: string; status?: number; code?: string; name?: string };
  const message = String(err?.message ?? error ?? 'unknown error');
  const status = Number(err?.status ?? 0);
  if (status === 429 || /\b429\b|rate.?limit|too many requests/i.test(message)) return { state: 'rate_limited', message };
  if (status === 402 || /quota|insufficient|billing|spend limit|exceeded/i.test(message)) return { state: 'quota_exceeded', message };
  return { state: 'unhealthy', message };
}

export async function runLadder<A>(input: LadderInput<A>): Promise<LadderResult<A>> {
  const now = input.now ?? (() => Date.now());
  const maxAttempts = input.maxAttempts ?? 4;
  const hops: Hop[] = [];
  const excluded = new Set<string>();
  const estimate = estimateTokens(input.requirement, input.prompt);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const decision = routeProviders({
      providers: input.registry.all(input.plane ?? 'model'),
      requirement: input.requirement,
      prompt: input.prompt,
      grantedApprovals: input.grantedApprovals,
      plane: input.plane ?? 'model',
      freeOnly: input.freeOnly !== false,
      now: now(),
    });

    const candidate = decision.ladder.find((p) => !excluded.has(p.id));
    if (!candidate) {
      return {
        status: 'BLOCKED',
        reason: decision.blockedReason
          ? `${decision.blockedReason}${hops.length ? ` after ${hops.length} failed hop(s)` : ''}`
          : hops.length
            ? `every eligible provider failed or was excluded after ${hops.length} hop(s)`
            : 'no provider is eligible for this task',
        hops,
        rejected: decision.rejected,
        awaitingApproval: decision.awaitingApproval,
      };
    }

    input.onEvent?.({ type: 'hop:start', provider: candidate.id, attempt, ts: now() });
    const started = now();
    try {
      const result = await input.invoke(candidate, attempt);
      const ms = now() - started;
      hops.push({ provider: candidate.id, attempt, outcome: 'ok', ms });
      // Success consumes three things: the request window, the free allowance, and the
      // failure streak. Allowing the call but not charging the allowance is how a "free"
      // tier quietly becomes a bill.
      const charged = consumeAllowance(consumeQuota(candidate, estimate, started), estimate.promptTokens + estimate.completionTokens, started);
      input.registry.replace(
        applyProbe(charged, { at: started, state: 'available', latencyMs: ms, reason: 'call succeeded' }, input.cooldown),
      );
      input.onEvent?.({ type: 'allowance', provider: candidate.id, units: estimate.promptTokens + estimate.completionTokens, remaining: charged.freeTier?.remaining ?? null });
      input.onEvent?.({ type: 'hop:ok', provider: candidate.id, attempt, ms, ts: now() });
      return {
        status: 'OK',
        provider: candidate.id,
        result,
        hops,
        usageTokens: estimate.promptTokens + estimate.completionTokens,
      };
    } catch (error) {
      const ms = now() - started;
      const { state, message } = classifyError(error);
      hops.push({ provider: candidate.id, attempt, outcome: 'failed', ms, error: message, classification: state });
      input.registry.replace(
        applyProbe(candidate, { at: now(), state, reason: message.slice(0, 300), latencyMs: ms }, input.cooldown),
      );
      excluded.add(candidate.id);
      input.onEvent?.({ type: 'hop:failed', provider: candidate.id, attempt, state, error: message.slice(0, 300), ts: now() });
    }
  }

  return {
    status: 'BLOCKED',
    reason: `attempt budget (${maxAttempts}) exhausted without a successful provider`,
    hops,
    rejected: [],
    awaitingApproval: [],
  };
}
