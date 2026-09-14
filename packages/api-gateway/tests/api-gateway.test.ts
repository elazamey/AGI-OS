import { describe, it, expect, beforeEach } from 'vitest';
import { APIGateway } from '../src/index.js';
import { join } from 'path';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';

describe('APIGateway — Unified REST/WebSocket/MCP Layer', () => {
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
    });
  });

  // ═══════════════════════════════════════════════════════
  // HEALTH
  // ═══════════════════════════════════════════════════════

  it('should return health status', () => {
    const res = gateway.health();
    expect(res.success).toBe(true);
    expect((res.data as any).status).toBe('ok');
    expect((res.data as any).version).toBe('1.23.0');
  });

  it('should return config', () => {
    const config = gateway.getConfig();
    expect(config.port).toBe(4001);
    expect(config.apiKeyRequired).toBe(true);
  });

  // ═══════════════════════════════════════════════════════
  // AUTH
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

  it('should add and remove API keys', async () => {
    gateway.addApiKey('custom-key');
    const res = await gateway.executeMission('test', {}, 'custom-key');
    expect(res.success).toBe(true);
    gateway.removeApiKey('custom-key');
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
    expect(mission.result).toBeDefined();
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
    expect(res.error).toContain('not found');
  });

  it('should list all missions', async () => {
    await gateway.executeMission('mission 1', {}, 'agi-os-dev-key-2026');
    await gateway.executeMission('mission 2', {}, 'agi-os-dev-key-2026');

    const res = gateway.listMissions('agi-os-dev-key-2026');
    expect(res.success).toBe(true);
    expect((res.data as any[]).length).toBe(2);
  });

  it('should rollback a mission', async () => {
    const createRes = await gateway.executeMission('test', {}, 'agi-os-dev-key-2026');
    const missionId = (createRes.data as any).id;

    const rollbackRes = gateway.rollbackMission(missionId, 'agi-os-dev-key-2026');
    expect(rollbackRes.success).toBe(true);
    expect((rollbackRes.data as any).rolled_back).toBe(true);

    const getRes = gateway.getMission(missionId, 'agi-os-dev-key-2026');
    expect((getRes.data as any).status).toBe('FAILED');
  });

  it('should record mission events', async () => {
    const res = await gateway.executeMission('test events', {}, 'agi-os-dev-key-2026');
    const mission = res.data as any;
    expect(mission.events.some((e: any) => e.event === 'mission_accepted')).toBe(true);
    expect(mission.events.some((e: any) => e.event === 'policy_evaluated')).toBe(true);
    expect(mission.events.some((e: any) => e.event === 'verification_passed')).toBe(true);
    expect(mission.events.some((e: any) => e.event === 'transaction_recorded')).toBe(true);
  });

  // ═══════════════════════════════════════════════════════
  // MEMORY
  // ═══════════════════════════════════════════════════════

  it('should store and query memory', async () => {
    const storeRes = await gateway.storeMemory('key1', { data: 'test' }, 'agi-os-dev-key-2026');
    expect(storeRes.success).toBe(true);

    const queryRes = await gateway.queryMemory('test', 'agi-os-dev-key-2026');
    expect(queryRes.success).toBe(true);
    expect((queryRes.data as any).results.length).toBeGreaterThan(0);
  });

  it('should get self-model report', async () => {
    const res = gateway.getSelfModel('agi-os-dev-key-2026');
    expect(res.success).toBe(true);
    const model = res.data as any;
    expect(model.version).toBe('1.23.0');
    expect(model.capabilities).toContain('planning');
    expect(model.capabilities).toContain('skill-synthesis');
  });

  // ═══════════════════════════════════════════════════════
  // SKILLS
  // ═══════════════════════════════════════════════════════

  it('should list skills', () => {
    const res = gateway.listSkills('agi-os-dev-key-2026');
    expect(res.success).toBe(true);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('should synthesize a new skill', async () => {
    const res = gateway.synthesizeSkill({
      name: 'api-test-skill',
      description: 'Test skill via API',
      triggers: ['api-test'],
      instructions: '1. Test',
      testCode: 'const assert = require("assert"); assert.ok(true);',
    }, 'agi-os-dev-key-2026');

    expect(res.success).toBe(true);
    expect((res.data as any).synthesized).toBe(true);

    const listRes = gateway.listSkills('agi-os-dev-key-2026');
    expect((listRes.data as any[])).toContain('api-test-skill');
  });

  // ═══════════════════════════════════════════════════════
  // MCP
  // ═══════════════════════════════════════════════════════

  it('should handle MCP initialize', async () => {
    const res = await gateway.handleMCPRequest({ method: 'initialize', id: 1 });
    expect(res.result).toBeDefined();
    expect((res.result as any).protocolVersion).toBe('2024-11-05');
  });

  it('should list MCP tools', async () => {
    const res = await gateway.handleMCPRequest({ method: 'tools/list', id: 1 });
    const result = res.result as any;
    expect(result.tools.length).toBeGreaterThan(0);
  });

  it('should return MCP error for unknown method', async () => {
    const res = await gateway.handleMCPRequest({ method: 'unknown', id: 1 });
    expect(res.error).toBeDefined();
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
