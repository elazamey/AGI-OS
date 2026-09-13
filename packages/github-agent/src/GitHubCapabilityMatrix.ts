export type CapabilityLevel = 'ALLOW' | 'ASK' | 'DENY';

export interface Capability {
  name: string;
  description: string;
  level: CapabilityLevel;
  endpoint: string;
  method: string;
}

export class GitHubCapabilityMatrix {
  private capabilities: Map<string, Capability> = new Map();

  constructor() {
    this.initDefaultCapabilities();
  }

  private initDefaultCapabilities(): void {
    const defaults: Capability[] = [
      {
        name: 'repo.read',
        description: 'Read repository files and metadata',
        level: 'ALLOW',
        endpoint: '/repos/{owner}/{repo}/contents/{path}',
        method: 'GET',
      },
      {
        name: 'repo.write',
        description: 'Write files to repository',
        level: 'ASK',
        endpoint: '/repos/{owner}/{repo}/contents/{path}',
        method: 'PUT',
      },
      {
        name: 'branch.create',
        description: 'Create new branches',
        level: 'ASK',
        endpoint: '/repos/{owner}/{repo}/git/refs',
        method: 'POST',
      },
      {
        name: 'commit.create',
        description: 'Create commits',
        level: 'ASK',
        endpoint: '/repos/{owner}/{repo}/git/commits',
        method: 'POST',
      },
      {
        name: 'pr.create',
        description: 'Create pull requests',
        level: 'ASK',
        endpoint: '/repos/{owner}/{repo}/pulls',
        method: 'POST',
      },
      {
        name: 'pr.review',
        description: 'Review pull requests',
        level: 'ALLOW',
        endpoint: '/repos/{owner}/{repo}/pulls/{pull_number}/reviews',
        method: 'POST',
      },
      {
        name: 'pr.merge',
        description: 'Merge pull requests',
        level: 'DENY',
        endpoint: '/repos/{owner}/{repo}/pulls/{pull_number}/merge',
        method: 'PUT',
      },
      {
        name: 'issue.create',
        description: 'Create issues',
        level: 'ALLOW',
        endpoint: '/repos/{owner}/{repo}/issues',
        method: 'POST',
      },
      {
        name: 'issue.update',
        description: 'Update issues',
        level: 'ALLOW',
        endpoint: '/repos/{owner}/{repo}/issues/{issue_number}',
        method: 'PATCH',
      },
      {
        name: 'issue.close',
        description: 'Close issues',
        level: 'ASK',
        endpoint: '/repos/{owner}/{repo}/issues/{issue_number}',
        method: 'PATCH',
      },
      {
        name: 'release.create',
        description: 'Create releases',
        level: 'DENY',
        endpoint: '/repos/{owner}/{repo}/releases',
        method: 'POST',
      },
      {
        name: 'workflow.run',
        description: 'Trigger workflow runs',
        level: 'DENY',
        endpoint: '/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
        method: 'POST',
      },
    ];

    for (const cap of defaults) {
      this.capabilities.set(cap.name, cap);
    }
  }

  checkCapability(name: string): Capability | null {
    return this.capabilities.get(name) || null;
  }

  isAllowed(name: string): boolean {
    const cap = this.capabilities.get(name);
    return cap?.level === 'ALLOW';
  }

  requiresApproval(name: string): boolean {
    const cap = this.capabilities.get(name);
    return cap?.level === 'ASK';
  }

  isDenied(name: string): boolean {
    const cap = this.capabilities.get(name);
    return cap?.level === 'DENY';
  }

  getCapabilities(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  getCapabilitiesByLevel(level: CapabilityLevel): Capability[] {
    return this.getCapabilities().filter(c => c.level === level);
  }

  setCapabilityLevel(name: string, level: CapabilityLevel): void {
    const cap = this.capabilities.get(name);
    if (cap) {
      cap.level = level;
    }
  }
}
