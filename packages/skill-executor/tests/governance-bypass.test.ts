// ============================================================================
// AGI OS - Governance Bypass PoC Suite
// ----------------------------------------------------------------------------
// CI gate: "Run governance bypass PoC suite".
//
// Each test below is a bypass that WORKED against the codebase at the time of
// the production-readiness review. They are written as an attacker would write
// them: a real skill handler that returns the file contents, a real governance
// gateway, and an assertion that the sensitive bytes never come back.
//
// The original findings, verbatim:
//
//   1. Policies test `intent.module === 'fs'`, but SkillRunner sent
//      `contract.category` — the string 'filesystem'. No filesystem policy ever
//      matched, `matchedRuleId` came back null, and the decision was the
//      default ALLOW. Reading /etc/passwd through a "governed" skill worked.
//   2. Governance was handed `JSON.stringify(input)` as the target, so a policy
//      matching on '/etc/' was comparing against
//      '{"path":"/etc/passwd"}' — and POL-001's `includes('/etc/')` happened to
//      match by luck, not by design. Anything keyed on a path prefix failed.
//   3. `allowedScopes` was declared on every contract and read by nothing.
//   4. "No policy matched" meant ALLOW, for writes and executions included.
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { SkillRunner } from '../src/SkillRunner.js';
import { InputValidator } from '../src/InputValidator.js';
import { OutputValidator } from '../src/OutputValidator.js';
import { ExecutionPolicy } from '../src/ExecutionPolicy.js';
import { GovernanceGateway, PolicyDecision } from '@agi-os/governance';
import type { SkillHandler, SkillExecutionContext } from '../src/types.js';
import type { SkillContract } from '@agi-os/skills';

const WORKSPACE = '/workspace/mission-1';

// ---------------------------------------------------------------------------
// A handler written the way the real one is: it trusts that governance already
// said yes, and it will happily read whatever path it is given. If the guard
// fails open, the file contents come back.
// ---------------------------------------------------------------------------
const readFileHandler: SkillHandler = {
  skillId: 'filesystem.read',
  category: 'filesystem',
  execute: vi.fn(async (input: Record<string, unknown>) => {
    const path = String(input.path ?? '');
    try {
      return { path, content: readFileSync(path, 'utf8').slice(0, 64) };
    } catch (err) {
      return { path, error: err instanceof Error ? err.message : String(err) };
    }
  }),
};

const readContract: SkillContract = {
  id: 'filesystem.read',
  name: 'Read file',
  version: '1.0.0',
  description: 'Read a file from disk',
  // The category string that used to be forwarded verbatim as the governance
  // module — and that no policy recognised.
  category: 'filesystem',
  capabilities: [],
  risk: 'LOW',
  requiresApproval: false,
  requiresNetwork: false,
  requiresPersistence: false,
  allowedScopes: ['filesystem.read'],
  timeoutMs: 10000,
  retryLimit: 1,
  verification: { required: false, level: 'BASIC' },
};

function makeRunner(handler: SkillHandler = readFileHandler, contract: SkillContract = readContract) {
  return new SkillRunner({
    handlers: new Map([[handler.skillId, handler]]),
    contracts: new Map([[handler.skillId, contract]]),
    inputValidator: new InputValidator(),
    outputValidator: new OutputValidator(),
    executionPolicy: new ExecutionPolicy(),
  });
}

let governance: GovernanceGateway;
let context: SkillExecutionContext;

beforeEach(() => {
  governance = new GovernanceGateway();
  vi.clearAllMocks();
  context = {
    missionId: 'm-bypass',
    taskId: 't-bypass',
    workingDir: WORKSPACE,
    timeout: 10000,
    governance,
  } as SkillExecutionContext;
});

async function attack(path: string, contract: SkillContract = readContract) {
  const runner = makeRunner(readFileHandler, contract);
  const result = await runner.execute(
    { missionId: 'm-bypass', taskId: 't-bypass', skillId: 'filesystem.read', input: { path }, requestedBy: 'attacker-agent' },
    context
  );
  return {
    result,
    executed: readFileHandler.execute.mock.calls.length > 0,
    leaked: JSON.stringify(result.output ?? '').includes('root:'),
  };
}

// ---------------------------------------------------------------------------
describe('PoC 1 — sensitive read through a governed filesystem skill', () => {
  it('does not return /etc/passwd', async () => {
    const { result, executed, leaked } = await attack('/etc/passwd');
    expect(leaked).toBe(false);
    expect(executed).toBe(false);
    expect(result.success).toBe(false);
  });

  it('does not return /etc/shadow or the sudoers file', async () => {
    for (const path of ['/etc/shadow', '/etc/sudoers']) {
      const { result, executed } = await attack(path);
      expect(result.success, path).toBe(false);
      expect(executed, path).toBe(false);
    }
  });

  it('does not return SSH private keys', async () => {
    for (const path of ['/root/.ssh/id_rsa', '/home/deploy/.ssh/id_ed25519']) {
      const { result, executed } = await attack(path);
      expect(result.success, path).toBe(false);
      expect(executed, path).toBe(false);
    }
  });

  it('does not return environment/secret files', async () => {
    for (const path of ['/app/.env', `${WORKSPACE}/.env.production`]) {
      const { result, executed } = await attack(path);
      expect(result.success, path).toBe(false);
      expect(executed, path).toBe(false);
    }
  });

  it('records a real policy rule id, not the default allow', async () => {
    // The tell-tale sign of the original bug was matchedRuleId === null.
    const verdict = governance.intercept({
      id: 'poc-1',
      module: 'filesystem',          // exactly what SkillRunner used to send
      operation: 'filesystem.read',  // exactly what SkillRunner used to send
      target: '/etc/passwd',
    });
    expect(verdict.decision).toBe(PolicyDecision.BLOCK);
    expect(verdict.auditRecord.matchedRuleId).not.toBeNull();
    expect(verdict.auditRecord.matchedRuleId).toBe('POL-001');
  });
});

describe('PoC 2 — traversal and encoding tricks', () => {
  it('refuses ../ traversal to a sensitive file', async () => {
    const { result, executed } = await attack('../../../../etc/passwd');
    expect(result.success).toBe(false);
    expect(executed).toBe(false);
  });

  it('refuses traversal hidden inside an otherwise in-workspace path', async () => {
    const { result, executed } = await attack(`${WORKSPACE}/notes/../../../etc/passwd`);
    expect(result.success).toBe(false);
    expect(executed).toBe(false);
  });

  it('refuses a sibling directory that shares the workspace prefix', async () => {
    // startsWith('/workspace/mission-1') is true for '/workspace/mission-1-evil'
    const { result, executed } = await attack(`${WORKSPACE}-evil/secrets.txt`);
    expect(result.success).toBe(false);
    expect(executed).toBe(false);
  });
});

describe('PoC 3 — contract-declared scopes were never enforced', () => {
  it('refuses a skill that touches a path but declares no scopes', async () => {
    const undeclared: SkillContract = { ...readContract, allowedScopes: [] };
    const { result, executed } = await attack(`${WORKSPACE}/notes.txt`, undeclared);
    expect(result.success).toBe(false);
    expect(executed).toBe(false);
    expect(result.error?.code).toBe('GOVERNANCE_SCOPE_VIOLATION');
  });

  it('still permits an ordinary in-workspace read on a scoped contract', async () => {
    const { result, executed } = await attack(`${WORKSPACE}/notes.txt`);
    expect(result.success).toBe(true);
    expect(executed).toBe(true);
  });
});

describe('PoC 4 — the default decision was ALLOW for everything unmatched', () => {
  it('requires approval for an unmatched mutating operation', () => {
    const verdict = governance.intercept({
      id: 'poc-4',
      module: 'network',
      operation: 'exfiltrate',
      target: 'https://attacker.example/collect',
    });
    expect(verdict.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    expect(verdict.auditRecord.matchedRuleId).toBe('FAIL-CLOSED');
  });

  it('does not let an unapproved mutating skill run', async () => {
    const writeHandler: SkillHandler = {
      skillId: 'filesystem.write',
      category: 'filesystem',
      execute: vi.fn(async () => ({ bytesWritten: 5 })),
    };
    const writeContract: SkillContract = {
      ...readContract,
      id: 'filesystem.write',
      allowedScopes: ['filesystem.write'],
    };
    const runner = makeRunner(writeHandler, writeContract);
    const result = await runner.execute(
      { missionId: 'm', taskId: 't', skillId: 'filesystem.write', input: { path: '/opt/outside.txt', content: 'x' }, requestedBy: 'agent' },
      context
    );
    expect(result.success).toBe(false);
    expect(writeHandler.execute).not.toHaveBeenCalled();
    expect(result.error?.retryable).toBe(false);
  });
});

describe('the audit trail is usable for forensics', () => {
  it('logs every intercepted attempt with the canonical module', async () => {
    await attack('/etc/passwd');
    const history = governance.getAuditHistory();
    expect(history.length).toBeGreaterThan(0);

    const record = history[history.length - 1];
    // The record must be searchable by the vocabulary the policies use.
    expect(['fs', 'filesystem']).toContain(record.intent.module);
    expect(record.decision).toBe(PolicyDecision.BLOCK);
    expect(record.timestamp).toBeTruthy();
  });

  it('the target recorded is the resource, not serialised JSON', async () => {
    await attack('/etc/passwd');
    const record = governance.getAuditHistory().at(-1);
    expect(record?.intent.target).toBe('/etc/passwd');
    expect(record?.intent.target).not.toContain('{');
  });
});
