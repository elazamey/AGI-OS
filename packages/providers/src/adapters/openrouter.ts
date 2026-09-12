// ============================================================================
// AGI OS - OpenRouter Adapter
// Aggregator with free models — routes to various providers
// ============================================================================

import type { ProviderAdapter, ProviderConfig, ProviderRequest, ProviderResponse, QuotaUsage } from '../types.js';

// ---------------------------------------------------------------------------
// OpenRouterAdapter — maps unified interface to OpenRouter API
// ---------------------------------------------------------------------------
export class OpenRouterAdapter implements ProviderAdapter {
  readonly id: string;
  readonly config: ProviderConfig;

  private apiKey: string;
  private quotaUsed: number = 0;

  constructor(config?: Partial<ProviderConfig> & { apiKey?: string }) {
    this.id = config?.id ?? 'openrouter';
    this.apiKey = config?.apiKey ?? process.env.OPENROUTER_API_KEY ?? '';
    this.config = {
      id: this.id,
      type: 'cloud-free',
      baseUrl: config?.baseUrl ?? 'https://openrouter.ai/api/v1',
      apiKey: this.apiKey,
      defaultModel: config?.defaultModel ?? 'meta-llama/llama-3.2-3b-instruct:free',
      availableModels: config?.availableModels ?? [
        'meta-llama/llama-3.2-3b-instruct:free',
        'microsoft/phi-3-mini-128k-instruct:free',
        'google/gemma-2-9b-it:free',
        'qwen/qwen-2-7b-instruct:free',
      ],
      rateLimitRpm: config?.rateLimitRpm ?? 20,
      rateLimitTpm: config?.rateLimitTpm ?? 200000,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      maxRetries: config?.maxRetries ?? 2,
      timeoutMs: config?.timeoutMs ?? 30000,
      priority: config?.priority ?? 3,
      ...config,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async complete(request: ProviderRequest): Promise<ProviderResponse> {
    const model = request.model ?? this.config.defaultModel;
    const startTime = Date.now();

    if (!this.apiKey) {
      return this.buildErrorResponse(request.id, model, Date.now() - startTime, 'No API key configured');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://agi-os.local',
          'X-Title': 'AGI OS',
        },
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: request.maxTokens ?? 2048,
          temperature: request.temperature ?? 0.7,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = (errorData as { error?: { message?: string } }).error?.message ?? `HTTP ${response.status}`;

        if (response.status === 429) {
          return { ...this.buildErrorResponse(request.id, model, latencyMs, errorMsg), finishReason: 'rate_limit' };
        }
        return this.buildErrorResponse(request.id, model, latencyMs, errorMsg);
      }

      const data = await response.json() as {
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const choice = data.choices?.[0];
      const content = choice?.message?.content ?? '';
      const usage = data.usage ?? {};

      this.quotaUsed += usage.total_tokens ?? 0;

      const finishReason = choice?.finish_reason === 'stop' ? 'stop'
        : choice?.finish_reason === 'length' ? 'length'
        : 'stop';

      return {
        id: `openrouter-${Date.now()}`,
        requestId: request.id,
        providerId: this.id,
        model,
        content,
        finishReason,
        usage: {
          promptTokens: usage.prompt_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? 0,
          totalTokens: usage.total_tokens ?? 0,
        },
        latencyMs,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      return this.buildErrorResponse(request.id, model, latencyMs, message);
    }
  }

  async getQuotaUsage(): Promise<QuotaUsage> {
    return {
      providerId: this.id,
      windowStart: new Date().toISOString(),
      windowEnd: new Date().toISOString(),
      requestsUsed: this.quotaUsed,
      requestsLimit: this.config.rateLimitRpm,
      tokensUsed: this.quotaUsed,
      tokensLimit: this.config.rateLimitTpm,
    };
  }

  isModelAvailable(model: string): boolean {
    return this.config.availableModels.includes(model);
  }

  private buildErrorResponse(
    requestId: string,
    model: string,
    latencyMs: number,
    error: string
  ): ProviderResponse {
    return {
      id: `openrouter-error-${Date.now()}`,
      requestId,
      providerId: this.id,
      model,
      content: '',
      finishReason: 'error',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs,
      timestamp: new Date().toISOString(),
      error,
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createOpenRouterAdapter(config?: Partial<ProviderConfig> & { apiKey?: string }): OpenRouterAdapter {
  return new OpenRouterAdapter(config);
}
