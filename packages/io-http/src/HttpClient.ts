import { generateId } from '@agi-os/kernel';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
  requestId: string;
  durationMs: number;
}

export interface HttpError {
  status: number;
  message: string;
  data: unknown;
  requestId: string;
}

export class HttpClient {
  private defaultTimeoutMs: number;
  private defaultRetries: number;
  private defaultRetryDelayMs: number;

  constructor(options: {
    defaultTimeoutMs?: number;
    defaultRetries?: number;
    defaultRetryDelayMs?: number;
  } = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 10000;
    this.defaultRetries = options.defaultRetries ?? 0;
    this.defaultRetryDelayMs = options.defaultRetryDelayMs ?? 1000;
  }

  async request<T>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeoutMs = this.defaultTimeoutMs,
      retries = this.defaultRetries,
      retryDelayMs = this.defaultRetryDelayMs,
    } = options;

    const requestId = generateId();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const startTime = Date.now();

      try {
        const fetchOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        };

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        let responseData: any;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        if (!response.ok) {
          const error: HttpError = {
            status: response.status,
            message: `HTTP Error: ${response.status} ${response.statusText}`,
            data: responseData,
            requestId,
          };
          throw error;
        }

        return {
          status: response.status,
          headers: responseHeaders,
          data: responseData as T,
          requestId,
          durationMs: Date.now() - startTime,
        };
      } catch (error: any) {
        clearTimeout(timeoutId);
        lastError = error;

        if (error.name === 'AbortError') {
          lastError = new Error(`HTTP Request timed out after ${timeoutMs}ms for URL: ${url}`);
        }

        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
      }
    }

    throw lastError;
  }

  async get<T>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>(url, { method: 'GET', headers });
  }

  async post<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>(url, { method: 'POST', body, headers });
  }

  async put<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>(url, { method: 'PUT', body, headers });
  }

  async delete<T>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>(url, { method: 'DELETE', headers });
  }

  async patch<T>(url: string, body: unknown, headers?: Record<string, string>): Promise<HttpResponse<T>> {
    return this.request<T>(url, { method: 'PATCH', body, headers });
  }
}
