import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpClient } from '../src/HttpClient.js';

describe('HttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient({ defaultTimeoutMs: 5000 });
  });

  it('should create with default options', () => {
    const defaultClient = new HttpClient();
    expect(defaultClient).toBeDefined();
  });

  it('should have correct default configuration', () => {
    const customClient = new HttpClient({
      defaultTimeoutMs: 3000,
      defaultRetries: 3,
      defaultRetryDelayMs: 500,
    });
    expect(customClient).toBeDefined();
  });
});

describe('HttpClient request', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient({ defaultTimeoutMs: 5000, defaultRetries: 2, defaultRetryDelayMs: 100 });
  });

  it('should handle timeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 100);
      })
    ));

    await expect(client.get('http://example.com')).rejects.toThrow();
  });

  it('should handle network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await expect(client.get('http://example.com')).rejects.toThrow('Network error');
  });

  it('should retry on failure', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount < 3) {
        return Promise.reject(new Error('Temporary error'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ success: true }),
      });
    }));

    const response = await client.get('http://example.com');
    expect(response.data).toEqual({ success: true });
    expect(callCount).toBe(3);
  });

  it('should fail after max retries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Persistent error')));

    await expect(client.get('http://example.com')).rejects.toThrow('Persistent error');
  });

  it('should handle successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ data: 'test' }),
    }));

    const response = await client.get('http://example.com');
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ data: 'test' });
    expect(response.requestId).toBeDefined();
    expect(response.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle POST request with body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ id: 1 }),
    }));

    const response = await client.post('http://example.com', { name: 'test' });
    expect(response.status).toBe(201);
    expect(response.data).toEqual({ id: 1 });
  });

  it('should handle non-JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: () => Promise.resolve('Hello World'),
    }));

    const response = await client.get('http://example.com');
    expect(response.data).toBe('Hello World');
  });
});

describe('HttpClient HTTP methods', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient();
  });

  it('should support PUT method', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ updated: true }),
    }));

    const response = await client.put('http://example.com', { id: 1 });
    expect(response.data).toEqual({ updated: true });
  });

  it('should support DELETE method', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      json: () => Promise.resolve(null),
      text: () => Promise.resolve(''),
    }));

    const response = await client.delete('http://example.com/1');
    expect(response.status).toBe(204);
  });

  it('should support PATCH method', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ patched: true }),
    }));

    const response = await client.patch('http://example.com', { field: 'value' });
    expect(response.data).toEqual({ patched: true });
  });
});

describe('HttpClient error handling', () => {
  let client: HttpClient;

  beforeEach(() => {
    client = new HttpClient();
  });

  it('should throw error for non-OK status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ error: 'Not found' }),
    }));

    await expect(client.get('http://example.com')).rejects.toThrow('HTTP Error: 404 Not Found');
  });

  it('should throw error for 500 status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ error: 'Server error' }),
    }));

    await expect(client.get('http://example.com')).rejects.toThrow('HTTP Error: 500 Internal Server Error');
  });
});
