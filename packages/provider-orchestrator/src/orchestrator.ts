// ============================================================================
// Orchestrator: the one place that decides *which router* runs.
// ----------------------------------------------------------------------------
// The operator's diagram, in code:
//
//   Any AI Agent → Agent Router → Free-First Model Router → providers → Local → BLOCKED
//                                    ↓
//                              AGI-OS Execution → GitHub → CI/CD → Vercel/HF/Cloudflare
//                                                          → Certification → Evidence
//
// Two consequences worth stating, because they are the reason this file exists:
//
// 1. The agent adapter is interchangeable. Manus today, Arena tomorrow — the
//    deployment pipeline downstream does not read the provider id, so switching
//    mid-mission cannot break a publish.
// 2. The *model* layer is chosen by FREE_ONLY + score every call. No code path
//    lets an agent decide to start paying: that needs a manifest edit plus an
//    approval token.
// ============================================================================

import { routeAgents, routeModels, type RouteDecision } from './router.ts';
import type { ProviderRegistry } from './registry.ts';
import type { CapabilityRequirement, Plane, ProviderRecord } from './types.ts';

/** Capabilities that only a whole-mission adapter can satisfy — they imply an agent. */
const AGENT_ONLY_CAPABILITIES = ['repo.work', 'tools.shell', 'browser', 'deploy:production'];

export function impliesAgentAdapter(requirement: CapabilityRequirement): boolean {
  return requirement.capabilities.some((cap) => AGENT_ONLY_CAPABILITIES.includes(cap));
}

export interface MissionPlan {
  /** Which plane will actually run the work. */
  plane: Plane;
  /** `NO_FREE_PROVIDER_AVAILABLE` when FREE_ONLY is what emptied both planes. */
  blockedReason?: string;
  provider: ProviderRecord | null;
  score: number;
  /** Ordered fallbacks for the chosen plane — the failover ladder. */
  ladder: ProviderRecord[];
  /** The agent decision, when one was taken (it explains an `agent` plane choice). */
  agent: RouteDecision | null;
  /** Always computed: even under an agent adapter, the model ladder is the fallback. */
  model: RouteDecision;
  reason: string;
}

export interface MissionPlanInput {
  registry: ProviderRegistry;
  requirement: CapabilityRequirement;
  prompt?: string;
  grantedApprovals?: string[];
  freeOnly?: boolean;
  now?: number;
  onEvent?: (event: Record<string, unknown>) => void;
}

export function planMission(input: MissionPlanInput): MissionPlan {
  const freeOnly = input.freeOnly !== false;
  const shared = {
    providers: input.registry.all(),
    requirement: input.requirement,
    prompt: input.prompt,
    grantedApprovals: input.grantedApprovals,
    freeOnly,
    now: input.now,
  };

  // The model plane is always evaluated: it is the fallback for every agent, and it
  // is the plane FREE_ONLY protects.
  const model = routeModels(shared);
  // `auto`: a task that needs to touch a repo or run tools is an agent job; a prompt
  // task never asks an adapter to do what a free model can do for a fraction of the cost.
  const wantsAgent = input.requirement.autonomy === 'full-mission' || (input.requirement.autonomy !== 'prompt' && impliesAgentAdapter(input.requirement));
  const agent = wantsAgent ? routeAgents(shared) : null;
  input.onEvent?.({ type: 'plan:model', plane: 'model', freeOnly, selected: model.selected?.id ?? null, blockedReason: model.blockedReason ?? null, scores: model.scores.map((s) => ({ id: s.id, score: s.score })) });
  if (agent) {
    input.onEvent?.({ type: 'plan:agent', plane: 'agent', freeOnly, selected: agent.selected?.id ?? null, blockedReason: agent.blockedReason ?? null, scores: agent.scores.map((s) => ({ id: s.id, score: s.score })) });
  }

  const chosen = agent?.selected ?? model.selected;
  const decision = agent?.selected ? agent : model;
  const plane: Plane = agent?.selected ? 'agent' : 'model';
  const score = decision.scores.find((s) => s.id === chosen?.id)?.score ?? 0;

  const blockedReason = model.blockedReason ?? 'NO_ELIGIBLE_PROVIDER';
  const reason = chosen
    ? plane === 'agent'
      ? `agent adapter "${chosen.id}" is available and valid; model ladder kept as fallback (${model.selected?.id ?? blockedReason})`
      : `free-first model provider "${chosen.id}" scored ${score}; agent plane ${wantsAgent ? 'had no available adapter' : 'not requested'}`
    : `${blockedReason} → BLOCKED: ${[...model.rejected, ...(agent?.rejected ?? [])].map((r) => `${r.provider}@${r.stage}`).join(', ') || 'no provider registered'}`;

  return {
    plane,
    provider: chosen,
    score,
    /** Set only when nothing was chosen: the reason the mission stops. */
    blockedReason: chosen ? undefined : blockedReason,
    ladder: decision.ladder,
    agent,
    model,
    reason,
  };
}

export function formatPlan(plan: MissionPlan): string {
  const lines = [
    `plane:    ${plan.plane}`,
    `provider: ${plan.provider?.id ?? 'NONE'}${plan.provider ? ` (score ${plan.score})` : ''}`,
    `reason:   ${plan.reason}`,
    '',
    'model ladder (fallback order):',
  ];
  if (plan.model.ladder.length === 0) lines.push('  (empty — BLOCKED)');
  for (const [index, provider] of plan.model.ladder.entries()) {
    const entry = plan.model.scores.find((s) => s.id === provider.id);
    lines.push(`  ${index + 1}. ${provider.id.padEnd(18)} score ${String(entry?.score ?? '?').padStart(3)}  ${provider.model ?? ''}  ${provider.freeTier ? `${provider.freeTier.basis} ≤ ${provider.freeTier.limit}` : 'no declared allowance'}`);
  }
  if (plan.agent) {
    lines.push('', 'agent plane:');
    lines.push(`  selected: ${plan.agent.selected?.id ?? 'none'}`);
    for (const rejection of plan.agent.rejected) lines.push(`  ! ${rejection.provider} @ ${rejection.stage}: ${rejection.reason}`);
  }
  if (!plan.provider && plan.blockedReason) lines.push('', `blocked: ${plan.blockedReason}`);
  return lines.join('\n');
}
