import { generateId } from '@agi-os/kernel';

export type LLMProvider = 'ollama' | 'gemini' | 'groq' | 'openai-compatible';

export interface LLMRequestConfig {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  forcedProvider?: LLMProvider;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  provider: LLMProvider;
  model: string;
  cost: number;
  requestId: string;
  durationMs: number;
}

export interface LLMGatewayConfig {
  maxSpend?: number;
  defaultProvider?: LLMProvider;
  ollamaUrl?: string;
  ollamaModel?: string;
  geminiApiKey?: string;
  groqApiKey?: string;
}

export class LLMGateway {
  private maxSpend: number;
  private defaultProvider: LLMProvider;
  private ollamaUrl: string;
  private ollamaModel: string;
  private totalCost: number = 0;

  constructor(config: LLMGatewayConfig = {}) {
    this.maxSpend = config.maxSpend ?? 0;
    this.defaultProvider = config.defaultProvider ?? 'ollama';
    this.ollamaUrl = config.ollamaUrl ?? 'http://127.0.0.1:11434';
    this.ollamaModel = config.ollamaModel ?? 'llama3.2:3b';
  }

  async generate(config: LLMRequestConfig): Promise<LLMResponse> {
    const provider = config.forcedProvider || this.defaultProvider;
    const requestId = generateId();
    const startTime = Date.now();

    if (provider !== 'ollama' && this.maxSpend <= 0) {
      throw new Error(
        `Security Violation: Cost guard blocked provider '${provider}' because MAX_SPEND is set to 0. Only local Ollama is allowed.`
      );
    }

    let response: LLMResponse;

    switch (provider) {
      case 'ollama':
        response = await this.callOllama(config, requestId);
        break;
      case 'gemini':
        response = await this.callGemini(config, requestId);
        break;
      case 'groq':
        response = await this.callGroq(config, requestId);
        break;
      default:
        throw new Error(`Provider '${provider}' is not supported.`);
    }

    response.durationMs = Date.now() - startTime;
    this.totalCost += response.cost;

    return response;
  }

  private async callOllama(config: LLMRequestConfig, requestId: string): Promise<LLMResponse> {
    const fullPrompt = config.systemPrompt
      ? `${config.systemPrompt}\n\n${config.prompt}`
      : config.prompt;

    const response = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.ollamaModel,
        prompt: fullPrompt,
        stream: false,
        options: {
          num_predict: config.maxTokens,
          temperature: config.temperature,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { response: string };

    return {
      content: data.response,
      provider: 'ollama',
      model: this.ollamaModel,
      cost: 0,
      requestId,
      durationMs: 0,
    };
  }

  private async callGemini(config: LLMRequestConfig, requestId: string): Promise<LLMResponse> {
    throw new Error('Gemini provider requires API key configuration. Set GEMINI_API_KEY environment variable.');
  }

  private async callGroq(config: LLMRequestConfig, requestId: string): Promise<LLMResponse> {
    throw new Error('Groq provider requires API key configuration. Set GROQ_API_KEY environment variable.');
  }

  getTotalCost(): number {
    return this.totalCost;
  }

  getMaxSpend(): number {
    return this.maxSpend;
  }

  getRemainingBudget(): number {
    return this.maxSpend - this.totalCost;
  }

  getDefaultProvider(): LLMProvider {
    return this.defaultProvider;
  }
}
