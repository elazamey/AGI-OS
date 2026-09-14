import { describe, it, expect, beforeEach } from 'vitest';
import { APIGateway } from '../src/index.js';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { createHmac } from 'crypto';

describe('APIGateway — Enterprise Platform v1.24.0', () => {
  let gateway: APIGateway;
  let testRegistry: string;

  beforeEach(() => {
    testRegistry = join(tmpdir(), `test-gw-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);
    mkdirSync(testRegistry, { recursive: true });
    gateway = new APIGateway({
      port: 4001,
      apiKeyRequired: true,
      rateLimitPerMinute: 100,
      registryPath: testRegistry,
      defaultBudgetUsd: 1.0,
      defaultBudgetTokens: 10000,
    });
  });

  // ═══════════════════════════════════════════════════════
  // HEALTH & METRICS
  // ═══════════════════════════════════════════════════════

  it('should return health status', () => {
    const res = gateway.health();
    expect(res.success).toBe(true);
    expect((res.data as any).status).toBe('ok');
    expect((res.data as any).version).toBe('1.24.0');
  });

  it('should return config', () => {
    const config = gateway.getConfig();
    expect(config.port).toBe(4001);
    expect(config.defaultBudgetUsd).toBe(1.0);
  });

  it('should return Prometheus metrics', () => {
    const metrics = gateway.getMetrics();
    expect(metrics).toContain('agi_os_missions_total');
    expect(metrics).toContain('agi_os_skills_total');
    expect(metrics).toContain('agi_os_tokens_total');
  });

  it('should return readiness check', () => {
    const ready = gateway.getReadiness();
    expect(ready.ready).toBe(true);
    expect(ready.checks.sandbox).toBe(true);
    expect(ready.checks.memory_store).toBe(true);
  });

  // ═══════════════════════════════════════════════════════
  // 1. SCOPED API KEYS (permissions)
  // ═══════════════════════════════════════════════════════

  it('should create and use scoped API keys', () => {
    gateway.createScopedKey('read-only-key', 'free', ['skills:read']);
    const key = gateway.getScopedKey('read-only-key');
    expect(key).not.toBeNull();
    expect(key!.tier).toBe('free');
    expect(key!.permissions).toContain('skills:read');
  });

  it('should enforce scoped permissions on skill listing', async () => {
    gateway.createScopedKey('read-only', 'free', ['skills:read']);
    const res = gateway.listSkills('read-only');
    expect(res.success).toBe(true);
  });

  it('should deny unauthorized scoped permissions', async () => {
    gateway.createScopedKey('no-missions', 'free', ['skills:read']);
    const res = await gateway.executeMission('test', {}, 'no-missions');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Permission denied');
  });

  it('should allow wildcard permissions', async () => {
    gateway.createScopedKey('admin-key', 'enterprise', ['*']);
    const res = await gateway.executeMission('test', {}, 'admin-key');
    expect(res.success).toBe(true);
  });

  it('should deny memory:write without permission', async () => {
    gateway.createScopedKey('read-only-mem', 'free', ['skills:read']);
    const res = await gateway.storeMemory('k', 'v', 'read-only-mem');
    expect(res.success).toBe(false);
    expect(res.error).toContain('memory:write');
  });

  // ═══════════════════════════════════════════════════════
  // 2. QUOTA & COST GUARD
  // ═══════════════════════════════════════════════════════

  it('should track token usage per key', async () => {
    gateway.createScopedKey('tracked', 'pro', ['*'], 100, 50000);
    await gateway.executeMission('short', {}, 'tracked');
    const usage = gateway.getUsage('tracked');
    expect(usage.success).toBe(true);
    expect((usage.data as any).spent_tokens).toBeGreaterThan(0);
  });

  it('should reject missions when token budget exceeded', async () => {
    gateway.createScopedKey('tight-budget', 'free', ['*'], 0.0001, 5);
    const res = await gateway.executeMission('this prompt exceeds the tiny budget', {}, 'tight-budget');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Budget exceeded');
  });

  it('should reject missions when USD budget exceeded', async () => {
    gateway.createScopedKey('zero-usd', 'free', ['*'], 0.0000001, 100000000);
    const res = await gateway.executeMission('budget test', {}, 'zero-usd');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Budget exceeded');
  });

  it('should accumulate spending across missions', async () => {
    gateway.createScopedKey('accum', 'pro', ['*'], 10, 100000);
    await gateway.executeMission('one', {}, 'accum');
    await gateway.executeMission('two', {}, 'accum');
    const usage = gateway.getUsage('accum');
    expect((usage.data as any).spent_tokens).toBeGreaterThan(0);
  });

  it('should return usage for unknown key', () => {
    const res = gateway.getUsage('nonexistent');
    expect(res.success).toBe(false);
  });

  // ═══════════════════════════════════════════════════════
  // 3. WEBHOOKS ENGINE
  // ═══════════════════════════════════════════════════════

  it('should send webhook on mission completion', async () => {
    const res = await gateway.executeMission('webhook test', { webhook_url: 'https://example.com/hook' }, 'agi-os-dev-key-2026');
    expect(res.success).toBe(true);
    const log = gateway.getWebhookLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].url).toBe('https://example.com/hook');
    expect(log[0].event).toBe('mission_completed');
  });

  it('should sign webhook payloads with HMAC', () => {
    const payload = JSON.stringify({ test: true });
    const sig = (gateway as any).signWebhook(payload);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
    expect(gateway.verifyWebhookSignature(payload, sig)).toBe(true);
  });

  it('should reject invalid webhook signature', () => {
    expect(gateway.verifyWebhookSignature('data', 'bad-sig')).toBe(false);
  });

  it('should log multiple webhooks', async () => {
    await gateway.executeMission('wh1', { webhook_url: 'https://a.com' }, 'agi-os-dev-key-2026');
    await gateway.executeMission('wh2', { webhook_url: 'https://b.com' }, 'agi-os-dev-key-2026');
    const log = gateway.getWebhookLog();
    expect(log.length).toBe(2);
  });

  // ═══════════════════════════════════════════════════════
  // 4. HUMAN-IN-THE-LOOP
  // ═══════════════════════════════════════════════════════

  it('should request approval for CRITICAL missions', async () => {
    const res = await gateway.executeMission('delete all data rm -rf /', {}, 'agi-os-dev-key-2026');
    expect(res.success).toBe(true);
    const mission = res.data as any;
    expect(mission.status).toBe('PENDING_APPROVAL');
    expect(mission.approval_status).toBe('pending');
  });

  it('should approve a pending mission', async () => {
    await gateway.executeMission('delete database DROP TABLE users', {}, 'agi-os-dev-key-2026');
    const pending = gateway.getPendingApprovals();
    expect(pending.length).toBeGreaterThan(0);

    const approveRes = gateway.approveMission(pending[0].approval_id);
    expect(approveRes.success).toBe(true);
    expect((approveRes.data as any).approved).toBe(true);
  });

  it('should reject a pending mission', async () => {
    await gateway.executeMission('delete rm -rf /tmp', {}, 'agi-os-dev-key-2026');
    const pending = gateway.getPendingApprovals();

    const rejectRes = gateway.rejectMission(pending[0].approval_id);
    expect(rejectRes.success).toBe(true);
    expect((rejectRes.data as any).rejected).toBe(true);
  });

  it('should return error for non-existent approval', () => {
    const res = gateway.approveMission('fake-approval');
    expect(res.success).toBe(false);
  });

  it('should list pending approvals', async () => {
    await gateway.executeMission('delete everything rm -rf', {}, 'agi-os-dev-key-2026');
    const list = gateway.getPendingApprovals();
    expect(list.length).toBe(1);
    expect(list[0].mission_id).toMatch(/^miss_/);
  });

  // ═══════════════════════════════════════════════════════
  // 5. OPENAI COMPATIBLE BRIDGE
  // ═══════════════════════════════════════════════════════

  it('should handle OpenAI chat completions format', async () => {
    const res = await gateway.handleChatCompletions({
      model: 'agi-os-local',
      messages: [{ role: 'user', content: 'hello' }],
    }, 'agi-os-dev-key-2026');

    expect(res.success).toBe(true);
    const completion = res.data as any;
    expect(completion.object).toBe('chat.completion');
    expect(completion.choices).toHaveLength(1);
    expect(completion.choices[0].message.role).toBe('assistant');
    expect(completion.model).toBe('agi-os-local');
  });

  it('should generate completion IDs', async () => {
    const res = await gateway.handleChatCompletions({
      messages: [{ role: 'user', content: 'test' }],
    }, 'agi-os-dev-key-2026');
    const id = (res.data as any).id;
    expect(id).toMatch(/^chatcmpl-/);
  });

  it('should reject OpenAI bridge without auth', async () => {
    const res = await gateway.handleChatCompletions({
      messages: [{ role: 'user', content: 'test' }],
    });
    expect(res.success).toBe(false);
  });

  it('should track usage in OpenAI format', async () => {
    const res = await gateway.handleChatCompletions({
      messages: [{ role: 'user', content: 'usage test' }],
    }, 'agi-os-dev-key-2026');
    const usage = (res.data as any).usage;
    expect(usage.total_tokens).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════
  // 6. AUTH (existing)
  // ═══════════════════════════════════════════════════════

  it('should reject requests without API key', async () => {
    const res = await gateway.executeMission('test');
    expect(res.success).toBe(false);
    expect(res.error).toContain('API key');
  });

  it('should reject invalid API key', async () => {
    const res = await gateway.executeMission('test', {}, 'invalid-key');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid');
  });

  it('should accept valid API key', async () => {
    const res = await gateway.executeMission('test mission', {}, 'agi-os-dev-key-2026');
    expect(res.success).toBe(true);
  });

  it('should work without auth when disabled', async () => {
    const openGateway = new APIGateway({ apiKeyRequired: false, registryPath: testRegistry });
    const res = await openGateway.executeMission('test');
    expect(res.success).toBe(true);
  });

  // ═══════════════════════════════════════════════════════
  // RATE LIMITING
  // ═══════════════════════════════════════════════════════

  it('should enforce rate limiting', async () => {
    const limitedGateway = new APIGateway({
      apiKeyRequired: false,
      rateLimitPerMinute: 2,
      registryPath: testRegistry,
    });

    await limitedGateway.executeMission('req1');
    await limitedGateway.executeMission('req2');
    const res = await limitedGateway.executeMission('req3');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Rate limit');
  });

  // ═══════════════════════════════════════════════════════
  // MISSIONS
  // ═══════════════════════════════════════════════════════

  it('should execute a mission through full lifecycle', async () => {
    const res = await gateway.executeMission(
      'Create a validation function and test it',
      { user_id: 'usr_123' },
      'agi-os-dev-key-2026',
    );
    expect(res.success).toBe(true);
    const mission = res.data as any;
    expect(mission.id).toMatch(/^miss_/);
    expect(mission.status).toBe('COMPLETED');
    expect(mission.prompt).toBe('Create a validation function and test it');
    expect(mission.events.length).toBeGreaterThan(0);
  });

  it('should get mission by ID', async () => {
    const createRes = await gateway.executeMission('test', {}, 'agi-os-dev-key-2026');
    const missionId = (createRes.data as any).id;
    const getRes = gateway.getMission(missionId, 'agi-os-dev-key-2026');
    expect(getRes.success).toBe(true);
    expect((getRes.data as any).id).toBe(missionId);
  });

  it('should return error for non-existent mission', () => {
    const res = gateway.getMission('nonexistent', 'agi-os-dev-key-2026');
    expect(res.success).toBe(false);
  });

  it('should list all missions', async () => {
    await gateway.executeMission('m1', {}, 'agi-os-dev-key-2026');
    await gateway.executeMission('m2', {}, 'agi-os-dev-key-2026');
    const res = gateway.listMissions('agi-os-dev-key-2026');
    expect((res.data as any[]).length).toBe(2);
  });

  it('should rollback a mission', async () => {
    const createRes = await gateway.executeMission('test', {}, 'agi-os-dev-key-2026');
    const missionId = (createRes.data as any).id;
    const rollbackRes = gateway.rollbackMission(missionId, 'agi-os-dev-key-2026');
    expect(rollbackRes.success).toBe(true);
    expect((rollbackRes.data as any).rolled_back).toBe(true);
  });

  it('should record mission events', async () => {
    const res = await gateway.executeMission('test events', {}, 'agi-os-dev-key-2026');
    const mission = res.data as any;
    expect(mission.events.some((e: any) => e.event === 'mission_accepted')).toBe(true);
    expect(mission.events.some((e: any) => e.event === 'policy_evaluated')).toBe(true);
    expect(mission.events.some((e: any) => e.event === 'verification_passed')).toBe(true);
  });

  // ═══════════════════════════════════════════════════════
  // MEMORY
  // ═══════════════════════════════════════════════════════

  it('should store and query memory', async () => {
    await gateway.storeMemory('key1', { data: 'test' }, 'agi-os-dev-key-2026');
    const queryRes = await gateway.queryMemory('test', 'agi-os-dev-key-2026');
    expect(queryRes.success).toBe(true);
    expect((queryRes.data as any).results.length).toBeGreaterThan(0);
  });

  it('should get self-model report', () => {
    const res = gateway.getSelfModel('agi-os-dev-key-2026');
    expect(res.success).toBe(true);
    const model = res.data as any;
    expect(model.version).toBe('1.24.0');
    expect(model.capabilities).toContain('openai-compat');
    expect(model.capabilities).toContain('webhooks');
  });

  // ═══════════════════════════════════════════════════════
  // SKILLS
  // ═══════════════════════════════════════════════════════

  it('should synthesize a new skill', async () => {
    const res = gateway.synthesizeSkill({
      name: 'api-enterprise-skill',
      description: 'Enterprise skill test',
      triggers: ['enterprise-test'],
      instructions: '1. Test',
      testCode: 'assert.ok(true)',
    }, 'agi-os-dev-key-2026');
    expect(res.success).toBe(true);
    expect((res.data as any).synthesized).toBe(true);
  });

  // ═══════════════════════════════════════════════════════
  // MCP
  // ═══════════════════════════════════════════════════════

  it('should handle MCP initialize', async () => {
    const res = await gateway.handleMCPRequest({ method: 'initialize', id: 1 });
    expect((res.result as any).protocolVersion).toBe('2024-11-05');
  });

  it('should list MCP tools', async () => {
    const res = await gateway.handleMCPRequest({ method: 'tools/list', id: 1 });
    expect((res.result as any).tools.length).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════════════════
  // INTEGRATION
  // ═══════════════════════════════════════════════════════

  it('should track mission count', async () => {
    expect(gateway.getMissionCount()).toBe(0);
    await gateway.executeMission('m1', {}, 'agi-os-dev-key-2026');
    expect(gateway.getMissionCount()).toBe(1);
  });

  it('should handle concurrent missions', async () => {
    const results = await Promise.all([
      gateway.executeMission('concurrent 1', {}, 'agi-os-dev-key-2026'),
      gateway.executeMission('concurrent 2', {}, 'agi-os-dev-key-2026'),
      gateway.executeMission('concurrent 3', {}, 'agi-os-dev-key-2026'),
    ]);
    results.forEach(r => expect(r.success).toBe(true));
    expect(gateway.getMissionCount()).toBe(3);
  });
});
