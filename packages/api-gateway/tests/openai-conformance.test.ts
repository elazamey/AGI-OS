import { describe, it, expect, beforeEach } from 'vitest';
import { APIGateway, openAIError } from '../src/index.js';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { tmpdir } from 'os';

// ═══════════════════════════════════════════════════════
// OpenAI Compatibility Conformance Suite
// Levels: L1 (Basic) → L4 (Tool Calling + Structured)
// ═══════════════════════════════════════════════════════

describe('OpenAI Compatibility Conformance Suite', () => {
  let gateway: APIGateway;
  let testRegistry: string;

  beforeEach(() => {
    testRegistry = join(tmpdir(), `test-oai-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);
    mkdirSync(testRegistry, { recursive: true });
    gateway = new APIGateway({
      port: 4001,
      apiKeyRequired: true,
      rateLimitPerMinute: 100,
      registryPath: testRegistry,
      defaultBudgetUsd: 100,
      defaultBudgetTokens: 1000000,
    });
  });

  // ═══════════════════════════════════════════════════════
  // L0: ERROR FORMAT COMPLIANCE
  // ═══════════════════════════════════════════════════════

  describe('L0 — Error Response Format', () => {
    it('should produce valid OpenAI error object', () => {
      const err = openAIError('Invalid API key', 'invalid_request_error', 'invalid_api_key');
      expect(err.error.message).toBe('Invalid API key');
      expect(err.error.type).toBe('invalid_request_error');
      expect(err.error.code).toBe('invalid_api_key');
      expect(err.error.param).toBeNull();
    });

    it('should return 401-style error for missing API key', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'hi' }],
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('API key');
    });

    it('should return 401-style error for invalid API key', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'hi' }],
      }, 'sk-invalid');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid');
    });

    it('should return 403-style error for insufficient permissions', async () => {
      gateway.createScopedKey('read-only', 'free', ['skills:read']);
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'hi' }],
      }, 'read-only');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Permission denied');
    });

    it('should return 429-style error for rate limiting', async () => {
      const limited = new APIGateway({ apiKeyRequired: false, rateLimitPerMinute: 1, registryPath: testRegistry });
      await limited.handleChatCompletions({ messages: [{ role: 'user', content: 'a' }] });
      const res = await limited.handleChatCompletions({ messages: [{ role: 'user', content: 'b' }] });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Rate limit');
    });

    it('should return budget exceeded error for quota violations', async () => {
      gateway.createScopedKey('broke', 'free', ['*'], 0.0000001, 1);
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'spend money' }],
      }, 'broke');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Budget exceeded');
    });
  });

  // ═══════════════════════════════════════════════════════
  // L1: BASIC CHAT COMPLETIONS
  // ═══════════════════════════════════════════════════════

  describe('L1 — Basic Chat Completions', () => {
    it('should return valid chat.completion object', async () => {
      const res = await gateway.handleChatCompletions({
        model: 'agi-os-local',
        messages: [{ role: 'user', content: 'hello' }],
      }, 'agi-os-dev-key-2026');

      expect(res.success).toBe(true);
      const c = res.data as any;
      expect(c.object).toBe('chat.completion');
      expect(c.id).toMatch(/^chatcmpl-/);
      expect(typeof c.created).toBe('number');
      expect(c.model).toBe('agi-os-local');
      expect(c.choices).toHaveLength(1);
      expect(c.choices[0].index).toBe(0);
      expect(c.choices[0].finish_reason).toBe('stop');
    });

    it('should include usage with prompt_tokens, completion_tokens, total_tokens', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'test' }],
      }, 'agi-os-dev-key-2026');
      const usage = (res.data as any).usage;
      expect(typeof usage.prompt_tokens).toBe('number');
      expect(typeof usage.completion_tokens).toBe('number');
      expect(typeof usage.total_tokens).toBe('number');
      expect(usage.total_tokens).toBe(usage.prompt_tokens + usage.completion_tokens);
    });

    it('should handle system role messages', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'hi' },
        ],
      }, 'agi-os-dev-key-2026');
      expect(res.success).toBe(true);
      const mission = await gateway.listMissions('agi-os-dev-key-2026');
      const last = (mission.data as any[]).slice(-1)[0];
      expect(last.context.system_prompt).toContain('helpful assistant');
    });

    it('should handle developer role messages', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [
          { role: 'developer', content: 'Follow strict rules' },
          { role: 'user', content: 'hello' },
        ],
      }, 'agi-os-dev-key-2026');
      expect(res.success).toBe(true);
    });

    it('should default model to agi-os-local', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'test' }],
      }, 'agi-os-dev-key-2026');
      expect((res.data as any).model).toBe('agi-os-local');
    });

    it('should list available models', () => {
      const models = gateway.listOpenAIModels();
      expect(models.object).toBe('list');
      expect(models.data.length).toBeGreaterThan(0);
      expect(models.data[0].id).toBe('agi-os-local');
      expect(models.data[0].object).toBe('model');
      expect(models.data[0].owned_by).toBe('agi-os');
    });
  });

  // ═══════════════════════════════════════════════════════
  // L2: STREAMING (SSE)
  // ═══════════════════════════════════════════════════════

  describe('L2 — Streaming / SSE', () => {
    it('should return stream flag when stream=true', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'stream test' }],
        stream: true,
      }, 'agi-os-dev-key-2026');

      expect(res.success).toBe(true);
      expect((res.data as any).stream).toBe(true);
    });

    it('should include _stream_chunks with role delta', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'chunk test' }],
        stream: true,
      }, 'agi-os-dev-key-2026');

      const chunks = (res.data as any)._stream_chunks;
      expect(chunks).toHaveLength(3);
      expect(chunks[0].choices[0].delta.role).toBe('assistant');
      expect(chunks[1].choices[0].delta.content).toBeDefined();
      expect(chunks[2].choices[0].finish_reason).toBe('stop');
    });

    it('should not include stream fields when stream=false', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'no stream' }],
        stream: false,
      }, 'agi-os-dev-key-2026');

      expect((res.data as any).stream).toBeUndefined();
      expect((res.data as any)._stream_chunks).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════
  // L3: TOOL CALLING / FUNCTION CALLING
  // ═══════════════════════════════════════════════════════

  describe('L3 — Tool Calling / Function Calling', () => {
    it('should accept tools parameter', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'search for docs' }],
        tools: [{
          type: 'function',
          function: {
            name: 'web_search',
            description: 'Search the web',
            parameters: { type: 'object', properties: { query: { type: 'string' } } },
          },
        }],
      }, 'agi-os-dev-key-2026');

      expect(res.success).toBe(true);
      expect((res.data as any).choices[0].finish_reason).toBe('tool_calls');
    });

    it('should return tool_calls in message', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'find info' }],
        tools: [{
          type: 'function',
          function: { name: 'lookup', description: 'Lookup', parameters: {} },
        }],
      }, 'agi-os-dev-key-2026');

      const msg = (res.data as any).choices[0].message;
      expect(msg.tool_calls).toBeDefined();
      expect(msg.tool_calls).toHaveLength(1);
      expect(msg.tool_calls[0].type).toBe('function');
      expect(msg.tool_calls[0].function.name).toBe('lookup');
      expect(msg.tool_calls[0].id).toMatch(/^call_/);
    });

    it('should accept tool_choice parameter', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'use tool' }],
        tools: [{
          type: 'function',
          function: { name: 'do_thing', description: 'Do thing', parameters: {} },
        }],
        tool_choice: 'required',
      }, 'agi-os-dev-key-2026');

      expect(res.success).toBe(true);
    });

    it('should handle tool result messages in conversation', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [
          { role: 'user', content: 'search' },
          { role: 'tool', content: '{"results": []}', tool_call_id: 'call_abc123' },
        ],
      }, 'agi-os-dev-key-2026');
      expect(res.success).toBe(true);
    });

    it('should log tool-calling compliance', async () => {
      await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'tool log' }],
        tools: [{
          type: 'function',
          function: { name: 'log_tool', description: 'Log', parameters: {} },
        }],
      }, 'agi-os-dev-key-2026');

      const log = gateway.getOpenAIComplianceLog();
      expect(log.some(e => e.level === 'L3')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════
  // L4: STRUCTURED OUTPUT
  // ═══════════════════════════════════════════════════════

  describe('L4 — Structured Output (response_format)', () => {
    it('should accept response_format=json_object', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'give json' }],
        response_format: { type: 'json_object' },
      }, 'agi-os-dev-key-2026');

      expect(res.success).toBe(true);
      const content = (res.data as any).choices[0].message.content;
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should return valid JSON in content when json_object requested', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'structured data' }],
        response_format: { type: 'json_object' },
      }, 'agi-os-dev-key-2026');

      const parsed = JSON.parse((res.data as any).choices[0].message.content);
      expect(parsed).toHaveProperty('result');
    });
  });

  // ═══════════════════════════════════════════════════════
  // GOVERNANCE CHAIN VERIFICATION
  // ═══════════════════════════════════════════════════════

  describe('Governance — Full Chain Through Bridge', () => {
    it('should enforce auth → scope → quota → policy → execution → audit', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'governed request' }],
      }, 'agi-os-dev-key-2026');

      expect(res.success).toBe(true);
      const missions = gateway.listMissions('agi-os-dev-key-2026');
      const mission = (missions.data as any[]).slice(-1)[0];
      const events = mission.events.map((e: any) => e.event);
      expect(events).toContain('mission_accepted');
      expect(events).toContain('policy_evaluated');
      expect(events).toContain('planning_started');
      expect(events).toContain('execution_completed');
      expect(events).toContain('verification_passed');
      expect(events).toContain('transaction_recorded');
    });

    it('should block CRITICAL missions through OpenAI bridge', async () => {
      const res = await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'delete all data rm -rf /' }],
      }, 'agi-os-dev-key-2026');

      expect(res.success).toBe(true);
      const mission = (res.data as any);
      const missions = gateway.listMissions('agi-os-dev-key-2026');
      const last = (missions.data as any[]).slice(-1)[0];
      expect(last.status).toBe('PENDING_APPROVAL');
    });

    it('should track costs through OpenAI bridge', async () => {
      gateway.createScopedKey('track-me', 'pro', ['*'], 100, 100000);
      await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'track cost' }],
      }, 'track-me');

      const usage = gateway.getUsage('track-me');
      expect((usage.data as any).spent_tokens).toBeGreaterThan(0);
    });

    it('should produce audit trail for every completion', async () => {
      await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'audit me' }],
      }, 'agi-os-dev-key-2026');

      const log = gateway.getOpenAIComplianceLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log[0].passed).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════
  // METRICS & READINESS
  // ═══════════════════════════════════════════════════════

  describe('Infrastructure — Metrics & Readiness', () => {
    it('should include OpenAI call count in metrics', async () => {
      await gateway.handleChatCompletions({
        messages: [{ role: 'user', content: 'metric' }],
      }, 'agi-os-dev-key-2026');

      const metrics = gateway.getMetrics();
      expect(metrics).toContain('agi_os_openai_calls_total');
    });

    it('should include openai_bridge in readiness checks', () => {
      const ready = gateway.getReadiness();
      expect(ready.checks.openai_bridge).toBe(true);
    });
  });
});
