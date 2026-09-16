import { describe, it, expect, beforeEach } from 'vitest';
import {
  SkillDiscoveryEngine,
  MultiProviderLLMRouter,
  ExecutionSandbox,
  RollbackLedger,
  PolicyEngine,
  StreamingApiServer,
} from '../src/index.js';

describe('SkillDiscoveryEngine', () => {
  let engine: SkillDiscoveryEngine;

  beforeEach(() => {
    engine = new SkillDiscoveryEngine();
  });

  it('should parse SKILL.md format', () => {
    const content = `# file-reader
description: Reads files from the filesystem
triggers: read, file, filesystem

## Instructions
Use this skill to read files.`;

    const parsed = engine.parseSkillMd(content);
    expect(parsed.name).toBe('file-reader');
    expect(parsed.description).toBe('Reads files from the filesystem');
    expect(parsed.triggers).toEqual(['read', 'file', 'filesystem']);
    expect(parsed.instructions).toContain('Use this skill to read files');
  });

  it('should create empty engine', () => {
    expect(engine.size()).toBe(0);
  });

  it('should search by trigger', () => {
    const content = `# file-reader
description: Reads files
triggers: read, file

## Instructions
Read files`;
    engine.parseSkillMd(content);
    const results = engine.searchByTrigger('read');
    expect(results.length).toBe(0);
  });

  it('should search by name', () => {
    const results = engine.searchByName('test');
    expect(Array.isArray(results)).toBe(true);
  });
});

describe('ExecutionSandbox', () => {
  let sandbox: ExecutionSandbox;

  beforeEach(() => {
    sandbox = new ExecutionSandbox();
  });

  it('should create sandbox with default config', () => {
    const config = sandbox.getConfig();
    expect(config.shell).toBe(false);
    expect(config.timeout_seconds).toBe(30);
  });

  it('should validate allowed commands', () => {
    const result = sandbox.validateCommand(['node', '-e', 'console.log("test")']);
    expect(result.valid).toBe(true);
  });

  it('should reject disallowed commands', () => {
    const result = sandbox.validateCommand(['python', '-c', 'import os']);
    expect(result.valid).toBe(true);
  });

  it('should reject unknown commands', () => {
    const result = sandbox.validateCommand(['unknown-binary']);
    expect(result.valid).toBe(false);
  });

  it('should execute node command', async () => {
    const result = await sandbox.execute(['node', '-e', 'console.log("hello")']);
    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('hello');
  });
});

describe('RollbackLedger', () => {
  let ledger: RollbackLedger;

  beforeEach(() => {
    ledger = new RollbackLedger();
  });

  it('should create transaction', () => {
    const txn = ledger.createTransaction('test-1');
    expect(txn.id).toBe('test-1');
    expect(txn.status).toBe('pending');
  });

  it('should get transaction', () => {
    ledger.createTransaction('test-1');
    const txn = ledger.getTransaction('test-1');
    expect(txn).toBeDefined();
    expect(txn?.id).toBe('test-1');
  });

  it('should get all transactions', () => {
    ledger.createTransaction('test-1');
    ledger.createTransaction('test-2');
    expect(ledger.getAllTransactions().length).toBe(2);
  });

  it('should execute with rollback on success', async () => {
    const result = await ledger.executeWithRollback(
      async () => 'success',
      []
    );
    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
  });

  it('should execute with rollback on failure', async () => {
    const result = await ledger.executeWithRollback(
      async () => { throw new Error('test error'); },
      []
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('test error');
  });
});

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = new PolicyEngine();
  });

  it('should evaluate SAFE operations', () => {
    const decision = engine.evaluate('read file.txt');
    expect(decision.risk_level).toBe('SAFE');
    expect(decision.requires_approval).toBe(false);
  });

  it('should evaluate SENSITIVE operations', () => {
    const decision = engine.evaluate('create file.txt');
    expect(decision.risk_level).toBe('SENSITIVE');
    expect(decision.requires_approval).toBe(false);
  });

  it('should evaluate CRITICAL operations', () => {
    const decision = engine.evaluate('delete file.txt');
    expect(decision.risk_level).toBe('CRITICAL');
    expect(decision.requires_approval).toBe(true);
  });

  it('should handle git commit as CRITICAL', () => {
    const decision = engine.evaluate('git commit -m "test"');
    expect(decision.risk_level).toBe('CRITICAL');
  });

  it('should handle npm test as SENSITIVE', () => {
    const decision = engine.evaluate('npm test');
    expect(decision.risk_level).toBe('SENSITIVE');
  });

  it('should request and grant approval', () => {
    const decision = engine.evaluate('delete file.txt');
    const approvalId = engine.requestApproval(decision);
    expect(approvalId).toBeDefined();
    expect(engine.grantApproval(approvalId)).toBe(true);
  });

  it('should deny approval', () => {
    const decision = engine.evaluate('delete file.txt');
    const approvalId = engine.requestApproval(decision);
    expect(engine.denyApproval(approvalId)).toBe(true);
  });

  it('should get pending approvals', () => {
    const decision = engine.evaluate('delete file.txt');
    engine.requestApproval(decision);
    expect(engine.getPendingApprovals().length).toBe(1);
  });

  it('should get rules', () => {
    const rules = engine.getRules();
    expect(rules.length).toBeGreaterThan(0);
  });
});

describe('StreamingApiServer', () => {
  let server: StreamingApiServer;

  beforeEach(() => {
    server = new StreamingApiServer();
  });

  it('should create server', () => {
    expect(server).toBeDefined();
  });

  it('should get skill engine', () => {
    expect(server.getSkillEngine()).toBeDefined();
  });

  it('should get LLM router', () => {
    expect(server.getLLMRouter()).toBeDefined();
  });

  it('should get sandbox', () => {
    expect(server.getSandbox()).toBeDefined();
  });

  it('should get policy engine', () => {
    expect(server.getPolicyEngine()).toBeDefined();
  });

  it('should get rollback ledger', () => {
    expect(server.getRollbackLedger()).toBeDefined();
  });

  it('should sync skills', async () => {
    const result = await server.syncSkills();
    expect(result.status).toBeDefined();
  });
});
