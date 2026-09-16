import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaAdapter } from '../src/adapters/ollama.js';
import { GeminiAdapter } from '../src/adapters/gemini.js';
import { OpenRouterAdapter } from '../src/adapters/openrouter.js';
import { HuggingFaceAdapter } from '../src/adapters/huggingface.js';

// ============================================================================
// Ollama Adapter Tests
// ============================================================================
describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter;

  beforeEach(() => {
    adapter = new OllamaAdapter();
    vi.restoreAllMocks();
  });

  it('should have correct defaults', () => {
    expect(adapter.id).toBe('ollama');
    expect(adapter.config.type).toBe('local');
    expect(adapter.config.costPerInputToken).toBe(0);
    expect(adapter.config.costPerOutputToken).toBe(0);
  });

  it('should check model availability', () => {
    expect(adapter.isModelAvailable('llama3.2:latest')).toBe(true);
    expect(adapter.isModelAvailable('nonexistent')).toBe(false);
  });

  it('should return no quota limits for local provider', async () => {
    const quota = await adapter.getQuotaUsage();
    expect(quota.requestsLimit).toBeNull();
    expect(quota.tokensLimit).toBeNull();
  });

  it('should handle health check failure gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const healthy = await adapter.healthCheck();
    expect(healthy).toBe(false);
  });

  it('should complete request successfully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: { content: 'Hello from Ollama' },
        eval_count: 50,
        prompt_eval_count: 20,
        done: true,
      }),
    }));

    const response = await adapter.complete({
      id: 'test-1',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(response.content).toBe('Hello from Ollama');
    expect(response.finishReason).toBe('stop');
    expect(response.usage.completionTokens).toBe(50);
    expect(response.providerId).toBe('ollama');
  });

  it('should handle network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const response = await adapter.complete({
      id: 'test-2',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(response.finishReason).toBe('error');
    expect(response.error).toContain('timeout');
  });

  it('should handle HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      text: () => Promise.resolve('Model not found'),
    }));
    const response = await adapter.complete({
      id: 'test-3',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(response.finishReason).toBe('error');
  });
});

// ============================================================================
// Gemini Adapter Tests
// ============================================================================
describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;

  beforeEach(() => {
    adapter = new GeminiAdapter({ apiKey: 'test-key' });
    vi.restoreAllMocks();
  });

  it('should have correct defaults', () => {
    expect(adapter.id).toBe('gemini');
    expect(adapter.config.type).toBe('cloud-free');
    expect(adapter.config.costPerInputToken).toBe(0);
  });

  it('should fail health check without API key', async () => {
    const noKey = new GeminiAdapter({ apiKey: '' });
    expect(await noKey.healthCheck()).toBe(false);
  });

  it('should complete request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'Hi from Gemini' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
      }),
    }));

    const response = await adapter.complete({
      id: 'test-g1',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(response.content).toBe('Hi from Gemini');
    expect(response.usage.totalTokens).toBe(30);
  });

  it('should handle rate limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: { message: 'Rate limited' } }),
    }));
    const response = await adapter.complete({
      id: 'test-g2',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(response.finishReason).toBe('rate_limit');
  });

  it('should check model availability', () => {
    expect(adapter.isModelAvailable('gemini-2.0-flash')).toBe(true);
    expect(adapter.isModelAvailable('gpt-4')).toBe(false);
  });
});

// ============================================================================
// OpenRouter Adapter Tests
// ============================================================================
describe('OpenRouterAdapter', () => {
  let adapter: OpenRouterAdapter;

  beforeEach(() => {
    adapter = new OpenRouterAdapter({ apiKey: 'test-key' });
    vi.restoreAllMocks();
  });

  it('should have correct defaults', () => {
    expect(adapter.id).toBe('openrouter');
    expect(adapter.config.type).toBe('cloud-free');
    expect(adapter.config.costPerInputToken).toBe(0);
  });

  it('should complete request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'Hi from OpenRouter' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 15, total_tokens: 25 },
      }),
    }));

    const response = await adapter.complete({
      id: 'test-or1',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(response.content).toBe('Hi from OpenRouter');
    expect(response.finishReason).toBe('stop');
  });

  it('should handle error without API key', async () => {
    const noKey = new OpenRouterAdapter({ apiKey: '' });
    const response = await noKey.complete({
      id: 'test-or2',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(response.finishReason).toBe('error');
    expect(response.error).toContain('No API key');
  });

  it('should check model availability', () => {
    expect(adapter.isModelAvailable('meta-llama/llama-3.2-3b-instruct:free')).toBe(true);
  });
});

// ============================================================================
// HuggingFace Adapter Tests
// ============================================================================
describe('HuggingFaceAdapter', () => {
  let adapter: HuggingFaceAdapter;

  beforeEach(() => {
    adapter = new HuggingFaceAdapter({ apiKey: 'test-key' });
    vi.restoreAllMocks();
  });

  it('should have correct defaults', () => {
    expect(adapter.id).toBe('huggingface');
    expect(adapter.config.type).toBe('cloud-free');
    expect(adapter.config.costPerInputToken).toBe(0);
  });

  it('should complete request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ generated_text: 'Hi from HuggingFace' }]),
    }));

    const response = await adapter.complete({
      id: 'test-hf1',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(response.content).toBe('Hi from HuggingFace');
    expect(response.finishReason).toBe('stop');
  });

  it('should handle error without API key', async () => {
    const noKey = new HuggingFaceAdapter({ apiKey: '' });
    const response = await noKey.complete({
      id: 'test-hf2',
      messages: [{ role: 'user', content: 'Hi' }],
    });
    expect(response.finishReason).toBe('error');
  });

  it('should check model availability', () => {
    expect(adapter.isModelAvailable('meta-llama/Llama-3.2-3B-Instruct')).toBe(true);
    expect(adapter.isModelAvailable('gpt-4')).toBe(false);
  });
});
