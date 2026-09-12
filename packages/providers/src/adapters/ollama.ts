// ============================================================================
// AGI OS - Ollama Adapter
// Local LLM provider — $0 cost, runs on user hardware
// ============================================================================

import type { ProviderAdapter, ProviderConfig, ProviderRequest, ProviderResponse, QuotaUsage } from '../types.js';

// ---------------------------------------------------------------------------
// OllamaAdapter — maps unified interface to Ollama REST API
// ---------------------------------------------------------------------------
export class OllamaAdapter implements ProviderAdapter {
  readonly id: string;
  readonly config: ProviderConfig;

  private baseUrl: string;

  constructor(config?: Partial<ProviderConfig>) {
    this.id = config?.id ?? 'ollama';
    this.baseUrl = config?.baseUrl ?? 'http://localhost:11434';
    this.config = {
      id: this.id,
      type: 'local',
      baseUrl: this.baseUrl,
      defaultModel: config?.defaultModel ?? 'llama3.2:latest',
      availableModels: config?.availableModels ?? ['llama3.2:latest', 'codellama:latest', 'mistral:latest', 'gemma2:latest'],
      rateLimitRpm: null,
      rateLimitTpm: null,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      maxRetries: config?.maxRetries ?? 2,
      timeoutMs: config?.timeoutMs ?? 30000,
      priority: config?.priority ?? 1,
      apiKey: undefined,
      ...config,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
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

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: false,
          options: {
            num_predict: request.maxTokens ?? 2048,
            temperature: request.temperature ?? 0.7,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return this.buildErrorResponse(request.id, model, latencyMs, errorText);
      }

      const data = await response.json() as {
        message?: { content?: string };
        eval_count?: number;
        prompt_eval_count?: number;
        done?: boolean;
      };

      const completionTokens = data.eval_count ?? 0;
      const promptTokens = data.prompt_eval_count ?? 0;

      return {
        id: `ollama-${Date.now()}`,
        requestId: request.id,
        providerId: this.id,
        model,
        content: data.message?.content ?? '',
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
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
    // Local provider has no quota limits
    return {
      providerId: this.id,
      windowStart: new Date().toISOString(),
      windowEnd: new Date().toISOString(),
      requestsUsed: 0,
      requestsLimit: null,
      tokensUsed: 0,
      tokensLimit: null,
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
      id: `ollama-error-${Date.now()}`,
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
export function createOllamaAdapter(config?: Partial<ProviderConfig>): OllamaAdapter {
  return new OllamaAdapter(config);
}
