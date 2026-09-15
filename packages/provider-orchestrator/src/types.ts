// ============================================================================
// Shared vocabulary for the control plane.
// ----------------------------------------------------------------------------
// The four kinds below are deliberately separate types, not one "provider" union
// with optional fields, because conflating them is how this class of bug happens:
// a platform that *runs models* gets treated as a platform that *publishes
// output*, and a platform that reports "Ready" gets treated as evidence that the
// thing works.
//
//   agent         runs the mission end to end   (Arena, Claude, Manus, Codex)  ← Agent Router
//   model         completes prompts             (OpenRouter, Gemini, Cerebras,
//                                                HF, Cloudflare AI, local)      ← Model Router
//   deployment    publishes the artefact         (Vercel, HF Space, Cloudflare Pages)
//   verification  proves the artefact works      (HTTP probe, certification, browser)
//
// An agent adapter is not a cheaper model and a model API is not an agent: the
// agent plane may edit the repo and open PRs, the model plane answers prompts.
// They are routed by different routers and share one policy — FREE_ONLY, below.
//
// "Ready" is an attribute of the deployment plane. Only the verification plane can
// produce VERIFIED — and that is the whole point of `gate.ts`.
// ============================================================================

export type ProviderKind = 'agent' | 'model' | 'deployment' | 'verification';

/** Which router is choosing. `agent` = whole-mission adapter, `model` = prompt API. */
export type Plane = 'agent' | 'model';

/** Liveness/quota state of a provider as last observed. */
export type HealthState =
  | 'unknown'
  | 'available'
  | 'degraded'
  | 'rate_limited'
  | 'quota_exceeded'
  | 'unhealthy'
  | 'cooldown';

export type DeploymentStatus = 'DEPLOYED' | 'FAILED' | 'BLOCKED';

/**
 * Gate verdicts. `BLOCKED` and `DEGRADED` are distinct on purpose: BLOCKED means
 * "do not ship / do not claim", DEGRADED means "shipped, but unproven" — which
 * still withholds certification but must not be reported as an outage.
 */
export type GateStatus = 'VERIFIED' | 'DEGRADED' | 'BLOCKED';

/**
 * How a provider is billed. This is the field `FREE_ONLY` reads, so it is a
 * *declared fact about the account*, not a price: a provider with no free tier is
 * unreachable by automation no matter how capable it is.
 */
export type BillingModel =
  /** Has a published free allowance (OpenRouter `openrouter/free`, Gemini, Cloudflare Workers AI). */
  | 'free-tier'
  /** A finite grant that, once spent, converts to pay-as-you-go (Cerebras trial credit, HF monthly credit). */
  | 'trial-credit'
  /** Paid by subscription instead of per call (agent adapters on an existing plan). */
  | 'subscription'
  /** Metered per call with no free allowance. Never auto-selected. */
  | 'paid';

/** The shape of a free allowance, because "free" means something different on every platform. */
export interface FreeTier {
  basis:
    | 'requests-per-day'
    | 'neurons-per-day'
    | 'tokens-per-day'
    | 'tokens-per-minute'
    | 'usd-per-month'
    | 'trial-usd'
    | 'unlimited-local';
  /** What we enforce locally. Deliberately ≤ the published allowance: a guard that is
   *  looser than the platform is a guard that fails open. */
  limit: number;
  used?: number;
  /** Unknown until the first call; treated as "assume free, count down from the limit". */
  remaining?: number;
  resetsAt?: number;
  /**
   * At zero, stop. `false` would let the call go through and be billed — which is
   * exactly the auto-upgrade this policy exists to prevent (HF flips to
   * pay-as-you-go the moment its monthly credit runs out).
   */
  hardStop: boolean;
  /** Only these model ids are on the free plan; free tiers are per-model, not per-account. */
  freeModels?: string[];
  /** Where the number above came from, so a stale limit is auditable. */
  source?: string;
}

export interface CapabilityRequirement {
  /** Every listed capability must be present on the provider. */
  capabilities: string[];
  /** Shape of the work, used for task-fit scoring. */
  taskKind?: 'chat' | 'coding' | 'reasoning' | 'embedding' | 'vision' | 'fast-experiment';
  /** Data-boundary escape hatch: refuse anything that is not local-only. */
  mustBeLocal?: boolean;
  /** Cost ceiling per 1k tokens, in USD. */
  maxCostPer1kUsd?: number;
  /** Minimum estimated tokens the provider must be able to afford right now. */
  minTokens?: number;
/** Ranking bias when two providers tie on priority. */
  prefer?: 'cheapest' | 'fastest' | 'balanced';
  /** Ask the Agent Router first (whole-mission adapter); model-only tasks skip it. */
  autonomy?: 'prompt' | 'full-mission';
  /** Specific model to request; checked against the provider's free model list. */
  model?: string;
  /** Operator decision recorded in the mission: use a paid provider despite FREE_ONLY. */
  allowPaidOverride?: boolean;
  /** Approval tokens the mission carries, e.g. `['paid:override']`. */
  approvals?: string[];
}

/** A provider's declared billing facts, as read from the manifest. */
export interface BillingProfile {
  billing: BillingModel;
  freeTier?: FreeTier;
  /** Set only by an explicit human decision, never by the router. */
  allowPaidOverride?: boolean;
}

export interface QuotaState {
  requestsPerMinute?: number;
  requestsThisMinute?: number;
  tokensRemaining?: number;
  usdRemaining?: number;
  windowStartedAt?: number;
}

export interface ProviderPolicy {
  /** Deny-by-default: an agent provider may not auto-execute tools unless allowed. */
  allowAutoExecute: boolean;
  /** Capability names that require a human before use (e.g. `deploy:production`). */
  requiresApprovalFor: string[];
  dataBoundary?: 'local-only' | 'approved-cloud' | 'any';
}

export interface ProbeResult {
  at: number;
  state: HealthState;
  httpStatus?: number;
  latencyMs?: number;
  reason?: string;
}

export interface ProviderRecord {
  id: string;
  kind: ProviderKind;
  label: string;
  capabilities: string[];
  health: HealthState;
  /** Lower number wins when everything else is equal. */
  priority: number;
  enabled: boolean;
  model?: string;
  baseUrl?: string;
  quota: QuotaState;
  policy: ProviderPolicy;
  /** Explicit human grant that lifts FREE_ONLY for one mission. Never set by code. */
  paidOverride?: boolean;
  /** Plane the provider belongs to for routing (mirrors `kind` for agent/model). */
  billing?: BillingModel;
  freeTier?: FreeTier;
  /** Model ids this provider serves on the free plan; `model` field is the default. */
  freeModels?: string[];
  /** Task kinds this provider is good at — feeds task-fit, so a coding task does not
   *  land on a chat model that happens to be free and idle. */
  taskFit?: string[];
  /** Operator notes about the account this entry describes (rate limits change). */
  accountNotes?: string;
  probe?: ProbeResult | null;
  /** Epoch ms; the provider is ineligible until then (failover cooldown). */
  cooldownUntil?: number | null;
  consecutiveFailures?: number;
  costPer1kTokensUsd?: number;
  lastLatencyMs?: number;
  notes?: string;
}

/** Context handed to a publishing target. */
export interface DeployContext {
  /** Commit being published; carried into evidence so a verdict names its input. */
  commit: string;
  ref: string;
  /** Working tree to publish (e.g. `apps/hf-backend`). */
  workdir: string;
  env?: Record<string, string>;
  dryRun?: boolean;
}

/** Exactly the shape the operator specified for deployment results. */
export interface DeploymentResult {
  provider: string;
  deploymentId: string;
  url?: string;
  status: DeploymentStatus;
  evidence?: Record<string, unknown>;
}

export interface StepCheck {
  label: string;
  ok: boolean;
  detail?: string;
  /** Set when the step could not be evaluated at all (skipped ≠ passed). */
  skipped?: boolean;
}

export interface VerificationVerdict {
  frontend: 'PASS' | 'FAIL' | 'SKIP';
  frontend_http: number;
  backend: 'PASS' | 'FAIL' | 'SKIP';
  backend_health: number;
  api_contract: 'PASS' | 'FAIL' | 'SKIP';
  deployment: GateStatus;
  checks: StepCheck[];
  durationMs: number;
  reasons: string[];
}

export interface EvidenceSink {
  write(event: Record<string, unknown>): void;
  readonly path: string;
}
