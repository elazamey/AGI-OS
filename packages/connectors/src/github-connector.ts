import { ConnectorBase } from './connector-base.js';
import type { ConnectorContract, AuthCredentials, ConnectorHealth } from './types.js';

const GITHUB_CONTRACT: ConnectorContract = {
  id: 'github',
  name: 'GitHub',
  version: '1.0.0',
  description: 'GitHub integration for repositories, issues, PRs, and actions',
  category: 'github',
  capabilities: ['repo.read', 'repo.write', 'issues.read', 'issues.write', 'pr.read', 'pr.write', 'branches', 'commits', 'actions'],
  permissions: ['read', 'write'],
  risk: 'MEDIUM',
  requiresAuth: true,
  authType: 'oauth2',
  rateLimit: { requests: 5000, windowMs: 3600000 },
};

export class GitHubConnector extends ConnectorBase {
  private repos: Map<string, { name: string; files: Map<string, string> }> = new Map();

  constructor() {
    super(GITHUB_CONTRACT);
  }

  protected async onConnect(_credentials: AuthCredentials): Promise<void> {
    this.repos.set('default', { name: 'default-repo', files: new Map([['README.md', '# Hello World'], ['src/index.ts', 'console.log("hello")']]) });
  }

  protected async onDisconnect(): Promise<void> { this.repos.clear(); }

  protected async onHealthCheck(): Promise<Partial<ConnectorHealth>> {
    return { status: 'healthy', message: 'GitHub API accessible' };
  }

  protected async onExecute<T>(action: string, params: Record<string, unknown>): Promise<T> {
    switch (action) {
      case 'list_repos': return [{ name: 'default-repo', private: false }] as T;
      case 'get_file': {
        const repo = this.repos.get((params.repo as string) || 'default');
        const content = repo?.files.get((params.path as string) || 'README.md') || '';
        return { content, path: params.path } as T;
      }
      case 'create_file': {
        const repo = this.repos.get('default');
        repo?.files.set((params.path as string) || 'new-file.ts', (params.content as string) || '');
        return { success: true } as T;
      }
      case 'list_issues': return [{ id: 1, title: 'Test issue', state: 'open' }] as T;
      case 'create_pr': return { number: 1, url: 'https://github.com/test/pr/1' } as T;
      default: throw new Error(`Unknown action: ${action}`);
    }
  }
}
