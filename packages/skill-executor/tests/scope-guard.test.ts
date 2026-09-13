// ============================================================================
// AGI OS — skill scope enforcement regression suite
// ----------------------------------------------------------------------------
// Proves the three executor-side defects from the readiness review are closed:
//
//   * a "governed" filesystem skill could read /etc/passwd because the intent
//     carried module='filesystem' and the policies test module==='fs';
//   * governance was handed JSON.stringify(input) as the target, so path
//     policies matched JSON noise instead of the real resource;
//   * contract.allowedScopes was declared everywhere and enforced nowhere.
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import { SkillRunner } from '../src/SkillRunner.js';
import { InputValidator } from '../src/InputValidator.js';
import { OutputValidator } from '../src/OutputValidator.js';
import { ExecutionPolicy } from '../src/ExecutionPolicy.js';
import {
  checkScopes,
  extractGovernanceTarget,
  isContainedIn,
  GovernanceRejectedError,
} from '../src/scope-guard.js';
import type { SkillHandler, SkillExecutionContext } from '../src/types.js';
import type { SkillContract } from '@agi-os/skills';
import { GovernanceGateway } from '@agi-os/governance';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const WORKSPACE = '/workspace/mission-1';

function contract(over: Partial<SkillContract> = {}): SkillContract {
  return {
    id: 'filesystem.read',
    name: 'Read',
    version: '1.0.0',
    description: 'read a file',
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
    ...over,
  };
}

function runnerFor(handler: SkillHandler, c: SkillContract) {
  return new SkillRunner({
    handlers: new Map([[handler.skillId, handler]]),
    contracts: new Map([[handler.skillId, c]]),
    inputValidator: new InputValidator(),
    outputValidator: new OutputValidator(),
    executionPolicy: new ExecutionPolicy(),
  });
}

const ctx = (governance: unknown): SkillExecutionContext =>
  ({ missionId: 'm1', taskId: 't1', workingDir: WORKSPACE, timeout: 10000, governance }) as SkillExecutionContext;

/** A handler that must never run — if it does, the guard failed open. */
const forbiddenHandler: SkillHandler = {
  skillId: 'filesystem.read',
  category: 'filesystem',
  execute: vi.fn(async () => ({ content: 'THIS SHOULD NEVER BE RETURNED' })),
};

// ---------------------------------------------------------------------------
describe('extractGovernanceTarget', () => {
  it('surfaces the real resource instead of serialised JSON', () => {
    expect(extractGovernanceTarget({ path: '/etc/passwd' }, 'filesystem.read')).toBe('/etc/passwd');
    expect(extractGovernanceTarget({ url: 'https://api.example/x' }, 'network.get')).toBe('https://api.example/x');
    expect(extractGovernanceTarget({ command: 'rm -rf /' }, 'terminal.exec')).toBe('rm -rf /');
    expect(extractGovernanceTarget({ table: 'users' }, 'db.delete')).toBe('users');
  });

  it('is case-insensitive about the input key', () => {
    expect(extractGovernanceTarget({ FilePath: '/etc/shadow' }, 'filesystem.read')).toBe('/etc/shadow');
  });

  it('falls back to the serialised input so nothing is dropped from the audit', () => {
    expect(extractGovernanceTarget({ a: 1 }, 'math.add')).toContain('"a":1');
  });

  it('never throws on unserialisable input', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => extractGovernanceTarget(circular, 'odd.skill')).not.toThrow();
  });
});

describe('isContainedIn', () => {
  it('accepts paths inside the root', () => {
    expect(isContainedIn('/workspace', '/workspace/a/b.txt')).toBe(true);
    expect(isContainedIn('/workspace', '/workspace')).toBe(true);
  });

  it('rejects a sibling directory that merely shares a prefix', () => {
    // startsWith('/workspace') is true for '/workspace-evil' — that was the bug.
    expect(isContainedIn('/workspace', '/workspace-evil/a.txt')).toBe(false);
  });

  it('rejects traversal that escapes the root', () => {
    expect(isContainedIn('/workspace', '/workspace/../etc/passwd')).toBe(false);
  });
});

describe('checkScopes', () => {
  it('rejects protected locations even inside the workspace', () => {
    expect(checkScopes(contract(), { path: `${WORKSPACE}/.env` }, WORKSPACE)).toMatch(/environment\/secret/);
    expect(checkScopes(contract(), { path: `${WORKSPACE}/.ssh/id_rsa` }, WORKSPACE)).toMatch(/protected/);
  });

  it('rejects path traversal', () => {
    // No protected substring here, so this isolates the traversal check itself.
    expect(checkScopes(contract(), { path: '../../../elsewhere/x.txt' }, WORKSPACE)).toMatch(/traversal/);
  });

  it('rejects absolute paths outside the workspace', () => {
    expect(checkScopes(contract(), { path: '/opt/elsewhere/x.txt' }, WORKSPACE)).toMatch(/outside the workspace/);
  });

  it('rejects protected paths with the protected-location reason first', () => {
    // /etc/passwd fails on two counts; the stronger reason is reported.
    expect(checkScopes(contract(), { path: '/etc/passwd' }, WORKSPACE)).toMatch(/protected location/);
    expect(checkScopes(contract(), { path: '../../etc/passwd' }, WORKSPACE)).toMatch(/protected location/);
  });

  it('rejects persistence locations an agent must never write', () => {
    for (const path of ['/etc/cron.d/backdoor', '/root/.bashrc', '/home/user/.ssh/authorized_keys']) {
      expect(checkScopes(contract({ id: 'filesystem.write' }), { path }, WORKSPACE), path).toMatch(/protected location/);
    }
  });

  it('accepts a path inside the workspace', () => {
    expect(checkScopes(contract(), { path: `${WORKSPACE}/notes.txt` }, WORKSPACE)).toBeNull();
    expect(checkScopes(contract(), { path: 'notes.txt' }, WORKSPACE)).toBeNull();
  });

  it('accepts a pure-computation skill that declares no scopes', () => {
    const pure = contract({ id: 'math.add', category: 'core', allowedScopes: [] });
    expect(checkScopes(pure, { a: 1, b: 2 }, WORKSPACE)).toBeNull();
  });

  it('refuses a resource-touching skill that declares no scopes (fail closed)', () => {
    const undeclared = contract({ id: 'filesystem.write', allowedScopes: [] });
    expect(checkScopes(undeclared, { path: `${WORKSPACE}/x.txt` }, WORKSPACE)).toMatch(/no allowedScopes/);

    const networked = contract({ id: 'http.post', allowedScopes: [], requiresNetwork: true });
    expect(checkScopes(networked, { body: 'x' }, WORKSPACE)).toMatch(/no allowedScopes/);
  });

  it('inspects every string input, not just the first one', () => {
    const result = checkScopes(
      contract({ id: 'fs.copy' }),
      { from: `${WORKSPACE}/a.txt`, to: '/opt/elsewhere/x.txt' },
      WORKSPACE
    );
    expect(result).toMatch(/input\.to/);
    expect(result).toMatch(/outside the workspace/);
  });
});

// ---------------------------------------------------------------------------
describe('SkillRunner end-to-end guard behaviour', () => {
  const governance = new GovernanceGateway();

  it('refuses to read /etc/passwd through a "governed" filesystem skill', async () => {
    // The exact headline finding: governance returned ALLOW and the file was read.
    const runner = runnerFor(forbiddenHandler, contract());
    const result = await runner.execute(
      { missionId: 'm1', taskId: 't1', skillId: 'filesystem.read', input: { path: '/etc/passwd' }, requestedBy: 'agent' },
      ctx(governance)
    );

    expect(result.success).toBe(false);
    expect(forbiddenHandler.execute).not.toHaveBeenCalled();
    expect(result.output).toBeUndefined();
  });

  it('reports the governance verdict with its rule id, not a generic failure', async () => {
    const runner = runnerFor(forbiddenHandler, contract());
    const result = await runner.execute(
      { missionId: 'm1', taskId: 't1', skillId: 'filesystem.read', input: { path: '/etc/passwd' }, requestedBy: 'agent' },
      ctx(governance)
    );

    expect(result.error?.code).toMatch(/^GOVERNANCE_/);
    expect(result.error?.retryable).toBe(false);
    expect(result.error?.metadata?.ruleId).toBeTruthy();
  });

  it('refuses a traversal payload before the handler is reached', async () => {
    const runner = runnerFor(forbiddenHandler, contract());
    const result = await runner.execute(
      { missionId: 'm1', taskId: 't1', skillId: 'filesystem.read', input: { path: '../../../../etc/shadow' }, requestedBy: 'agent' },
      ctx(governance)
    );
    expect(result.success).toBe(false);
    expect(forbiddenHandler.execute).not.toHaveBeenCalled();
  });

  it('allows an ordinary in-workspace read', async () => {
    const okHandler: SkillHandler = {
      skillId: 'filesystem.read',
      category: 'filesystem',
      execute: async (input) => ({ content: 'hello', path: input.path }),
    };
    const runner = runnerFor(okHandler, contract());
    const result = await runner.execute(
      { missionId: 'm1', taskId: 't1', skillId: 'filesystem.read', input: { path: `${WORKSPACE}/notes.txt` }, requestedBy: 'agent' },
      ctx(governance)
    );
    expect(result.success).toBe(true);
    expect((result.output as { content: string }).content).toBe('hello');
  });

  it('sends canonical vocabulary to governance', async () => {
    const spy = vi.fn().mockImplementation((i) => governance.intercept(i));
    const runner = runnerFor(forbiddenHandler, contract());
    await runner.execute(
      { missionId: 'm1', taskId: 't1', skillId: 'filesystem.read', input: { path: '/etc/passwd' }, requestedBy: 'agent' },
      ctx({ intercept: spy })
    );

    const sent = spy.mock.calls[0][0];
    expect(sent.module).toBe('fs');
    expect(sent.operation).toBe('read');
    expect(sent.target).toBe('/etc/passwd');
  });

  it('treats an unapproved mutating skill as a refusal, not a success', async () => {
    const writeHandler: SkillHandler = {
      skillId: 'filesystem.write',
      category: 'filesystem',
      execute: vi.fn(async () => ({ bytesWritten: 1 })),
    };
    const runner = runnerFor(writeHandler, contract({ id: 'filesystem.write', allowedScopes: ['filesystem.write'] }));
    const result = await runner.execute(
      { missionId: 'm1', taskId: 't1', skillId: 'filesystem.write', input: { path: '/opt/outside.txt', content: 'x' }, requestedBy: 'agent' },
      ctx(governance)
    );
    expect(result.success).toBe(false);
    expect(writeHandler.execute).not.toHaveBeenCalled();
  });
});

describe('GovernanceRejectedError', () => {
  it('carries the code, rule id and approval reference', () => {
    const err = new GovernanceRejectedError('REQUIRE_APPROVAL', 'needs a human', 'FAIL-CLOSED', 'ap-1');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('REQUIRE_APPROVAL');
    expect(err.ruleId).toBe('FAIL-CLOSED');
    expect(err.approvalRequestId).toBe('ap-1');
  });
});
