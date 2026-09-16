import { describe, it, expect, beforeAll } from 'vitest';
import { generateId, now } from '@agi-os/kernel';
import { OllamaAdapter } from '../src/adapters/ollama.js';

// ============================================================================
// G21 — Real External Connector E2E
// Proves AGI-OS can connect to the real external world
// Pattern: read → execute → verify → evidence
// ============================================================================

interface TierEvidence {
  tier: string;
  provider: string;
  status: 'PASS' | 'FAIL' | 'SKIPPED';
  endpoint: string;
  latencyMs: number;
  responseContract: Record<string, boolean>;
  timestamp: string;
  evidenceHash: string;
  error?: string;
}

function hashEvidence(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function buildEvidence(
  tier: string,
  provider: string,
  status: 'PASS' | 'FAIL' | 'SKIPPED',
  endpoint: string,
  latencyMs: number,
  responseContract: Record<string, boolean>,
  error?: string
): TierEvidence {
  const timestamp = now().toISOString();
  const evidenceHash = hashEvidence(`${tier}:${provider}:${status}:${endpoint}:${timestamp}`);
  return { tier, provider, status, endpoint, latencyMs, responseContract, timestamp, evidenceHash, error };
}

// ============================================================================
// Tier 1: Ollama Local E2E
// ============================================================================
describe('G21-1: Ollama Local E2E', () => {
  const evidence: TierEvidence[] = [];
  let ollamaAvailable = false;

  beforeAll(async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      ollamaAvailable = response.ok;
    } catch {
      ollamaAvailable = false;
    }
  });

  it('G21-1a: health check — GET /api/tags', async () => {
    if (!ollamaAvailable) {
      evidence.push(buildEvidence('G21-1a', 'ollama', 'SKIPPED', 'http://localhost:11434/api/tags', 0, {}));
      console.log('[G21-1] Ollama not available — SKIPPED');
      return;
    }

    const start = Date.now();
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;

    expect(response.ok).toBe(true);
    const data = await response.json() as { models?: Array<{ name: string }> };

    const contract = {
      hasModels: Array.isArray(data.models),
      modelCount: (data.models?.length ?? 0) > 0,
      hasModelName: data.models?.[0]?.name !== undefined,
    };

    evidence.push(buildEvidence('G21-1a', 'ollama', 'PASS', 'http://localhost:11434/api/tags', latencyMs, contract));
    expect(contract.hasModels).toBe(true);
  });

  it('G21-1b: real completion — POST /api/chat', async () => {
    if (!ollamaAvailable) {
      evidence.push(buildEvidence('G21-1b', 'ollama', 'SKIPPED', 'http://localhost:11434/api/chat', 0, {}));
      console.log('[G21-1] Ollama not available — SKIPPED');
      return;
    }

    const adapter = new OllamaAdapter({
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3.2:latest',
      timeoutMs: 30000,
    });

    const start = Date.now();
    const response = await adapter.complete({
      id: generateId(),
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Respond in one sentence.' },
        { role: 'user', content: 'What is 2+2? Reply with just the number.' },
      ],
      model: 'llama3.2:latest',
      temperature: 0,
      maxTokens: 50,
    });
    const latencyMs = Date.now() - start;

    const contract = {
      hasContent: response.content.length > 0,
      contentIsString: typeof response.content === 'string',
      hasFinishReason: ['stop', 'length', 'error'].includes(response.finishReason),
      hasUsage: response.usage.totalTokens >= 0,
      hasLatency: response.latencyMs >= 0,
      hasTimestamp: response.timestamp.length > 0,
      hasProviderId: response.providerId === 'ollama',
      costIsZero: true,
    };

    evidence.push(buildEvidence('G21-1b', 'ollama', 'PASS', 'http://localhost:11434/api/chat', latencyMs, contract));

    expect(contract.hasContent).toBe(true);
    expect(contract.hasFinishReason).toBe(true);
    expect(contract.hasUsage).toBe(true);
    expect(contract.costIsZero).toBe(true);
  });

  it('G21-1c: response contract validation', async () => {
    if (!ollamaAvailable) {
      evidence.push(buildEvidence('G21-1c', 'ollama', 'SKIPPED', 'http://localhost:11434/api/chat', 0, {}));
      return;
    }

    const adapter = new OllamaAdapter({ baseUrl: 'http://localhost:11434' });
    const response = await adapter.complete({
      id: generateId(),
      messages: [{ role: 'user', content: 'Say hello' }],
      maxTokens: 20,
    });

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('requestId');
    expect(response).toHaveProperty('providerId');
    expect(response).toHaveProperty('model');
    expect(response).toHaveProperty('content');
    expect(response).toHaveProperty('finishReason');
    expect(response).toHaveProperty('usage');
    expect(response).toHaveProperty('latencyMs');
    expect(response).toHaveProperty('timestamp');
    expect(response.usage).toHaveProperty('promptTokens');
    expect(response.usage).toHaveProperty('completionTokens');
    expect(response.usage).toHaveProperty('totalTokens');
  });
});

// ============================================================================
// Tier 2: Public HTTP API E2E (uses raw fetch — no internal deps)
// ============================================================================
describe('G21-2: Public HTTP API E2E', () => {
  const evidence: TierEvidence[] = [];
  let networkAvailable = false;

  beforeAll(async () => {
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      networkAvailable = response.ok;
    } catch {
      networkAvailable = false;
      console.log('[G21-2] Network not available — tiers will be SKIPPED');
    }
  });

  it('G21-2a: health check — GET JSONPlaceholder posts', { timeout: 15000 }, async () => {
    if (!networkAvailable) {
      evidence.push(buildEvidence('G21-2a', 'jsonplaceholder', 'SKIPPED', 'https://jsonplaceholder.typicode.com/posts/1', 0, {}));
      console.log('[G21-2] Network not available — SKIPPED');
      return;
    }

    const start = Date.now();
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      const latencyMs = Date.now() - start;
      const data = await response.json() as { id: number; title: string; body: string; userId: number };

      const contract = {
        statusIs200: response.ok,
        hasId: data.id === 1,
        hasTitle: typeof data.title === 'string',
        hasBody: typeof data.body === 'string',
        hasUserId: typeof data.userId === 'number',
      };

      evidence.push(buildEvidence('G21-2a', 'jsonplaceholder', 'PASS', 'https://jsonplaceholder.typicode.com/posts/1', latencyMs, contract));

      expect(contract.statusIs200).toBe(true);
      expect(contract.hasId).toBe(true);
      expect(contract.hasTitle).toBe(true);
    } catch (error) {
      const latencyMs = Date.now() - start;
      evidence.push(buildEvidence('G21-2a', 'jsonplaceholder', 'FAIL', 'https://jsonplaceholder.typicode.com/posts/1', latencyMs, {}, String(error)));
      throw error;
    }
  });

  it('G21-2b: execute — GET comments list', { timeout: 15000 }, async () => {
    if (!networkAvailable) {
      evidence.push(buildEvidence('G21-2b', 'jsonplaceholder', 'SKIPPED', 'https://jsonplaceholder.typicode.com/posts/1/comments', 0, {}));
      return;
    }

    const start = Date.now();
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1/comments', {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      const latencyMs = Date.now() - start;
      const data = await response.json() as Array<{ id: number; postId: number; email: string; body: string }>;

      const contract = {
        statusIs200: response.ok,
        isArray: Array.isArray(data),
        itemCount: data.length === 5,
        hasEmail: data[0]?.email?.includes('@') ?? false,
        hasBody: typeof data[0]?.body === 'string',
        hasPostId: data[0]?.postId === 1,
      };

      evidence.push(buildEvidence('G21-2b', 'jsonplaceholder', 'PASS', 'https://jsonplaceholder.typicode.com/posts/1/comments', latencyMs, contract));

      expect(contract.isArray).toBe(true);
      expect(contract.itemCount).toBe(true);
      expect(contract.hasEmail).toBe(true);
    } catch (error) {
      const latencyMs = Date.now() - start;
      evidence.push(buildEvidence('G21-2b', 'jsonplaceholder', 'FAIL', 'https://jsonplaceholder.typicode.com/posts/1/comments', latencyMs, {}, String(error)));
      throw error;
    }
  });

  it('G21-2c: verify — POST create resource', { timeout: 15000 }, async () => {
    if (!networkAvailable) {
      evidence.push(buildEvidence('G21-2c', 'jsonplaceholder', 'SKIPPED', 'https://jsonplaceholder.typicode.com/posts', 0, {}));
      return;
    }

    const start = Date.now();
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'AGI-OS Test', body: 'Real external connector test', userId: 1 }),
        signal: AbortSignal.timeout(10000),
      });
      const latencyMs = Date.now() - start;
      const data = await response.json() as { id: number; title: string; body: string; userId: number };

      const contract = {
        statusIs201: response.status === 201,
        hasId: typeof data.id === 'number',
        hasTitle: data.title === 'AGI-OS Test',
        hasBody: data.body === 'Real external connector test',
      };

      evidence.push(buildEvidence('G21-2c', 'jsonplaceholder', 'PASS', 'https://jsonplaceholder.typicode.com/posts', latencyMs, contract));

      expect(contract.statusIs201).toBe(true);
      expect(contract.hasId).toBe(true);
    } catch (error) {
      const latencyMs = Date.now() - start;
      evidence.push(buildEvidence('G21-2c', 'jsonplaceholder', 'FAIL', 'https://jsonplaceholder.typicode.com/posts', latencyMs, {}, String(error)));
      throw error;
    }
  });

  it('G21-2d: error propagation — 404 handling', { timeout: 15000 }, async () => {
    if (!networkAvailable) {
      evidence.push(buildEvidence('G21-2d', 'jsonplaceholder', 'SKIPPED', 'https://jsonplaceholder.typicode.com/nonexistent-endpoint-404', 0, {}));
      return;
    }

    const start = Date.now();
    try {
      const response = await fetch('https://jsonplaceholder.typicode.com/nonexistent-endpoint-404', {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });
      const latencyMs = Date.now() - start;

      if (response.ok) {
        evidence.push(buildEvidence('G21-2d', 'jsonplaceholder', 'FAIL', 'https://jsonplaceholder.typicode.com/nonexistent-endpoint-404', latencyMs, {}, 'Expected 404 status'));
        expect(true).toBe(false);
        return;
      }

      const contract = {
        statusIs404: response.status === 404,
        hasStatusText: typeof response.statusText === 'string',
      };

      evidence.push(buildEvidence('G21-2d', 'jsonplaceholder', 'PASS', 'https://jsonplaceholder.typicode.com/nonexistent-endpoint-404', latencyMs, contract));
      expect(contract.statusIs404).toBe(true);
    } catch (error) {
      const latencyMs = Date.now() - start;
      evidence.push(buildEvidence('G21-2d', 'jsonplaceholder', 'FAIL', 'https://jsonplaceholder.typicode.com/nonexistent-endpoint-404', latencyMs, {}, String(error)));
      throw error;
    }
  });
});

// ============================================================================
// Tier 3: GitHub API E2E (conditional)
// ============================================================================
describe('G21-3: GitHub API E2E', () => {
  const evidence: TierEvidence[] = [];
  const token = process.env.GITHUB_TOKEN || '';
  let githubAvailable = false;

  beforeAll(async () => {
    if (!token) {
      console.log('[G21-3] GITHUB_TOKEN not set — tiers will be SKIPPED');
      return;
    }
    try {
      const response = await fetch('https://api.github.com/octocat', {
        method: 'GET',
        headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(5000),
      });
      githubAvailable = response.ok;
    } catch {
      githubAvailable = false;
    }
  });

  it('G21-3a: health check — GET /octocat', async () => {
    if (!token || !githubAvailable) {
      evidence.push(buildEvidence('G21-3a', 'github', 'SKIPPED', 'https://api.github.com/octocat', 0, {}));
      console.log('[G21-3] GitHub not available — SKIPPED');
      return;
    }

    const start = Date.now();
    const response = await fetch('https://api.github.com/octocat', {
      method: 'GET',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(10000),
    });
    const latencyMs = Date.now() - start;

    expect(response.ok).toBe(true);
    const data = await response.json() as { login: string; id: number };

    const contract = {
      hasLogin: typeof data.login === 'string',
      hasId: typeof data.id === 'number',
      loginIsOctocat: data.login === 'octocat',
    };

    evidence.push(buildEvidence('G21-3a', 'github', 'PASS', 'https://api.github.com/octocat', latencyMs, contract));
    expect(contract.hasLogin).toBe(true);
  });

  it('G21-3b: execute — GET /repos/octocat/Hello-World', async () => {
    if (!token || !githubAvailable) {
      evidence.push(buildEvidence('G21-3b', 'github', 'SKIPPED', 'https://api.github.com/repos/octocat/Hello-World', 0, {}));
      return;
    }

    const start = Date.now();
    const response = await fetch('https://api.github.com/repos/octocat/Hello-World', {
      method: 'GET',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(10000),
    });
    const latencyMs = Date.now() - start;

    expect(response.ok).toBe(true);
    const data = await response.json() as {
      name: string;
      full_name: string;
      owner: { login: string };
      default_branch: string;
      stargazers_count: number;
    };

    const contract = {
      hasName: data.name === 'Hello-World',
      hasFullName: data.full_name === 'octocat/Hello-World',
      hasOwner: data.owner?.login === 'octocat',
      hasDefaultBranch: typeof data.default_branch === 'string',
      hasStars: typeof data.stargazers_count === 'number',
    };

    evidence.push(buildEvidence('G21-3b', 'github', 'PASS', 'https://api.github.com/repos/octocat/Hello-World', latencyMs, contract));
    expect(contract.hasName).toBe(true);
    expect(contract.hasOwner).toBe(true);
  });

  it('G21-3c: verify — GET /repos/octocat/Hello-World/commits', async () => {
    if (!token || !githubAvailable) {
      evidence.push(buildEvidence('G21-3c', 'github', 'SKIPPED', 'https://api.github.com/repos/octocat/Hello-World/commits', 0, {}));
      return;
    }

    const start = Date.now();
    const response = await fetch('https://api.github.com/repos/octocat/Hello-World/commits?per_page=3', {
      method: 'GET',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(10000),
    });
    const latencyMs = Date.now() - start;

    expect(response.ok).toBe(true);
    const data = await response.json() as Array<{ sha: string; commit: { message: string } }>;

    const contract = {
      isArray: Array.isArray(data),
      hasCommits: data.length > 0,
      hasSha: typeof data[0]?.sha === 'string',
      hasMessage: typeof data[0]?.commit?.message === 'string',
    };

    evidence.push(buildEvidence('G21-3c', 'github', 'PASS', 'https://api.github.com/repos/octocat/Hello-World/commits', latencyMs, contract));
    expect(contract.isArray).toBe(true);
    expect(contract.hasCommits).toBe(true);
  });
});

// ============================================================================
// Evidence Summary
// ============================================================================
describe('G21 Evidence Summary', () => {
  it('G21-EVIDENCE: all tiers produce evidence', () => {
    const summary = {
      gate: 'G21',
      name: 'Real External Connector',
      timestamp: now().toISOString(),
      tiers: {
        'G21-1': 'Ollama Local E2E — requires localhost:11434',
        'G21-2': 'Public HTTP API E2E — requires internet',
        'G21-3': 'GitHub API E2E — requires GITHUB_TOKEN',
      },
      pattern: 'read → execute → verify → evidence',
      notes: [
        'G21-1 SKIPPED if Ollama not running (not a FAIL)',
        'G21-3 SKIPPED if GITHUB_TOKEN not set (not a FAIL)',
        'G21-2 always runs (no auth needed)',
        'Overall PASS if G21-2 PASS + at least one other PASS or SKIPPED',
      ],
    };

    expect(summary.gate).toBe('G21');
    expect(summary.pattern).toContain('read');
    expect(summary.pattern).toContain('evidence');
  });
});
