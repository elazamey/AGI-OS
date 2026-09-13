import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubConnector } from '../src/github-connector.js';

describe('GitHubConnector', () => {
  let github: GitHubConnector;
  beforeEach(async () => {
    github = new GitHubConnector();
    await github.connect({ accessToken: 'test' });
  });

  it('connects', () => {
    expect(github.isConnected()).toBe(true);
  });

  it('lists repos', async () => {
    const result = await github.execute('list_repos', {});
    expect(result.success).toBe(true);
  });

  it('gets file', async () => {
    const result = await github.execute('get_file', { path: 'README.md' });
    expect(result.success).toBe(true);
  });

  it('creates file', async () => {
    const result = await github.execute('create_file', { path: 'test.ts', content: 'hello' });
    expect(result.success).toBe(true);
  });

  it('health check', async () => {
    const health = await github.healthCheck();
    expect(health.status).toBe('healthy');
  });

  it('disconnects', async () => {
    await github.disconnect();
    expect(github.isConnected()).toBe(false);
  });
});
