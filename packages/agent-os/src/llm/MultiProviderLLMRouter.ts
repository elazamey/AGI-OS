export interface LLMProvider {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  priority: number;
}

export interface LLMRequest {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  tokens_used: number;
  latency_ms: number;
}

export interface StreamChunk {
  type: 'token' | 'done' | 'error';
  content: string;
  provider?: string;
}

export class MultiProviderLLMRouter {
  private providers: LLMProvider[] = [];
  private failedProviders: Set<string> = new Set();
  private retryCount: Map<string, number> = new Map();

  constructor() {
    this.providers = [
      {
        name: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY_1,
        model: 'llama-3.3-70b-versatile',
        priority: 1,
      },
      {
        name: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        priority: 2,
      },
      {
        name: 'ollama',
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        model: 'llama3.2:3b',
        priority: 3,
      },
    ];
  }

  private getAvailableProviders(): LLMProvider[] {
    return this.providers
      .filter(p => !this.failedProviders.has(p.name))
      .sort((a, b) => a.priority - b.priority);
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const providers = this.getAvailableProviders();

    for (const provider of providers) {
      try {
        const response = await this.callProvider(provider, request);
        this.failedProviders.delete(provider.name);
        this.retryCount.delete(provider.name);
        return response;
      } catch (error) {
        console.error(`Provider ${provider.name} failed:`, error);
        this.handleProviderFailure(provider.name, error);
      }
    }

    throw new Error('All LLM providers failed');
  }

  async *stream(request: LLMRequest): AsyncGenerator<StreamChunk> {
    const providers = this.getAvailableProviders();

    for (const provider of providers) {
      try {
        yield* this.streamFromProvider(provider, request);
        this.failedProviders.delete(provider.name);
        return;
      } catch (error) {
        console.error(`Provider ${provider.name} stream failed:`, error);
        this.handleProviderFailure(provider.name, error);
      }
    }

    throw new Error('All LLM providers failed for streaming');
  }

  private async callProvider(provider: LLMProvider, request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    if (provider.name === 'ollama') {
      return this.callOllama(provider, request, startTime);
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1024,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 429) {
      throw new Error('Rate limit exceeded');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    return {
      content: data.choices[0].message.content,
      provider: provider.name,
      model: provider.model,
      tokens_used: data.usage?.total_tokens || 0,
      latency_ms: latencyMs,
    };
  }

  private async callOllama(provider: LLMProvider, request: LLMRequest, startTime: number): Promise<LLMResponse> {
    const response = await fetch(`${provider.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: provider.model,
        messages: request.messages,
        stream: false,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    const latencyMs = Date.now() - startTime;

    return {
      content: data.message.content,
      provider: provider.name,
      model: provider.model,
      tokens_used: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      latency_ms: latencyMs,
    };
  }

  private async *streamFromProvider(provider: LLMProvider, request: LLMRequest): AsyncGenerator<StreamChunk> {
    if (provider.name === 'ollama') {
      yield* this.streamOllama(provider, request);
      return;
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1024,
        stream: true,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done', content: '' };
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || '';
            if (content) {
              yield { type: 'token', content, provider: provider.name };
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  private async *streamOllama(provider: LLMProvider, request: LLMRequest): AsyncGenerator<StreamChunk> {
    const response = await fetch(`${provider.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: provider.model,
        messages: request.messages,
        stream: true,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              yield { type: 'token', content: parsed.message.content, provider: provider.name };
            }
            if (parsed.done) {
              yield { type: 'done', content: '' };
              return;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  private handleProviderFailure(providerName: string, error: unknown): void {
    const count = (this.retryCount.get(providerName) || 0) + 1;
    this.retryCount.set(providerName, count);

    if (count >= 3) {
      this.failedProviders.add(providerName);
    }
  }

  resetFailures(): void {
    this.failedProviders.clear();
    this.retryCount.clear();
  }

  getProviders(): LLMProvider[] {
    return [...this.providers];
  }
}
