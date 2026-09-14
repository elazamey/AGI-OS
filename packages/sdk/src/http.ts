// ═══════════════════════════════════════════════════════
// HTTP Client — Fetch-based with retry & timeout
// ═══════════════════════════════════════════════════════

import { APIError } from './types';

export interface HTTPClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retries: number;
}

interface RequestOptions {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export class HTTPClient {
  private config: HTTPClientConfig;

  constructor(config: HTTPClientConfig) {
    this.config = config;
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const url = `${this.config.baseUrl}${options.path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method: options.method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const apiError: APIError = {
            message: errorData.error?.message || `HTTP ${response.status}`,
            type: errorData.error?.type || 'api_error',
            param: errorData.error?.param,
            code: errorData.error?.code,
          };

          if (response.status === 429 || response.status >= 500) {
            if (attempt < this.config.retries) {
              const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
              await new Promise(r => setTimeout(r, delay));
              continue;
            }
          }

          throw new AGIOSError(apiError.message, response.status, apiError);
        }

        const data = await response.json();
        return (data.data !== undefined ? data.data : data) as T;
      } catch (err) {
        if (err instanceof AGIOSError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < this.config.retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
    }

    throw lastError || new Error('Request failed');
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>({ method: 'GET', path });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>({ method: 'POST', path, body });
  }
}

export class AGIOSError extends Error {
  public statusCode: number;
  public apiError: APIError;

  constructor(message: string, statusCode: number, apiError: APIError) {
    super(message);
    this.name = 'AGIOSError';
    this.statusCode = statusCode;
    this.apiError = apiError;
  }
}
