import { describe, it, expect, beforeEach } from 'vitest';
import { ConnectorRouter } from '../src/connector-router.js';
import { GitHubConnector } from '../src/github-connector.js';
import { RESTConnector } from '../src/rest-connector.js';

describe('ConnectorRouter', () => {
  let router: ConnectorRouter;
  let github: GitHubConnector;

  beforeEach(async () => {
    router = new ConnectorRouter();
    github = new GitHubConnector();
    await github.connect({ accessToken: 'test' });
    router.register(github);
  });

  it('registers connector', () => {
    expect(router.getConnector('github')).toBeDefined();
  });

  it('gets by capability', () => {
    const connectors = router.getByCapability('repo.read');
    expect(connectors.length).toBe(1);
  });

  it('gets connected', () => {
    expect(router.getConnected().length).toBe(1);
  });

  it('gets stats', () => {
    const stats = router.getStats();
    expect(stats.total).toBe(1);
    expect(stats.connected).toBe(1);
  });

  it('executes with capability', async () => {
    const result = await router.executeWithCapability('repo.read', 'list_repos', {});
    expect(result.success).toBe(true);
  });

  it('unregisters', () => {
    expect(router.unregister('github')).toBe(true);
    expect(router.getConnector('github')).toBeUndefined();
  });
});
