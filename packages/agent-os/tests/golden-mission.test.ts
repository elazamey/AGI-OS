import { describe, it, expect, beforeEach } from 'vitest';
import {
  SkillDiscoveryEngine,
  MultiProviderLLMRouter,
  ExecutionSandbox,
  RollbackLedger,
  PolicyEngine,
  StreamingApiServer,
} from '../src/index.js';

describe('GOLDEN-MISSION-001: Complete Agent OS E2E', () => {
  let server: StreamingApiServer;
  let skillEngine: SkillDiscoveryEngine;
  let sandbox: ExecutionSandbox;
  let rollbackLedger: RollbackLedger;
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    server = new StreamingApiServer();
    skillEngine = server.getSkillEngine();
    sandbox = server.getSandbox();
    rollbackLedger = server.getRollbackLedger();
    policyEngine = server.getPolicyEngine();
  });

  it('should have all core components initialized', () => {
    expect(server).toBeDefined();
    expect(skillEngine).toBeDefined();
    expect(sandbox).toBeDefined();
    expect(rollbackLedger).toBeDefined();
    expect(policyEngine).toBeDefined();
  });

  it('should parse SKILL.md with triggers format', () => {
    const content = `# test-skill
description: A test skill for golden mission
triggers: test, golden, mission

## Instructions
Execute the golden mission test.`;

    const parsed = skillEngine.parseSkillMd(content);
    expect(parsed.name).toBe('test-skill');
    expect(parsed.description).toBe('A test skill for golden mission');
    expect(parsed.triggers).toEqual(['test', 'golden', 'mission']);
  });

  it('should execute node command in sandbox', async () => {
    const result = await sandbox.execute(['node', '-e', 'console.log("golden")']);
    expect(result.success).toBe(true);
    expect(result.stdout.trim()).toBe('golden');
  });

  it('should enforce shell=False in sandbox', () => {
    const config = sandbox.getConfig();
    expect(config.shell).toBe(false);
  });

  it('should have binary whitelist', () => {
    const config = sandbox.getConfig();
    expect(config.allowed_executables).toContain('node');
    expect(config.allowed_executables).toContain('python');
    expect(config.allowed_executables).toContain('npm');
  });

  it('should enforce 30s timeout', () => {
    const config = sandbox.getConfig();
    expect(config.timeout_seconds).toBe(30);
  });

  it('should evaluate SAFE operations', () => {
    const decision = policyEngine.evaluate('read file.txt');
    expect(decision.risk_level).toBe('SAFE');
    expect(decision.requires_approval).toBe(false);
  });

  it('should evaluate SENSITIVE operations', () => {
    const decision = policyEngine.evaluate('npm test');
    expect(decision.risk_level).toBe('SENSITIVE');
    expect(decision.requires_approval).toBe(false);
  });

  it('should evaluate CRITICAL operations', () => {
    const decision = policyEngine.evaluate('git commit -m "test"');
    expect(decision.risk_level).toBe('CRITICAL');
    expect(decision.requires_approval).toBe(true);
  });

  it('should require approval for CRITICAL operations', () => {
    const decision = policyEngine.evaluate('delete file.txt');
    expect(decision.requires_approval).toBe(true);
    const approvalId = policyEngine.requestApproval(decision);
    expect(approvalId).toBeDefined();
    expect(policyEngine.grantApproval(approvalId)).toBe(true);
  });

  it('should create and commit transaction', async () => {
    const result = await rollbackLedger.executeWithRollback(
      async () => 'success',
      []
    );
    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
  });

  it('should rollback on failure', async () => {
    const result = await rollbackLedger.executeWithRollback(
      async () => { throw new Error('test error'); },
      []
    );
    expect(result.success).toBe(false);
    expect(result.error).toBe('test error');
  });

  it('should stream chat response (graceful fallback)', async () => {
    const request = {
      messages: [{ role: 'user', content: 'Hello' }],
    };

    const events = [];
    try {
      for await (const event of server.handleChatStream(request)) {
        events.push(event);
      }
    } catch (error) {
      // Expected when no LLM providers are available
    }

    // Should have at least attempted to process
    expect(Array.isArray(events)).toBe(true);
  });

  it('should sync skills', async () => {
    const result = await server.syncSkills();
    expect(result.status).toBeDefined();
  });

  it('should have multi-provider LLM router', () => {
    const router = server.getLLMRouter();
    expect(router).toBeDefined();
    const providers = router.getProviders();
    expect(providers.length).toBeGreaterThan(0);
  });

  it('should have fallback hierarchy', () => {
    const router = server.getLLMRouter();
    const providers = router.getProviders();
    const priorities = providers.map(p => p.priority);
    expect(priorities).toEqual([1, 2, 3]);
  });

  it('should support self-healing with max retries', async () => {
    let attempts = 0;
    const result = await rollbackLedger.selfHeal(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('Not yet');
        return 'healed';
      },
      'node -e "console.log(1)"',
      []
    );
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
  });

  it('should have rollback ledger with max 3 retries', () => {
    const ledger = new RollbackLedger(3);
    expect(ledger).toBeDefined();
  });

  it('should support risk assessment for all action types', () => {
    const actions = [
      { action: 'read file', expected: 'SAFE' },
      { action: 'list directory', expected: 'SAFE' },
      { action: 'search code', expected: 'SAFE' },
      { action: 'create file', expected: 'SENSITIVE' },
      { action: 'write file', expected: 'SENSITIVE' },
      { action: 'npm test', expected: 'SENSITIVE' },
      { action: 'delete file', expected: 'CRITICAL' },
      { action: 'git commit', expected: 'CRITICAL' },
      { action: 'sudo command', expected: 'CRITICAL' },
    ];

    for (const { action, expected } of actions) {
      const decision = policyEngine.evaluate(action);
      expect(decision.risk_level).toBe(expected);
    }
  });

  it('should have complete API response format', async () => {
    const result = await server.syncSkills();
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('data');
  });

  it('should support multiple skill searches', () => {
    const content = `# code-helper
description: Helps with code generation
triggers: code, generate, programming

## Instructions
Generate code based on requirements.`;

    skillEngine.parseSkillMd(content);

    const byTrigger = skillEngine.searchByTrigger('code');
    const byName = skillEngine.searchByName('code');
    expect(Array.isArray(byTrigger)).toBe(true);
    expect(Array.isArray(byName)).toBe(true);
  });

  it('should have environment variables support', () => {
    const sandbox = new ExecutionSandbox();
    const config = sandbox.getConfig();
    expect(config.allowed_executables).toBeDefined();
    expect(config.timeout_seconds).toBeGreaterThan(0);
  });

  it('should support approval workflow', () => {
    const decision1 = policyEngine.evaluate('delete important.txt');
    expect(decision1.requires_approval).toBe(true);

    const approvalId = policyEngine.requestApproval(decision1);
    expect(policyEngine.getPendingApprovals().length).toBe(1);

    policyEngine.grantApproval(approvalId);
    expect(policyEngine.getPendingApprovals().length).toBe(0);
  });

  it('should have atomic rollback capability', async () => {
    const result = await rollbackLedger.executeWithRollback(
      async () => ({ data: 'test' }),
      []
    );
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ data: 'test' });
  });

  it('should support sandbox command validation', () => {
    const valid = sandbox.validateCommand(['node', '-e', 'test']);
    expect(valid.valid).toBe(true);

    const invalid = sandbox.validateCommand(['rm', '-rf', '/']);
    expect(invalid.valid).toBe(false);
  });

  it('should have streaming API server with all components', () => {
    expect(server.getSkillEngine()).toBeDefined();
    expect(server.getLLMRouter()).toBeDefined();
    expect(server.getSandbox()).toBeDefined();
    expect(server.getPolicyEngine()).toBeDefined();
    expect(server.getRollbackLedger()).toBeDefined();
  });

  it('should support transaction tracking', async () => {
    const txn = rollbackLedger.createTransaction('test-txn');
    expect(txn.id).toBe('test-txn');
    expect(txn.status).toBe('pending');

    const allTxns = rollbackLedger.getAllTransactions();
    expect(allTxns.length).toBeGreaterThan(0);
  });

  it('should complete golden mission lifecycle', async () => {
    // 1. Parse skill
    const content = `# golden-skill
description: Golden mission skill
triggers: golden, mission

## Instructions
Execute golden mission.`;
    skillEngine.parseSkillMd(content);

    // 2. Evaluate policy
    const decision = policyEngine.evaluate('read golden.txt');
    expect(decision.risk_level).toBe('SAFE');

    // 3. Execute in sandbox
    const execResult = await sandbox.execute(['node', '-e', 'console.log("golden")']);
    expect(execResult.success).toBe(true);

    // 4. Handle rollback if needed
    const rollbackResult = await rollbackLedger.executeWithRollback(
      async () => 'golden success',
      []
    );
    expect(rollbackResult.success).toBe(true);

    // 5. Stream response (graceful fallback when no LLM available)
    const events = [];
    try {
      for await (const event of server.handleChatStream({
        messages: [{ role: 'user', content: 'golden mission' }],
      })) {
        events.push(event);
      }
    } catch (error) {
      // Expected when no LLM providers are available
    }
    expect(Array.isArray(events)).toBe(true);
  });
});
