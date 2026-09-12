// ============================================================================
// AGI OS - Gemini Adapter
// Google Gemini free tier — limited RPM/TPM/RPD
// ============================================================================

import type { ProviderAdapter, ProviderConfig, ProviderRequest, ProviderResponse, QuotaUsage } from '../types.js';

// ---------------------------------------------------------------------------
// GeminiAdapter — maps unified interface to Gemini REST API
// ---------------------------------------------------------------------------
export class GeminiAdapter implements ProviderAdapter {
  readonly id: string;
  readonly config: ProviderConfig;

  private apiKey: string;
  private quotaUsed: number = 0;

  constructor(config?: Partial<ProviderConfig> & { apiKey?: string }) {
    this.id = config?.id ?? 'gemini';
    this.apiKey = config?.apiKey ?? process.env.GEMINI_API_KEY ?? '';
    this.config = {
      id: this.id,
      type: 'cloud-free',
      baseUrl: config?.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: this.apiKey,
      defaultModel: config?.defaultModel ?? 'gemini-2.0-flash',
      availableModels: config?.availableModels ?? ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      rateLimitRpm: config?.rateLimitRpm ?? 15,
      rateLimitTpm: config?.rateLimitTpm ?? 1000000,
      costPerInputToken: 0,
      costPerOutputToken: 0,
      maxRetries: config?.maxRetries ?? 2,
      timeoutMs: config?.timeoutMs ?? 30000,
      priority: config?.priority ?? 2,
      ...config,
    };
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await fetch(
        `${this.config.baseUrl}/models?key=${this.apiKey}`,
        { method: 'GET', signal: AbortSignal.timeout(5000) }
      );
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
      const url = `${this.config.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: request.messages.map((m) => ({
            role: m.role === 'assistant' ? 'model' : m.role,
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            maxOutputTokens: request.maxTokens ?? 2048,
            temperature: request.temperature ?? 0.7,
          },
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
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      };

      const candidate = data.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text ?? '';
      const usage = data.usageMetadata ?? {};

      this.quotaUsed += usage.totalTokenCount ?? 0;

      const finishReason = candidate?.finishReason === 'STOP' ? 'stop'
        : candidate?.finishReason === 'MAX_TOKENS' ? 'length'
        : 'stop';

      return {
        id: `gemini-${Date.now()}`,
        requestId: request.id,
        providerId: this.id,
        model,
        content,
        finishReason,
        usage: {
          promptTokens: usage.promptTokenCount ?? 0,
          completionTokens: usage.candidatesTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0,
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
      id: `gemini-error-${Date.now()}`,
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
export function createGeminiAdapter(config?: Partial<ProviderConfig> & { apiKey?: string }): GeminiAdapter {
  return new GeminiAdapter(config);
}
