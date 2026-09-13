import { generateId, hash } from '@agi-os/kernel';
import { HttpClient, HttpRequestOptions, HttpResponse } from '@agi-os/io-http';

export interface GitHubConfig {
  token?: string;
  baseUrl?: string;
  owner?: string;
  repo?: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  default_branch: string;
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  content: string;
  encoding: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    id: number;
  };
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  updated_at: string;
  user: {
    login: string;
    id: number;
  };
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
}

export class GitHubConnector {
  private client: HttpClient;
  private config: GitHubConfig;

  constructor(config: GitHubConfig = {}) {
    this.config = {
      baseUrl: 'https://api.github.com',
      ...config,
    };
    this.client = new HttpClient({
      defaultTimeoutMs: 30000,
      defaultRetries: 3,
      defaultRetryDelayMs: 1000,
    });
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    };
    if (this.config.token) {
      headers['Authorization'] = `token ${this.config.token}`;
    }
    return headers;
  }

  async getRepository(owner?: string, repo?: string): Promise<GitHubRepository> {
    const o = owner || this.config.owner;
    const r = repo || this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    const response = await this.client.get<GitHubRepository>(
      `${this.config.baseUrl}/repos/${o}/${r}`,
      this.getHeaders()
    );
    return response.data;
  }

  async getFile(path: string, ref?: string): Promise<GitHubFile> {
    const o = this.config.owner;
    const r = this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    const url = ref
      ? `${this.config.baseUrl}/repos/${o}/${r}/contents/${path}?ref=${ref}`
      : `${this.config.baseUrl}/repos/${o}/${r}/contents/${path}`;

    const response = await this.client.get<GitHubFile>(url, this.getHeaders());
    return response.data;
  }

  async listFiles(path: string = '', ref?: string): Promise<GitHubFile[]> {
    const o = this.config.owner;
    const r = this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    const url = ref
      ? `${this.config.baseUrl}/repos/${o}/${r}/contents/${path}?ref=${ref}`
      : `${this.config.baseUrl}/repos/${o}/${r}/contents/${path}`;

    const response = await this.client.get<GitHubFile[]>(url, this.getHeaders());
    return response.data;
  }

  async createFile(path: string, content: string, message: string, branch?: string): Promise<GitHubFile> {
    const o = this.config.owner;
    const r = this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content).toString('base64'),
    };
    if (branch) body.branch = branch;

    const response = await this.client.put<GitHubFile>(
      `${this.config.baseUrl}/repos/${o}/${r}/contents/${path}`,
      body,
      this.getHeaders()
    );
    return response.data;
  }

  async updateFile(path: string, content: string, message: string, sha: string, branch?: string): Promise<GitHubFile> {
    const o = this.config.owner;
    const r = this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    const body: Record<string, unknown> = {
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
    };
    if (branch) body.branch = branch;

    const response = await this.client.put<GitHubFile>(
      `${this.config.baseUrl}/repos/${o}/${r}/contents/${path}`,
      body,
      this.getHeaders()
    );
    return response.data;
  }

  async deleteFile(path: string, message: string, sha: string, branch?: string): Promise<void> {
    const o = this.config.owner;
    const r = this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    const body: Record<string, unknown> = {
      message,
      sha,
    };
    if (branch) body.branch = branch;

    await this.client.request(
      `${this.config.baseUrl}/repos/${o}/${r}/contents/${path}`,
      {
        method: 'DELETE',
        headers: this.getHeaders(),
        body,
      }
    );
  }

  async listIssues(state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
    const o = this.config.owner;
    const r = this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    const response = await this.client.get<GitHubIssue[]>(
      `${this.config.baseUrl}/repos/${o}/${r}/issues?state=${state}`,
      this.getHeaders()
    );
    return response.data;
  }

  async getIssue(number: number): Promise<GitHubIssue> {
    const o = this.config.owner;
    const r = this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    const response = await this.client.get<GitHubIssue>(
      `${this.config.baseUrl}/repos/${o}/${r}/issues/${number}`,
      this.getHeaders()
    );
    return response.data;
  }

  async createIssue(title: string, body?: string): Promise<GitHubIssue> {
    const o = this.config.owner;
    const r = this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    const response = await this.client.post<GitHubIssue>(
      `${this.config.baseUrl}/repos/${o}/${r}/issues`,
      { title, body },
      this.getHeaders()
    );
    return response.data;
  }

  async listPullRequests(state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPullRequest[]> {
    const o = this.config.owner;
    const r = this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    const response = await this.client.get<GitHubPullRequest[]>(
      `${this.config.baseUrl}/repos/${o}/${r}/pulls?state=${state}`,
      this.getHeaders()
    );
    return response.data;
  }

  async getPullRequest(number: number): Promise<GitHubPullRequest> {
    const o = this.config.owner;
    const r = this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    const response = await this.client.get<GitHubPullRequest>(
      `${this.config.baseUrl}/repos/${o}/${r}/pulls/${number}`,
      this.getHeaders()
    );
    return response.data;
  }

  async listCommits(sha?: string, perPage?: number): Promise<GitHubCommit[]> {
    const o = this.config.owner;
    const r = this.config.repo;
    if (!o || !r) throw new Error('Owner and repo are required');

    let url = `${this.config.baseUrl}/repos/${o}/${r}/commits`;
    const params: string[] = [];
    if (sha) params.push(`sha=${sha}`);
    if (perPage) params.push(`per_page=${perPage}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    const response = await this.client.get<GitHubCommit[]>(url, this.getHeaders());
    return response.data;
  }
}
