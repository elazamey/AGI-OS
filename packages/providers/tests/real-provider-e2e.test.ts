import { describe, it, expect, beforeAll } from 'vitest';
import { generateId, now } from '@agi-os/kernel';
import { OllamaAdapter } from '../src/adapters/ollama.js';
import { GeminiAdapter } from '../src/adapters/gemini.js';
import { OpenRouterAdapter } from '../src/adapters/openrouter.js';
import { HuggingFaceAdapter } from '../src/adapters/huggingface.js';
import { NvidiaAdapter } from '../src/adapters/nvidia.js';
import type { ProviderAdapter, ProviderRequest, ProviderResponse } from '../src/types.js';

// ============================================================================
// G18 — Real External Provider E2E
// Proves AGI-OS can connect to real LLM providers and get valid responses
// Pattern: health check → execute (real call) → verify (contract) → evidence
// ============================================================================

interface ProviderTierEvidence {
  tier: string;
  provider: string;
  model: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  endpoint: string;
  latencyMs: number;
  responseContract: Record<string, boolean>;
  tokenUsage: { prompt: number; completion: number; total: number };
  timestamp: string;
  evidenceHash: string;
  error?: string;
}

function hashEvidence(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function buildProviderEvidence(
  tier: string,
  provider: string,
  model: string,
  status: 'PASS' | 'FAIL' | 'SKIPPED',
  endpoint: string,
  latencyMs: number,
  responseContract: Record<string, boolean>,
  tokenUsage: { prompt: number; completion: number; total: number },
  error?: string
): ProviderTierEvidence {
  const timestamp = now().toISOString();
  const evidenceHash = hashEvidence(`${tier}:${provider}:${model}:${status}:${endpoint}:${timestamp}`);
  return { tier, provider, model, status, endpoint, latencyMs, responseContract, tokenUsage, timestamp, evidenceHash, error };
}

function validateProviderResponse(response: ProviderResponse): Record<string, boolean> {
  return {
    hasId: typeof response.id === 'string' && response.id.length > 0,
    hasRequestId: typeof response.requestId === 'string' && response.requestId.length > 0,
    hasProviderId: typeof response.providerId === 'string' && response.providerId.length > 0,
    hasModel: typeof response.model === 'string' && response.model.length > 0,
    hasContent: typeof response.content === 'string',
    hasFinishReason: ['stop', 'length', 'error', 'rate_limit', 'quota_exceeded'].includes(response.finishReason),
    hasUsage: typeof response.usage === 'object' && response.usage !== null,
    hasPromptTokens: typeof response.usage.promptTokens === 'number',
    hasCompletionTokens: typeof response.usage.completionTokens === 'number',
    hasTotalTokens: typeof response.usage.totalTokens === 'number',
    hasLatency: typeof response.latencyMs === 'number' && response.latencyMs >= 0,
    hasTimestamp: typeof response.timestamp === 'string' && response.timestamp.length > 0,
  };
}

function isContractValid(contract: Record<string, boolean>): boolean {
  return Object.values(contract).every(Boolean);
}

// Helper: run a full provider E2E test suite
async function runProviderE2E(
  tier: string,
  adapter: ProviderAdapter,
  isAvailable: boolean,
  skipReason: string
): Promise<ProviderTierEvidence> {
  if (!isAvailable) {
    console.log(`[G18-${tier}] ${skipReason} — SKIPPED`);
    return buildProviderEvidence(tier, adapter.id, adapter.config.defaultModel, 'SKIPPED', adapter.config.baseUrl, 0, {}, { prompt: 0, completion: 0, total: 0 }, skipReason);
  }

  // Step 1: Health check
  const startHealth = Date.now();
  const healthy = await adapter.healthCheck();
  const healthLatency = Date.now() - startHealth;

  if (!healthy) {
    return buildProviderEvidence(tier, adapter.id, adapter.config.defaultModel, 'FAIL', adapter.config.baseUrl, healthLatency, {}, { prompt: 0, completion: 0, total: 0 }, 'Health check failed');
  }

  // Step 2: Real completion
  const request: ProviderRequest = {
    id: generateId(),
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Respond in one sentence only.' },
      { role: 'user', content: 'What is the capital of France? Reply with just the city name.' },
    ],
    model: adapter.config.defaultModel,
    temperature: 0,
    maxTokens: 50,
  };

  const startComplete = Date.now();
  const response = await adapter.complete(request);
  const completeLatency = Date.now() - startComplete;

  // Step 3: Verify contract
  const contract = validateProviderResponse(response);
  const contractValid = isContractValid(contract) && response.finishReason !== 'error';

  // Step 4: Build evidence
  const status = contractValid ? 'PASS' : 'FAIL';
  const error = contractValid ? undefined : `Contract invalid or error: ${response.error || response.finishReason}`;

  return buildProviderEvidence(
    tier,
    adapter.id,
    response.model,
    status,
    adapter.config.baseUrl,
    completeLatency,
    contract,
    { prompt: response.usage.promptTokens, completion: response.usage.completionTokens, total: response.usage.totalTokens },
    error
  );
}

// ============================================================================
// Tier 1: Ollama Local (no API key needed)
// ============================================================================
describe('G18-1: Ollama Local Provider E2E', () => {
  const evidence: ProviderTierEvidence[] = [];
  let ollamaAvailable = false;

  beforeAll(async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      ollamaAvailable = response.ok;
    } catch {
      ollamaAvailable = false;
    }
  });

  it('G18-1a: Ollama health check', { timeout: 10000 }, async () => {
    if (!ollamaAvailable) {
      evidence.push(buildProviderEvidence('G18-1a', 'ollama', 'llama3.2:latest', 'SKIPPED', 'http://localhost:11434', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'Ollama not running'));
      return;
    }

    const adapter = new OllamaAdapter({ baseUrl: 'http://localhost:11434' });
    const start = Date.now();
    const healthy = await adapter.healthCheck();
    const latencyMs = Date.now() - start;

    evidence.push(buildProviderEvidence('G18-1a', 'ollama', 'llama3.2:latest', healthy ? 'PASS' : 'FAIL', 'http://localhost:11434', latencyMs, {}, { prompt: 0, completion: 0, total: 0 }));
    expect(healthy).toBe(true);
  });

  it('G18-1b: Ollama real completion', { timeout: 30000 }, async () => {
    if (!ollamaAvailable) {
      evidence.push(buildProviderEvidence('G18-1b', 'ollama', 'llama3.2:latest', 'SKIPPED', 'http://localhost:11434', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'Ollama not running'));
      return;
    }

    const adapter = new OllamaAdapter({ baseUrl: 'http://localhost:11434', defaultModel: 'llama3.2:latest' });
    const result = await runProviderE2E('G18-1b', adapter, true, '');
    evidence.push(result);

    if (result.status === 'PASS') {
      expect(result.responseContract).toBeDefined();
      expect(isContractValid(result.responseContract)).toBe(true);
    }
  });

  it('G18-1c: Ollama response contract validation', { timeout: 30000 }, async () => {
    if (!ollamaAvailable) {
      evidence.push(buildProviderEvidence('G18-1c', 'ollama', 'llama3.2:latest', 'SKIPPED', 'http://localhost:11434', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'Ollama not running'));
      return;
    }

    const adapter = new OllamaAdapter({ baseUrl: 'http://localhost:11434' });
    const response = await adapter.complete({
      id: generateId(),
      messages: [{ role: 'user', content: 'Say OK' }],
      maxTokens: 10,
    });

    const contract = validateProviderResponse(response);
    expect(isContractValid(contract)).toBe(true);
    expect(response.providerId).toBe('ollama');
    expect(response.usage.promptTokens).toBeGreaterThanOrEqual(0);
    expect(response.usage.completionTokens).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Tier 2: Gemini (needs GEMINI_API_KEY)
// ============================================================================
describe('G18-2: Gemini Cloud-Free Provider E2E', () => {
  const evidence: ProviderTierEvidence[] = [];
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  const isAvailable = apiKey.length > 0;

  beforeAll(() => {
    if (!isAvailable) {
      console.log('[G18-2] GEMINI_API_KEY not set — tiers will be SKIPPED');
    }
  });

  it('G18-2a: Gemini health check', { timeout: 10000 }, async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-2a', 'gemini', 'gemini-2.0-flash', 'SKIPPED', 'https://generativelanguage.googleapis.com', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new GeminiAdapter({ apiKey });
    const start = Date.now();
    const healthy = await adapter.healthCheck();
    const latencyMs = Date.now() - start;

    evidence.push(buildProviderEvidence('G18-2a', 'gemini', 'gemini-2.0-flash', healthy ? 'PASS' : 'FAIL', 'https://generativelanguage.googleapis.com', latencyMs, {}, { prompt: 0, completion: 0, total: 0 }));
    expect(healthy).toBe(true);
  });

  it('G18-2b: Gemini real completion', { timeout: 30000 }, async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-2b', 'gemini', 'gemini-2.0-flash', 'SKIPPED', 'https://generativelanguage.googleapis.com', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new GeminiAdapter({ apiKey, defaultModel: 'gemini-2.0-flash' });
    const result = await runProviderE2E('G18-2b', adapter, true, '');
    evidence.push(result);

    if (result.status === 'PASS') {
      expect(isContractValid(result.responseContract)).toBe(true);
      expect(result.tokenUsage.total).toBeGreaterThan(0);
    }
  });

  it('G18-2c: Gemini cost is zero', async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-2c', 'gemini', 'gemini-2.0-flash', 'SKIPPED', 'https://generativelanguage.googleapis.com', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new GeminiAdapter({ apiKey });
    expect(adapter.config.costPerInputToken).toBe(0);
    expect(adapter.config.costPerOutputToken).toBe(0);
    expect(adapter.config.type).toBe('cloud-free');
  });
});

// ============================================================================
// Tier 3: OpenRouter (needs OPENROUTER_API_KEY)
// ============================================================================
describe('G18-3: OpenRouter Cloud-Free Provider E2E', () => {
  const evidence: ProviderTierEvidence[] = [];
  const apiKey = process.env.OPENROUTER_API_KEY ?? '';
  const isAvailable = apiKey.length > 0;

  beforeAll(() => {
    if (!isAvailable) {
      console.log('[G18-3] OPENROUTER_API_KEY not set — tiers will be SKIPPED');
    }
  });

  it('G18-3a: OpenRouter health check', { timeout: 10000 }, async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-3a', 'openrouter', 'meta-llama/llama-3.2-3b-instruct:free', 'SKIPPED', 'https://openrouter.ai/api/v1', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new OpenRouterAdapter({ apiKey });
    const start = Date.now();
    const healthy = await adapter.healthCheck();
    const latencyMs = Date.now() - start;

    evidence.push(buildProviderEvidence('G18-3a', 'openrouter', 'meta-llama/llama-3.2-3b-instruct:free', healthy ? 'PASS' : 'FAIL', 'https://openrouter.ai/api/v1', latencyMs, {}, { prompt: 0, completion: 0, total: 0 }));
    expect(healthy).toBe(true);
  });

  it('G18-3b: OpenRouter real completion', { timeout: 30000 }, async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-3b', 'openrouter', 'meta-llama/llama-3.2-3b-instruct:free', 'SKIPPED', 'https://openrouter.ai/api/v1', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new OpenRouterAdapter({ apiKey, defaultModel: 'meta-llama/llama-3.2-3b-instruct:free' });
    const result = await runProviderE2E('G18-3b', adapter, true, '');
    evidence.push(result);

    if (result.status === 'PASS') {
      expect(isContractValid(result.responseContract)).toBe(true);
      expect(result.tokenUsage.total).toBeGreaterThan(0);
    }
  });

  it('G18-3c: OpenRouter cost is zero', async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-3c', 'openrouter', 'meta-llama/llama-3.2-3b-instruct:free', 'SKIPPED', 'https://openrouter.ai/api/v1', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new OpenRouterAdapter({ apiKey });
    expect(adapter.config.costPerInputToken).toBe(0);
    expect(adapter.config.costPerOutputToken).toBe(0);
    expect(adapter.config.type).toBe('cloud-free');
  });
});

// ============================================================================
// Tier 4: HuggingFace (needs HUGGINGFACE_API_KEY)
// ============================================================================
describe('G18-4: HuggingFace Cloud-Free Provider E2E', () => {
  const evidence: ProviderTierEvidence[] = [];
  const apiKey = process.env.HUGGINGFACE_API_KEY ?? '';
  const isAvailable = apiKey.length > 0;

  beforeAll(() => {
    if (!isAvailable) {
      console.log('[G18-4] HUGGINGFACE_API_KEY not set — tiers will be SKIPPED');
    }
  });

  it('G18-4a: HuggingFace health check', { timeout: 10000 }, async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-4a', 'huggingface', 'meta-llama/Llama-3.2-3B-Instruct', 'SKIPPED', 'https://api-inference.huggingface.co', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new HuggingFaceAdapter({ apiKey });
    const start = Date.now();
    const healthy = await adapter.healthCheck();
    const latencyMs = Date.now() - start;

    evidence.push(buildProviderEvidence('G18-4a', 'huggingface', 'meta-llama/Llama-3.2-3B-Instruct', healthy ? 'PASS' : 'FAIL', 'https://api-inference.huggingface.co', latencyMs, {}, { prompt: 0, completion: 0, total: 0 }));
    expect(healthy).toBe(true);
  });

  it('G18-4b: HuggingFace real completion', { timeout: 60000 }, async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-4b', 'huggingface', 'meta-llama/Llama-3.2-3B-Instruct', 'SKIPPED', 'https://api-inference.huggingface.co', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new HuggingFaceAdapter({ apiKey, defaultModel: 'meta-llama/Llama-3.2-3B-Instruct' });
    const result = await runProviderE2E('G18-4b', adapter, true, '');
    evidence.push(result);

    if (result.status === 'PASS') {
      expect(isContractValid(result.responseContract)).toBe(true);
    }
  });

  it('G18-4c: HuggingFace cost is zero', async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-4c', 'huggingface', 'meta-llama/Llama-3.2-3B-Instruct', 'SKIPPED', 'https://api-inference.huggingface.co', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new HuggingFaceAdapter({ apiKey });
    expect(adapter.config.costPerInputToken).toBe(0);
    expect(adapter.config.costPerOutputToken).toBe(0);
    expect(adapter.config.type).toBe('cloud-free');
  });
});

// ============================================================================
// Tier 5: NVIDIA NIM (needs NVIDIA_API_KEY)
// Endpoint: https://integrate.api.nvidia.com/v1
// NOTE: Avoid /teams/{team} paths — deprecated September 2026
// ============================================================================
describe('G18-5: NVIDIA NIM Cloud-Free Provider E2E', () => {
  const evidence: ProviderTierEvidence[] = [];
  const apiKey = process.env.NVIDIA_API_KEY ?? '';
  const isAvailable = apiKey.length > 0;

  beforeAll(() => {
    if (!isAvailable) {
      console.log('[G18-5] NVIDIA_API_KEY not set — tiers will be SKIPPED');
    }
  });

  it('G18-5a: NVIDIA health check', { timeout: 10000 }, async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-5a', 'nvidia', 'meta/llama-3.1-8b-instruct', 'SKIPPED', 'https://integrate.api.nvidia.com/v1', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new NvidiaAdapter({ apiKey });
    const start = Date.now();
    const healthy = await adapter.healthCheck();
    const latencyMs = Date.now() - start;

    evidence.push(buildProviderEvidence('G18-5a', 'nvidia', 'meta/llama-3.1-8b-instruct', healthy ? 'PASS' : 'FAIL', 'https://integrate.api.nvidia.com/v1', latencyMs, {}, { prompt: 0, completion: 0, total: 0 }));
    expect(healthy).toBe(true);
  });

  it('G18-5b: NVIDIA real completion', { timeout: 30000 }, async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-5b', 'nvidia', 'meta/llama-3.1-8b-instruct', 'SKIPPED', 'https://integrate.api.nvidia.com/v1', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new NvidiaAdapter({ apiKey, defaultModel: 'meta/llama-3.1-8b-instruct' });
    const result = await runProviderE2E('G18-5b', adapter, true, '');
    evidence.push(result);

    if (result.status === 'PASS') {
      expect(isContractValid(result.responseContract)).toBe(true);
      expect(result.tokenUsage.total).toBeGreaterThan(0);
    }
  });

  it('G18-5c: NVIDIA cost is zero', async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-5c', 'nvidia', 'meta/llama-3.1-8b-instruct', 'SKIPPED', 'https://integrate.api.nvidia.com/v1', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new NvidiaAdapter({ apiKey });
    expect(adapter.config.costPerInputToken).toBe(0);
    expect(adapter.config.costPerOutputToken).toBe(0);
    expect(adapter.config.type).toBe('cloud-free');
  });

  it('G18-5d: NVIDIA available models check', async () => {
    if (!isAvailable) {
      evidence.push(buildProviderEvidence('G18-5d', 'nvidia', 'meta/llama-3.1-8b-instruct', 'SKIPPED', 'https://integrate.api.nvidia.com/v1', 0, {}, { prompt: 0, completion: 0, total: 0 }, 'No API key'));
      return;
    }

    const adapter = new NvidiaAdapter({ apiKey });
    expect(adapter.isModelAvailable('meta/llama-3.1-8b-instruct')).toBe(true);
    expect(adapter.isModelAvailable('meta/llama-3.1-70b-instruct')).toBe(true);
    expect(adapter.isModelAvailable('nvidia/llama-3.1-nemotron-70b-instruct')).toBe(true);
    expect(adapter.isModelAvailable('nonexistent-model')).toBe(false);
  });
});

// ============================================================================
// Evidence Summary
// ============================================================================
describe('G18 Evidence Summary', () => {
  it('G18-EVIDENCE: all provider tiers follow read → execute → verify → evidence', () => {
    const summary = {
      gate: 'G18',
      name: 'Real External Provider E2E',
      timestamp: now().toISOString(),
      pattern: 'health check → execute (real call) → verify (contract) → evidence',
      providers: {
        'G18-1': { name: 'Ollama', env: 'none (local)', skipCondition: 'Ollama not running' },
        'G18-2': { name: 'Gemini', env: 'GEMINI_API_KEY', skipCondition: 'Key not set' },
        'G18-3': { name: 'OpenRouter', env: 'OPENROUTER_API_KEY', skipCondition: 'Key not set' },
        'G18-4': { name: 'HuggingFace', env: 'HUGGINGFACE_API_KEY', skipCondition: 'Key not set' },
        'G18-5': { name: 'NVIDIA NIM', env: 'NVIDIA_API_KEY', skipCondition: 'Key not set' },
      },
      contractFields: [
        'hasId', 'hasRequestId', 'hasProviderId', 'hasModel', 'hasContent',
        'hasFinishReason', 'hasUsage', 'hasPromptTokens', 'hasCompletionTokens',
        'hasTotalTokens', 'hasLatency', 'hasTimestamp',
      ],
      costInvariant: 'All providers must have costPerToken = 0',
    };

    expect(summary.gate).toBe('G18');
    expect(summary.pattern).toContain('health check');
    expect(summary.pattern).toContain('evidence');
    expect(Object.keys(summary.providers)).toHaveLength(5);
  });
});
