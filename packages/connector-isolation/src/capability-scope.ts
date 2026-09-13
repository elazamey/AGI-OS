import type { CapabilityScope } from './types.js';

const DEFAULT_SCOPES: CapabilityScope[] = [
  {
    id: 'github-read',
    name: 'GitHub Read',
    description: 'Read access to GitHub repositories',
    permissions: ['repo.read', 'issues.read', 'pr.read'],
    rateLimit: { requests: 5000, windowMs: 3600000 },
    timeout: 10000,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
    secretIsolation: true,
    auditLog: true,
    idempotencyKey: false,
    approvalRequired: false,
    revocable: true,
  },
  {
    id: 'github-write',
    name: 'GitHub Write',
    description: 'Write access to GitHub repositories',
    permissions: ['repo.write', 'issues.write', 'pr.write', 'commits'],
    rateLimit: { requests: 1000, windowMs: 3600000 },
    timeout: 15000,
    retryPolicy: { maxRetries: 2, backoffMs: 2000 },
    secretIsolation: true,
    auditLog: true,
    idempotencyKey: true,
    approvalRequired: true,
    revocable: true,
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Google Drive file operations',
    permissions: ['drive.read', 'drive.write', 'drive.delete'],
    rateLimit: { requests: 100, windowMs: 100000 },
    timeout: 30000,
    retryPolicy: { maxRetries: 3, backoffMs: 5000 },
    secretIsolation: true,
    auditLog: true,
    idempotencyKey: true,
    approvalRequired: false,
    revocable: true,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Gmail read and send operations',
    permissions: ['gmail.read', 'gmail.draft', 'gmail.send'],
    rateLimit: { requests: 100, windowMs: 100000 },
    timeout: 15000,
    retryPolicy: { maxRetries: 3, backoffMs: 3000 },
    secretIsolation: true,
    auditLog: true,
    idempotencyKey: true,
    approvalRequired: true,
    revocable: true,
  },
  {
    id: 'rest-generic',
    name: 'REST API Generic',
    description: 'Generic REST API access',
    permissions: ['http.get', 'http.post', 'http.put', 'http.patch', 'http.delete'],
    rateLimit: { requests: 60, windowMs: 60000 },
    timeout: 30000,
    retryPolicy: { maxRetries: 3, backoffMs: 2000 },
    secretIsolation: true,
    auditLog: true,
    idempotencyKey: false,
    approvalRequired: false,
    revocable: true,
  },
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'Webhook subscription and delivery',
    permissions: ['webhook.subscribe', 'webhook.receive', 'webhook.verify'],
    rateLimit: { requests: 1000, windowMs: 60000 },
    timeout: 5000,
    retryPolicy: { maxRetries: 5, backoffMs: 1000 },
    secretIsolation: true,
    auditLog: true,
    idempotencyKey: true,
    approvalRequired: false,
    revocable: true,
  },
];

export class CapabilityScopeManager {
  private scopes: Map<string, CapabilityScope> = new Map();

  constructor() {
    for (const scope of DEFAULT_SCOPES) {
      this.scopes.set(scope.id, scope);
    }
  }

  getScope(id: string): CapabilityScope | undefined {
    return this.scopes.get(id);
  }

  getAllScopes(): CapabilityScope[] {
    return Array.from(this.scopes.values());
  }

  addScope(scope: CapabilityScope): void {
    this.scopes.set(scope.id, scope);
  }

  removeScope(id: string): boolean {
    return this.scopes.delete(id);
  }

  hasPermission(scopeId: string, permission: string): boolean {
    const scope = this.scopes.get(scopeId);
    return scope ? scope.permissions.includes(permission) : false;
  }

  getScopesForPermission(permission: string): CapabilityScope[] {
    return Array.from(this.scopes.values()).filter(s => s.permissions.includes(permission));
  }
}