// ============================================================================
// Config: where the control plane reads the real topology from.
// ----------------------------------------------------------------------------
// `agi-os-providers.json` at the repo root is the single declaration of the two
// routing planes and the deployment targets:
//
//   agents[]   whole-mission adapters — optional, gated on account validity
//   models[]   free-first prompt APIs — the operating layer
//   deployments[]  who publishes the artefact
//   verification   what proves the published artefact works
//
// Secrets never live in it: `${VAR}` indirection (with a documented fallback) so a
// reviewer can see exactly what a job needs without pasting tokens into git.
// Parsing is shared with `registry.ts`, so a config that could start a bill is
// rejected here rather than at invoice time.
// ============================================================================

import { readFileSync } from 'node:fs';
import { parseRegistry, ProviderRegistry, type RegistryIssue } from './registry.ts';
import type { CapabilityRequirement, ProviderRecord } from './types.ts';

export interface DeploymentConfig {
  id: string;
  url: string;
  /** observe = the platform deploys itself; publish = we push. */
  mode: 'observe' | 'publish';
  enabled: boolean;
  spaceRepo?: string;
  /** Marker strings that prove we reached the app we think we reached. */
  markers?: string[];
  /** Backend base URL for the functional chain (Vercel UI → HF API). */
  backendBaseUrl?: string;
  notes?: string;
}

export interface VerificationConfig {
  timeoutMs: number;
  requireContract: boolean;
  /** Live probes to the published deployment; off by default so unit runs stay hermetic. */
  probeLive: boolean;
  bearerEnv?: string;
}

export interface ControlPlaneConfig {
  version: number;
  registry: ProviderRegistry;
  agents: ProviderRecord[];
  models: ProviderRecord[];
  deployments: DeploymentConfig[];
  verifications: Array<{ id: string; kind: 'verification'; notes?: string }>;
  verification: VerificationConfig;
  defaultRequirement: CapabilityRequirement;
  /** FREE_ONLY. Read from the manifest; `false` here is a written-down decision. */
  freeOnly: boolean;
  issues: RegistryIssue[];
  source: string;
}

const FALLBACK_VERIFICATION: VerificationConfig = { timeoutMs: 15_000, requireContract: true, probeLive: false };

interface RawConfig {
  version?: number;
  agents?: Array<Record<string, unknown>>;
  models?: Array<Record<string, unknown>>;
  deployments?: Array<Record<string, unknown>>;
  verifications?: Array<Record<string, unknown>>;
  verification?: Partial<VerificationConfig>;
  defaultRequirement?: Partial<CapabilityRequirement>;
  policy?: { freeOnly?: boolean };
}

/**
 * `${VAR}` and `${VAR:fallback}` expansion. Fallbacks are mandatory in practice:
 * CI and a laptop must both produce a *usable* config, and a missing env var that
 * silently becomes an empty base URL turns into a mysterious connection failure.
 */
export function expandEnv(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.trim() === '') return value;
    return value.replace(/\$\{([A-Z0-9_]+)(?::([^}]*))?\}/g, (_m, name: string, fallback: string) => {
      const fromEnv = process.env[name];
      if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
      if (fallback === undefined) {
        throw new Error(`config references \${${name}} but ${name} is not set and no fallback was given`);
      }
      return fallback;
    });
  }
  if (Array.isArray(value)) return value.map(expandEnv);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = expandEnv(v);
    return out;
  }
  return value;
}

export function loadControlPlaneConfig(file: string, source?: string): ControlPlaneConfig {
  let raw: RawConfig;
  try {
    raw = expandEnv(JSON.parse(source ?? readFileSync(file, 'utf8')) as RawConfig) as RawConfig;
  } catch (error) {
    throw new Error(`control-plane config: ${file}: ${(error as Error).message}`);
  }
  const snapshot = parseRegistry(JSON.stringify(raw), file);
  const deployments = ((raw.deployments ?? []) as Array<Record<string, unknown>>).map((d) => ({
    id: String(d.id),
    url: String(d.url ?? ''),
    mode: (d.mode === 'publish' ? 'publish' : 'observe') as DeploymentConfig['mode'],
    enabled: d.enabled !== false,
    spaceRepo: d.spaceRepo as string | undefined,
    markers: d.markers as string[] | undefined,
    backendBaseUrl: d.backendBaseUrl as string | undefined,
    notes: d.notes as string | undefined,
  }));
  return {
    version: Number(raw.version ?? 1),
    registry: new ProviderRegistry(snapshot),
    agents: snapshot.providers.filter((p) => p.kind === 'agent'),
    models: snapshot.providers.filter((p) => p.kind === 'model'),
    deployments,
    verifications: snapshot.providers
      .filter((p) => p.kind === 'verification')
      .map((p) => ({ id: p.id, kind: 'verification' as const, notes: p.notes })),
    verification: { ...FALLBACK_VERIFICATION, ...(raw.verification ?? {}) },
    defaultRequirement: { capabilities: raw.defaultRequirement?.capabilities ?? ['chat'], ...raw.defaultRequirement },
    freeOnly: raw.policy?.freeOnly !== false,
    issues: snapshot.issues,
    source: file,
  };
}
