// ============================================================================
// AGI OS - HuggingFace Adapter
// Free inference API — small monthly limit
// ============================================================================

import type { ProviderAdapter, ProviderConfig, ProviderRequest, ProviderResponse, QuotaUsage } from '../types.js';

// ---------------------------------------------------------------------------
// HuggingFaceAdapter — maps unified interface to HuggingFace Inference API
// ---------------------------------------------------------------------------
export class HuggingFaceAdapter implements ProviderAdapter {
  readonly id: string;
  readonly config: ProviderConfig;

  private apiKey: string;
  private quotaUsed: number = 0;

  constructor(config?: Partial<ProviderConfig> & { apiKey?: string }) {
    this.id = config?.id ?? 'huggingface';
    this.apiKey = config?.apiKey ?? process.env.HUGGINGFACE_API_KEY ?? '';
    this.config = {
      id: this.id,
      type: 'cloud-free',
      baseUrl: config?.baseUrl ?? 'https://api-inference.huggingface.co/models',
      apiKey: this.apiKey,
      defaultModel: config?.defaultModel ?? 'meta-llama/Llama-3.2-3B-Instruct',
      availableModels: config?.availableModels ?? [
        'meta-llama/Llama-3.2-3B-Instruct',
        'microsoft/Phi-3-mini-4k-instruct',
        'google/gemma-2-2b-it',
        'Qwen/Qwen2.5-3B-Instruct',
      ],
      rateLimitRpm: config?.rateLimitRpm ?? 10,
      rateLimitTpm: config?.rateLimitTpm ?? 50000,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      maxRetries: config?.maxRetries ?? 2,
      timeoutMs: config?.timeoutMs ?? 60000,
      priority: config?.priority ?? 4,
      ...config,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('https://huggingface.co/api/whoami-v2', {
        method: 'GET',
        headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
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
      const prompt = request.messages.map((m) => {
        if (m.role === 'system') return `<|system|>\n${m.content}`;
        if (m.role === 'user') return `<|user|>\n${m.content}`;
        return `<|assistant|>\n${m.content}`;
      }).join('\n') + '\n<|assistant|>';

      const response = await fetch(`${this.config.baseUrl}/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: request.maxTokens ?? 512,
            temperature: request.temperature ?? 0.7,
            return_full_text: false,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = (errorData as { error?: string }).error ?? `HTTP ${response.status}`;

        if (response.status === 429) {
          return { ...this.buildErrorResponse(request.id, model, latencyMs, errorMsg), finishReason: 'rate_limit' };
        }
        return this.buildErrorResponse(request.id, model, latencyMs, errorMsg);
      }

      const data = await response.json() as Array<{
        generated_text?: string;
      }>;

      const content = data[0]?.generated_text ?? '';
      const estimatedTokens = Math.ceil(content.length / 4);
      this.quotaUsed += estimatedTokens;

      return {
        id: `huggingface-${Date.now()}`,
        requestId: request.id,
        providerId: this.id,
        model,
        content,
        finishReason: 'stop',
        usage: {
          promptTokens: 0,
          completionTokens: estimatedTokens,
          totalTokens: estimatedTokens,
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
      id: `huggingface-error-${Date.now()}`,
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
export function createHuggingFaceAdapter(config?: Partial<ProviderConfig> & { apiKey?: string }): HuggingFaceAdapter {
  return new HuggingFaceAdapter(config);
}
