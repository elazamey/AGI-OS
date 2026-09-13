import { ConnectorBase } from './connector-base.js';
import type { ConnectorContract, AuthCredentials, ConnectorHealth } from './types.js';

export class RESTConnector extends ConnectorBase {
  private baseUrl: string;
  private headers: Record<string, string> = {};

  constructor(params: { baseUrl: string; name?: string; headers?: Record<string, string> }) {
    const contract: ConnectorContract = {
      id: `rest-${params.name || 'generic'}`,
      name: params.name || 'REST API',
      version: '1.0.0',
      description: `Generic REST connector for ${params.baseUrl}`,
      category: 'custom',
      capabilities: ['http.get', 'http.post', 'http.put', 'http.patch', 'http.delete'],
      permissions: ['read', 'write'],
      risk: 'MEDIUM',
      requiresAuth: false,
    };
    super(contract);
    this.baseUrl = params.baseUrl;
    this.headers = params.headers || {};
  }

  protected async onConnect(_credentials: AuthCredentials): Promise<void> {
    this.headers['Content-Type'] = 'application/json';
  }

  protected async onDisconnect(): Promise<void> { this.headers = {}; }

  protected async onHealthCheck(): Promise<Partial<ConnectorHealth>> {
    return { status: 'healthy', message: `REST API ${this.baseUrl}` };
  }

  protected async onExecute<T>(action: string, params: Record<string, unknown>): Promise<T> {
    const method = action.replace('http.', '').toUpperCase();
    const url = params.url ? `${this.baseUrl}${params.url}` : this.baseUrl;
    return { method, url, status: 200, data: params.body } as T;
  }
}
