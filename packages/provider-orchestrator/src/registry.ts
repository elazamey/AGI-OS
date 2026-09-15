// ============================================================================
// Registry: who exists, what they can do, and what we last saw them do.
// ----------------------------------------------------------------------------
// Loaded from a JSON manifest (default: `agi-os-providers.json` at the repo root)
// so an operator can add or disable a provider without touching code, and so CI
// can point at a fixture. Parsing is strict and reports what it rejected instead
// of silently dropping a provider — a typo'd capability that quietly disappears
// from the registry turns into "no provider matched" with no explanation.
// ============================================================================

import { readFileSync } from 'node:fs';
import type { BillingModel, FreeTier, HealthState, ProviderKind, ProviderPolicy, ProviderRecord, QuotaState } from './types.ts';

export const KINDS: ProviderKind[] = ['agent', 'model', 'deployment', 'verification'];

export interface RegistryIssue {
  provider: string;
  problem: string;
}

export interface RegistrySnapshot {
  providers: ProviderRecord[];
  issues: RegistryIssue[];
  source: string;
}

interface RawProvider {
  id?: string;
  kind?: string;
  label?: string;
  capabilities?: string[];
  priority?: number;
  enabled?: boolean;
  model?: string;
  baseUrl?: string;
  quota?: QuotaState;
  policy?: Partial<ProviderPolicy>;
  costPer1kTokensUsd?: number;
  notes?: string;
  health?: string;
  billing?: string;
  freeTier?: Partial<import('./types.ts').FreeTier>;
  freeModels?: string[];
  taskFit?: string[];
  accountNotes?: string;
  paidOverride?: boolean;
  lastLatencyMs?: number;
  cooldownUntil?: number | null;
  consecutiveFailures?: number;
}

const BILLING: BillingModel[] = ['free-tier', 'trial-credit', 'subscription', 'paid'];

const HEALTH: HealthState[] = ['unknown', 'available', 'degraded', 'rate_limited', 'quota_exceeded', 'unhealthy', 'cooldown'];

const DEFAULT_POLICY: ProviderPolicy = { allowAutoExecute: false, requiresApprovalFor: ['deploy:production'], dataBoundary: 'any' };

function normalise(raw: RawProvider, index: number, kind: ProviderKind): { record?: ProviderRecord; issue?: RegistryIssue } {
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `${kind}-${index}`;
  if (typeof raw.kind === 'string' && !KINDS.includes(raw.kind as ProviderKind)) {
    return { issue: { provider: id, problem: `unknown kind "${raw.kind}" (expected ${KINDS.join('|')})` } };
  }
  if (raw.capabilities === undefined && (kind === 'deployment' || kind === 'verification')) {
    // Only the two routing planes need a capability list; a deployment target is
    // addressed by url and a verification step by label, so demanding capabilities
    // there would be ceremony — and a *wrong* one, since `deployments[]` is also
    // parsed by config.ts into DeploymentConfig.
    raw = { ...raw, capabilities: [] };
  } else if (!Array.isArray(raw.capabilities) || raw.capabilities.some((c) => typeof c !== 'string' || !c)) {
    return { issue: { provider: id, problem: 'capabilities must be an array of strings' } };
  }
  let billing: BillingModel | undefined;
  if (raw.billing !== undefined) {
    if (!BILLING.includes(raw.billing as BillingModel)) {
      return { issue: { provider: id, problem: `unknown billing "${raw.billing}" (expected ${BILLING.join('|')})` } };
    }
    billing = raw.billing as BillingModel;
  }
  const freeTier = normaliseFreeTier(raw.freeTier);
  if (freeTier.issue) return { issue: { provider: id, problem: freeTier.issue } };
  if (billing === 'free-tier' && !freeTier.tier) {
    return { issue: { provider: id, problem: 'billing=free-tier with no freeTier declares an allowance we cannot enforce — add freeTier or use billing=subscription' } };
  }

  return {
    record: {
      id,
      kind,
      label: raw.label ?? id,
      capabilities: raw.capabilities as string[],
      health: HEALTH.includes(raw.health as HealthState) ? (raw.health as HealthState) : 'unknown',
      priority: typeof raw.priority === 'number' ? raw.priority : 100,
      enabled: raw.enabled !== false,
      model: raw.model,
      baseUrl: raw.baseUrl,
      quota: raw.quota ?? {},
      policy: { ...DEFAULT_POLICY, ...(raw.policy ?? {}) },
      costPer1kTokensUsd: raw.costPer1kTokensUsd,
      notes: raw.notes,
      billing,
      freeTier: freeTier.tier,
      freeModels: raw.freeModels,
      taskFit: raw.taskFit,
      accountNotes: raw.accountNotes,
      paidOverride: raw.paidOverride === true,
      lastLatencyMs: raw.lastLatencyMs,
      probe: null,
      cooldownUntil: typeof raw.cooldownUntil === 'number' ? raw.cooldownUntil : null,
      consecutiveFailures: typeof raw.consecutiveFailures === 'number' ? raw.consecutiveFailures : 0,
    },
  };
}

function normaliseFreeTier(raw: Partial<FreeTier> | undefined): { tier?: FreeTier; issue?: string } {
  if (raw === undefined) return {};
  const basis = raw.basis;
  const BASES: FreeTier['basis'][] = ['requests-per-day', 'neurons-per-day', 'tokens-per-day', 'tokens-per-minute', 'usd-per-month', 'trial-usd', 'unlimited-local'];
  if (!basis || !BASES.includes(basis)) return { issue: `freeTier.basis must be one of ${BASES.join('|')}` };
  const limit = Number(raw.limit);
  if (!Number.isFinite(limit) || limit < 0) return { issue: 'freeTier.limit must be a number ≥ 0' };
  if (basis !== 'unlimited-local' && limit === 0) return { issue: 'freeTier.limit 0 declares a provider with no allowance — remove the entry or set it enabled:false' };
  if (raw.hardStop === false && (basis === 'usd-per-month' || basis === 'trial-usd')) {
    return { issue: `hardStop:false on a ${basis} tier allows the router to cross into pay-as-you-go — forbidden by FREE_ONLY` };
  }
  const tier: FreeTier = { basis, limit, hardStop: raw.hardStop !== false };
  if (typeof raw.used === 'number' && Number.isFinite(raw.used)) tier.used = Math.max(0, raw.used);
  if (typeof raw.remaining === 'number' && Number.isFinite(raw.remaining)) tier.remaining = Math.max(0, raw.remaining);
  if (typeof raw.resetsAt === 'number' && Number.isFinite(raw.resetsAt)) tier.resetsAt = raw.resetsAt;
  if (Array.isArray(raw.freeModels)) tier.freeModels = raw.freeModels.filter((m): m is string => typeof m === 'string' && m.length > 0);
  if (typeof raw.source === 'string') tier.source = raw.source;
  return { tier };
}

export interface Manifest {
  /** Whole-mission adapters (Manus/Claude/Arena/Codex). */
  agents?: RawProvider[];
  /** Prompt APIs: the free-first operating layer. */
  models?: RawProvider[];
  deployments?: RawProvider[];
  verifications?: RawProvider[];
  defaults?: Record<string, unknown>;
}

export function registryFromManifest(manifest: Manifest, source = '<object>'): RegistrySnapshot {
  const providers: ProviderRecord[] = [];
  const issues: RegistryIssue[] = [];
  const groups: Array<[ProviderKind, RawProvider[] | undefined]> = [
    ['agent', manifest.agents],
    ['model', manifest.models],
    ['deployment', manifest.deployments],
    ['verification', manifest.verifications],
  ];
  for (const [kind, list] of groups) {
    (list ?? []).forEach((raw, index) => {
      const { record, issue } = normalise(raw, index, kind);
      if (issue) issues.push(issue);
      if (record) providers.push(record);
    });
  }
  const seen = new Set<string>();
  for (const provider of providers) {
    if (seen.has(provider.id)) issues.push({ provider: provider.id, problem: 'duplicate id — the later entry is ignored' });
    seen.add(provider.id);
  }
  const deduped = providers.filter((p, i) => providers.findIndex((q) => q.id === p.id) === i);
  return { providers: deduped, issues, source };
}

/** Parse already-read text (used by the config loader, which expands `${VAR}` first). */
export function parseRegistry(text: string, source = '<string>'): RegistrySnapshot {
  let parsed: Manifest;
  try {
    parsed = JSON.parse(text) as Manifest;
  } catch (error) {
    throw new Error(`provider registry: invalid JSON in ${source}: ${(error as Error).message}`);
  }
  return registryFromManifest(parsed, source);
}

export function loadRegistry(file: string): RegistrySnapshot {
  return parseRegistry(readFileSync(file, 'utf8'), file);
}

export class ProviderRegistry {
  private records: Map<string, ProviderRecord>;
  readonly issues: RegistryIssue[];

  constructor(snapshot: RegistrySnapshot) {
    this.records = new Map(snapshot.providers.map((p) => [p.id, p]));
    this.issues = snapshot.issues;
  }

  static fromFile(file: string): ProviderRegistry {
    return new ProviderRegistry(loadRegistry(file));
  }

  get(id: string): ProviderRecord | undefined {
    return this.records.get(id);
  }

  all(kind?: ProviderKind): ProviderRecord[] {
    return [...this.records.values()].filter((p) => (kind ? p.kind === kind : true));
  }

  upsert(record: ProviderRecord): void {
    this.records.set(record.id, record);
  }

  /** Replace one record immutably (used after probes/quota consumption). */
  replace(record: ProviderRecord): void {
    if (!this.records.has(record.id)) throw new Error(`unknown provider: ${record.id}`);
    this.records.set(record.id, record);
  }
}
