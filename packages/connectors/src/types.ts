export type ConnectorStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'rate_limited';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type Permission = 'read' | 'write' | 'delete' | 'send' | 'admin';

export interface ConnectorContract {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'google' | 'github' | 'communication' | 'storage' | 'deployment' | 'data' | 'search' | 'ai' | 'custom';
  capabilities: string[];
  permissions: Permission[];
  risk: RiskLevel;
  requiresAuth: boolean;
  authType?: 'oauth2' | 'api_key' | 'token' | 'basic';
  rateLimit?: { requests: number; windowMs: number };
  healthCheckUrl?: string;
}

export interface ConnectorState {
  status: ConnectorStatus;
  connected: boolean;
  lastHealthCheck?: string;
  lastError?: string;
  tokenExpiry?: string;
  scopes: string[];
}

export interface ConnectorHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastCheck: string;
  message?: string;
}

export interface AuthCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  tokenType?: string;
  expiresAt?: string;
  scopes?: string[];
}

export interface WebhookPayload {
  id: string;
  event: string;
  source: string;
  data: Record<string, unknown>;
  timestamp: string;
  signature?: string;
}

export interface ConnectorResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  rateLimited?: boolean;
  retryAfter?: number;
}
