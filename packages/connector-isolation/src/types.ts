export interface CapabilityScope {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  rateLimit: { requests: number; windowMs: number };
  timeout: number;
  retryPolicy: { maxRetries: number; backoffMs: number };
  secretIsolation: boolean;
  auditLog: boolean;
  idempotencyKey: boolean;
  approvalRequired: boolean;
  revocable: boolean;
}

export interface ConnectorAuditEntry {
  timestamp: string;
  connectorId: string;
  action: string;
  status: 'success' | 'failure' | 'rate_limited' | 'denied';
  durationMs: number;
  requestId: string;
  error?: string;
}

export interface SecretVault {
  id: string;
  connectorId: string;
  encryptedValue: string;
  algorithm: string;
  createdAt: string;
  expiresAt?: string;
}

export interface IsolationResult {
  allowed: boolean;
  reason: string;
  scope: CapabilityScope | null;
}

export interface ConnectorHealthCheck {
  connectorId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastCheck: string;
  details: string;
}