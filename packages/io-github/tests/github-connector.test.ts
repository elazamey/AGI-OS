import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubConnector } from '../src/GitHubConnector.js';

describe('GitHubConnector', () => {
  it('should create with default config', () => {
    const defaultConnector = new GitHubConnector();
    expect(defaultConnector).toBeDefined();
  });

  it('should create with token', () => {
    const tokenConnector = new GitHubConnector({
      token: 'test-token',
      owner: 'test-owner',
      repo: 'test-repo',
    });
    expect(tokenConnector).toBeDefined();
  });
});

describe('GitHubConnector getRepository', () => {
  let connector: GitHubConnector;

  beforeEach(() => {
    connector = new GitHubConnector({
      owner: 'test-owner',
      repo: 'test-repo',
    });
  });

  it('should require owner and repo', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.getRepository()).rejects.toThrow('Owner and repo are required');
  });

  it('should accept custom owner and repo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({
        id: 1,
        name: 'test-repo',
        full_name: 'test-owner/test-repo',
        private: false,
        html_url: 'https://github.com/test-owner/test-repo',
        description: 'Test repository',
        fork: false,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        pushed_at: '2024-01-01T00:00:00Z',
        stargazers_count: 100,
        watchers_count: 50,
        forks_count: 25,
        open_issues_count: 5,
        default_branch: 'main',
      }),
    }));

    const repo = await connector.getRepository('custom-owner', 'custom-repo');
    expect(repo.name).toBe('test-repo');
    expect(repo.stargazers_count).toBe(100);
  });
});

describe('GitHubConnector file operations', () => {
  let connector: GitHubConnector;

  beforeEach(() => {
    connector = new GitHubConnector({
      owner: 'test-owner',
      repo: 'test-repo',
    });
  });

  it('should require owner and repo for getFile', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.getFile('test.txt')).rejects.toThrow('Owner and repo are required');
  });

  it('should require owner and repo for listFiles', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.listFiles()).rejects.toThrow('Owner and repo are required');
  });

  it('should require owner and repo for createFile', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.createFile('test.txt', 'content', 'message')).rejects.toThrow('Owner and repo are required');
  });

  it('should require owner and repo for updateFile', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.updateFile('test.txt', 'content', 'message', 'sha')).rejects.toThrow('Owner and repo are required');
  });

  it('should require owner and repo for deleteFile', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.deleteFile('test.txt', 'message', 'sha')).rejects.toThrow('Owner and repo are required');
  });

  it('should accept ref parameter for getFile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({
        name: 'test.txt',
        path: 'test.txt',
        sha: 'abc123',
        size: 100,
        url: 'https://api.github.com/repos/test-owner/test-repo/contents/test.txt',
        content: Buffer.from('Hello World').toString('base64'),
        encoding: 'base64',
      }),
    }));

    const file = await connector.getFile('test.txt', 'main');
    expect(file.name).toBe('test.txt');
    expect(file.sha).toBe('abc123');
  });
});

describe('GitHubConnector issue operations', () => {
  let connector: GitHubConnector;

  beforeEach(() => {
    connector = new GitHubConnector({
      owner: 'test-owner',
      repo: 'test-repo',
    });
  });

  it('should require owner and repo for listIssues', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.listIssues()).rejects.toThrow('Owner and repo are required');
  });

  it('should require owner and repo for getIssue', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.getIssue(1)).rejects.toThrow('Owner and repo are required');
  });

  it('should require owner and repo for createIssue', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.createIssue('Test Issue')).rejects.toThrow('Owner and repo are required');
  });

  it('should list issues with state filter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve([
        {
          id: 1,
          number: 1,
          title: 'Test Issue',
          body: 'Test body',
          state: 'open',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          user: { login: 'testuser', id: 1 },
          labels: [],
        },
      ]),
    }));

    const issues = await connector.listIssues('open');
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toBe('Test Issue');
  });
});

describe('GitHubConnector pull request operations', () => {
  let connector: GitHubConnector;

  beforeEach(() => {
    connector = new GitHubConnector({
      owner: 'test-owner',
      repo: 'test-repo',
    });
  });

  it('should require owner and repo for listPullRequests', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.listPullRequests()).rejects.toThrow('Owner and repo are required');
  });

  it('should require owner and repo for getPullRequest', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.getPullRequest(1)).rejects.toThrow('Owner and repo are required');
  });

  it('should list pull requests with state filter', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve([
        {
          id: 1,
          number: 1,
          title: 'Test PR',
          body: 'Test body',
          state: 'open',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          user: { login: 'testuser', id: 1 },
          head: { ref: 'feature-branch', sha: 'abc123' },
          base: { ref: 'main', sha: 'def456' },
        },
      ]),
    }));

    const prs = await connector.listPullRequests('open');
    expect(prs).toHaveLength(1);
    expect(prs[0].title).toBe('Test PR');
  });
});

describe('GitHubConnector commit operations', () => {
  let connector: GitHubConnector;

  beforeEach(() => {
    connector = new GitHubConnector({
      owner: 'test-owner',
      repo: 'test-repo',
    });
  });

  it('should require owner and repo for listCommits', async () => {
    const noOwnerConnector = new GitHubConnector({});
    await expect(noOwnerConnector.listCommits()).rejects.toThrow('Owner and repo are required');
  });

  it('should list commits with sha and perPage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve([
        {
          sha: 'abc123',
          message: 'Initial commit',
          author: {
            name: 'Test Author',
            email: 'test@example.com',
            date: '2024-01-01T00:00:00Z',
          },
          committer: {
            name: 'Test Committer',
            email: 'test@example.com',
            date: '2024-01-01T00:00:00Z',
          },
        },
      ]),
    }));

    const commits = await connector.listCommits('main', 10);
    expect(commits).toHaveLength(1);
    expect(commits[0].sha).toBe('abc123');
  });
});
