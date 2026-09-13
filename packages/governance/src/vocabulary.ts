// ============================================================================
// AGI OS - Governance Vocabulary
// ----------------------------------------------------------------------------
// The readiness review found the single most damaging governance bug was a
// vocabulary mismatch: policies test `intent.module === 'fs'`, but the skill
// executor sent `contract.category` (`'filesystem'`). Every filesystem policy
// silently never fired, and reading `/etc/passwd` through a "governed" skill
// returned ALLOW with no matched rule.
//
// Fixing only that one call site would leave the class of bug alive. Instead
// the vocabulary is canonicalised here and normalisation happens at the
// gateway boundary, so ANY caller — present or future — is mapped onto the
// same terms the policies are written in.
// ============================================================================

/** The only module names policy conditions are allowed to test against. */
export const GOVERNANCE_MODULES = [
  'fs',
  'db',
  'exec',
  'process',
  'network',
  'git',
  'sandbox',
  'memory',
  'config',
  'env',
  'browser',
  'unknown',
] as const;

export type GovernanceModule = (typeof GOVERNANCE_MODULES)[number];

/** Aliases callers are known to use, mapped onto the canonical vocabulary. */
const MODULE_ALIASES: Record<string, GovernanceModule> = {
  // filesystem
  filesystem: 'fs',
  file: 'fs',
  files: 'fs',
  disk: 'fs',
  io: 'fs',
  storage: 'fs',
  // execution
  terminal: 'exec',
  shell: 'exec',
  command: 'exec',
  cmd: 'exec',
  system: 'exec',
  os: 'exec',
  run: 'exec',
  // network
  http: 'network',
  https: 'network',
  net: 'network',
  api: 'network',
  connector: 'network',
  connectors: 'network',
  webhook: 'network',
  webhooks: 'network',
  fetch: 'network',
  request: 'network',
  // database
  database: 'db',
  sql: 'db',
  postgres: 'db',
  sqlite: 'db',
  // git / github
  vcs: 'git',
  scm: 'git',
  github: 'git',
  // misc
  secrets: 'env',
  secret: 'env',
  environment: 'env',
  settings: 'config',
  configuration: 'config',
  vector: 'memory',
  rag: 'memory',
};

/**
 * Operations that change state. An unmatched mutating operation must never
 * default to ALLOW — that is the fail-closed rule (see PolicyEngine).
 */
export const MUTATING_OPERATIONS: ReadonlySet<string> = new Set([
  'write', 'create', 'delete', 'remove', 'destroy', 'drop', 'truncate',
  'insert', 'update', 'modify', 'patch', 'move', 'rename', 'copy',
  'execute', 'exec', 'run', 'spawn', 'start', 'stop', 'kill', 'restart',
  'push', 'commit', 'merge', 'rebase', 'reset', 'checkout', 'force-push',
  'reset-hard', 'revert', 'cherry-pick', 'tag',
  'post', 'put', 'patch-http', 'send', 'publish', 'emit',
  'grant', 'revoke', 'install', 'uninstall', 'deploy', 'migrate',
  'append', 'overwrite', 'set', 'assign', 'configure',
]);

/** Operations that only read state. */
export const READ_OPERATIONS: ReadonlySet<string> = new Set([
  'read', 'list', 'get', 'fetch', 'query', 'select', 'search', 'find',
  'inspect', 'describe', 'status', 'stat', 'exists', 'count', 'view', 'show',
]);

const OPERATION_ALIASES: Record<string, string> = {
  filesystem: 'read',
  readfile: 'read',
  writefile: 'write',
  listdir: 'list',
  execute: 'execute',
  exec: 'execute',
};

function canonicalKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/**
 * Map any caller-supplied module name onto the canonical vocabulary.
 *
 * `filesystem` → `fs`, `terminal` → `exec`, `github` → `git`, …
 * A dotted skill id (`filesystem.read`) contributes its first segment.
 * Unrecognised values become `'unknown'` — never silently passed through,
 * because a policy that tests `=== 'fs'` would then quietly not match.
 */
export function normalizeModule(raw: string | undefined | null): GovernanceModule {
  if (!raw) return 'unknown';
  const value = raw.trim().toLowerCase();
  if ((GOVERNANCE_MODULES as readonly string[]).includes(value)) {
    return value as GovernanceModule;
  }
  // dotted skill identifiers: "filesystem.read" → module "filesystem"
  const head = value.split('.')[0];
  if ((GOVERNANCE_MODULES as readonly string[]).includes(head)) {
    return head as GovernanceModule;
  }
  const aliased = MODULE_ALIASES[canonicalKey(head)] ?? MODULE_ALIASES[canonicalKey(value)];
  return aliased ?? 'unknown';
}

/**
 * Map any caller-supplied operation onto a canonical verb.
 *
 * `filesystem.read` → `read`, `fs.write` → `write`, `force-push` → `force-push`.
 */
export function normalizeOperation(raw: string | undefined | null): string {
  if (!raw) return 'unknown';
  const value = raw.trim().toLowerCase();
  // dotted skill id: take the last segment ("filesystem.read" → "read")
  const segments = value.split('.');
  const tail = segments[segments.length - 1] || value;
  const keyed = canonicalKey(tail);
  if (OPERATION_ALIASES[keyed]) return OPERATION_ALIASES[keyed];
  return tail;
}

/** True when the operation changes state and must not default to ALLOW. */
export function isMutatingOperation(operation: string): boolean {
  const normalized = normalizeOperation(operation);
  if (MUTATING_OPERATIONS.has(normalized)) return true;
  if (READ_OPERATIONS.has(normalized)) return false;
  // Unknown verbs are treated as mutating: fail closed on ambiguity.
  return true;
}
