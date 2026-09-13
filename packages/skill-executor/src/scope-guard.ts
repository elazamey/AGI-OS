// ============================================================================
// AGI OS - Skill Scope Guard
// ----------------------------------------------------------------------------
// Three gaps from the readiness review are closed here:
//
//  1. `SkillContract.allowedScopes` was declared on every contract and checked
//     nowhere — a contract could claim `['filesystem.read']` and still be
//     invoked with a path outside the workspace.
//  2. Governance received `JSON.stringify(input)` as the "target", so path and
//     URL policies matched against JSON noise rather than the real resource.
//  3. `PathGuard.isWithinScope` returned `true` for an empty scope list and
//     compared with `startsWith`, so `/sandbox-evil` counted as inside
//     `/sandbox`.
//
// Everything here fails closed: ambiguity is a rejection, not a pass.
// ============================================================================

import { isAbsolute, resolve, sep } from 'node:path';
import type { SkillContract } from '@agi-os/skills';

/** Thrown when governance or scope enforcement refuses a skill invocation. */
export class GovernanceRejectedError extends Error {
  readonly code: 'BLOCK' | 'REQUIRE_APPROVAL' | 'SCOPE_VIOLATION';
  readonly ruleId: string | null;
  readonly approvalRequestId?: string;

  constructor(
    code: 'BLOCK' | 'REQUIRE_APPROVAL' | 'SCOPE_VIOLATION',
    message: string,
    ruleId: string | null = null,
    approvalRequestId?: string
  ) {
    super(message);
    this.name = 'GovernanceRejectedError';
    this.code = code;
    this.ruleId = ruleId;
    this.approvalRequestId = approvalRequestId;
  }
}

/** Input keys whose value is the resource a policy should be evaluated on. */
const TARGET_KEYS = [
  'path', 'filePath', 'file', 'filename', 'dir', 'directory', 'folder',
  'url', 'uri', 'endpoint', 'href',
  'command', 'cmd', 'script', 'shell',
  'table', 'collection', 'index', 'query',
  'repo', 'repository', 'branch', 'ref', 'remote',
  'target', 'resource', 'id',
] as const;

/**
 * Pick the value governance policies should actually inspect.
 *
 * Falls back to the serialised input only when no resource-like key exists, so
 * nothing is silently dropped from the audit record.
 */
export function extractGovernanceTarget(input: Record<string, unknown>, skillId: string): string {
  const lowerKeyed = new Map<string, unknown>();
  for (const [k, v] of Object.entries(input)) lowerKeyed.set(k.toLowerCase(), v);

  for (const key of TARGET_KEYS) {
    const value = lowerKeyed.get(key.toLowerCase());
    if (typeof value === 'string' && value.length > 0) return value;
  }

  // Skill-specific hint: `filesystem.read` should surface its path argument.
  if (/read|write|list|delete|move|copy/.test(skillId)) {
    for (const value of Object.values(input)) {
      if (typeof value === 'string' && value.length > 0) return value;
    }
  }

  try {
    return JSON.stringify(input);
  } catch {
    return '[unserialisable input]';
  }
}

/** Paths that are never readable through a skill, regardless of workspace. */
const ALWAYS_DENIED = [
  // credentials / identity
  '/etc/shadow', '/etc/passwd', '/etc/sudoers', '/etc/sudoers.d',
  '.ssh/', 'id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa', 'authorized_keys',
  '.aws/credentials', '.kube/config', '.docker/config.json',
  '.netrc', '.npmrc', '.pypirc', '.git-credentials',
  // persistence: anything an agent can write here survives the mission
  '/etc/cron', 'crontab', '/etc/systemd', '/etc/init.d', 'ld.so.preload',
  '/etc/hosts', '/etc/resolv.conf',
  '.bashrc', '.bash_profile', '.profile', '.zshrc', '.zprofile',
  // kernel / device surface
  '/proc/', '/sys/', '/dev/', '/boot/',
] as const;

/** `.env` and friends — matched as a basename so `/app/.env` is caught too. */
const ENV_FILE = /(^|[\\/])\.env(\.|$)/;

function looksLikePath(value: string): boolean {
  return (
    isAbsolute(value) ||
    value.startsWith('./') || value.startsWith('../') ||
    value.startsWith('.\\') || value.startsWith('..\\') ||
    value.includes('/') || value.includes('\\')
  );
}

/**
 * True when `candidate` is inside `root`, compared on resolved paths with a
 * separator boundary so `/sandbox-evil` is NOT inside `/sandbox`.
 */
export function isContainedIn(root: string, candidate: string): boolean {
  const resolvedRoot = resolve(root);
  const resolved = resolve(candidate);
  if (resolved === resolvedRoot) return true;
  const prefix = resolvedRoot.endsWith(sep) ? resolvedRoot : resolvedRoot + sep;
  return resolved.startsWith(prefix);
}

/**
 * Enforce the contract's declared scopes plus the workspace jail.
 * Returns a human-readable rejection reason, or `null` when the call is allowed.
 */
export function checkScopes(
  contract: SkillContract,
  input: Record<string, unknown>,
  workingDir: string
): string | null {
  const declared = contract.allowedScopes ?? [];
  const jail = resolve(workingDir || '.');

  const stringValues: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') stringValues.push({ key, value });
  }

  for (const { key, value } of stringValues) {
    // 1. Never-denied locations, whatever the contract says.
    for (const denied of ALWAYS_DENIED) {
      if (value.includes(denied)) {
        return `input.${key} references a protected location (${denied})`;
      }
    }
    if (ENV_FILE.test(value)) {
      return `input.${key} references an environment/secret file`;
    }

    if (!looksLikePath(value)) continue;

    // 2. Explicit traversal is always rejected.
    if (/(^|[\\/])\.\.([\\/]|$)/.test(value)) {
      return `input.${key} contains a path traversal sequence`;
    }

    // 3. Containment inside the mission workspace.
    const candidate = isAbsolute(value) ? value : resolve(jail, value);
    if (!isContainedIn(jail, candidate)) {
      return `input.${key} resolves to "${candidate}", outside the workspace "${jail}"`;
    }
  }

  // 4. A contract that touches a scoped resource must declare the scopes for
  //    it. An empty list on a pure-computation skill is fine — there is nothing
  //    to scope — but on one that takes paths/URLs, or that declares network or
  //    persistence, an empty list means "nothing was granted" (fail closed).
  const touchesResource =
    contract.requiresNetwork ||
    contract.requiresPersistence ||
    stringValues.some(({ value }) => looksLikePath(value) || /^[a-z][a-z0-9+.-]*:\/\//i.test(value));

  // No read/write carve-out: an empty allowedScopes list grants nothing, so a
  // skill that touches a path, a URL, or a persistent store has no authority to
  // do so whatever its verb is. Pure-computation skills are unaffected because
  // touchesResource is false for them.
  if (declared.length === 0 && touchesResource) {
    return `contract "${contract.id}" declares no allowedScopes but touches a scoped resource; refusing (fail closed)`;
  }

  return null;
}
