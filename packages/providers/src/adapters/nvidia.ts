// ============================================================================
// AGI OS - NVIDIA NIM Adapter
// NVIDIA Inference Microservices — free tier with API key
// Endpoint: https://integrate.api.nvidia.com/v1
// ============================================================================

import type { ProviderAdapter, ProviderConfig, ProviderRequest, ProviderResponse, QuotaUsage } from '../types.js';

// ---------------------------------------------------------------------------
// NvidiaAdapter — maps unified interface to NVIDIA NIM REST API
// OpenAI-compatible endpoint for free NIM models
// ---------------------------------------------------------------------------
export class NvidiaAdapter implements ProviderAdapter {
  readonly id: string;
  readonly config: ProviderConfig;

  private apiKey: string;
  private quotaUsed: number = 0;

  constructor(config?: Partial<ProviderConfig> & { apiKey?: string }) {
    this.id = config?.id ?? 'nvidia';
    this.apiKey = config?.apiKey ?? process.env.NVIDIA_API_KEY ?? '';
    this.config = {
      id: this.id,
      type: 'cloud-free',
      baseUrl: config?.baseUrl ?? 'https://integrate.api.nvidia.com/v1',
      apiKey: this.apiKey,
      defaultModel: config?.defaultModel ?? 'meta/llama-3.1-8b-instruct',
      availableModels: config?.availableModels ?? [
        'meta/llama-3.1-8b-instruct',
        'meta/llama-3.1-70b-instruct',
        'meta/llama-3.1-405b-instruct',
        'meta/llama-3.2-1b-instruct',
        'meta/llama-3.2-3b-instruct',
        'nvidia/llama-3.1-nemotron-70b-instruct',
        'nvidia/nemotron-mini-4b-instruct',
        'google/gemma-2-9b-it',
        'mistralai/mistral-7b-instruct-v0.3',
        'microsoft/phi-3-mini-128k-instruct',
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
    if (!this.apiKey) return false;
    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
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
        },
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          max_tokens: request.maxTokens ?? 2048,
          temperature: request.temperature ?? 0.7,
          stream: false,
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
        id: `nvidia-${Date.now()}`,
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
      id: `nvidia-error-${Date.now()}`,
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
export function createNvidiaAdapter(config?: Partial<ProviderConfig> & { apiKey?: string }): NvidiaAdapter {
  return new NvidiaAdapter(config);
}
