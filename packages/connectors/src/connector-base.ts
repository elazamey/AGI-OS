import { generateId, now } from '@agi-os/kernel';
import type { ConnectorContract, ConnectorState, ConnectorHealth, AuthCredentials, ConnectorResult } from './types.js';

export abstract class ConnectorBase {
  protected contract: ConnectorContract;
  protected state: ConnectorState;
  protected credentials: AuthCredentials = {};

  constructor(contract: ConnectorContract) {
    this.contract = contract;
    this.state = {
      status: 'disconnected',
      connected: false,
      scopes: [],
    };
  }

  getContract(): ConnectorContract { return this.contract; }
  getState(): ConnectorState { return { ...this.state }; }
  isConnected(): boolean { return this.state.connected; }

  async connect(credentials: AuthCredentials): Promise<ConnectorResult<void>> {
    this.credentials = credentials;
    this.state.status = 'connecting';
    try {
      await this.onConnect(credentials);
      this.state.status = 'connected';
      this.state.connected = true;
      this.state.lastHealthCheck = now().toISOString();
      return { success: true };
    } catch (e) {
      this.state.status = 'error';
      this.state.lastError = e instanceof Error ? e.message : 'Connection failed';
      return { success: false, error: this.state.lastError };
    }
  }

  async disconnect(): Promise<void> {
    await this.onDisconnect();
    this.state.status = 'disconnected';
    this.state.connected = false;
    this.credentials = {};
  }

  async healthCheck(): Promise<ConnectorHealth> {
    const start = Date.now();
    try {
      const result = await this.onHealthCheck();
      this.state.lastHealthCheck = now().toISOString();
      return { status: 'healthy', latency: Date.now() - start, lastCheck: now().toISOString(), ...result };
    } catch (e) {
      return { status: 'unhealthy', latency: Date.now() - start, lastCheck: now().toISOString(), message: e instanceof Error ? e.message : 'Check failed' };
    }
  }

  async execute<T>(action: string, params: Record<string, unknown>): Promise<ConnectorResult<T>> {
    if (!this.state.connected) return { success: false, error: 'Not connected' };
    try {
      const result = await this.onExecute<T>(action, params);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Execution failed' };
    }
  }

  protected abstract onConnect(credentials: AuthCredentials): Promise<void>;
  protected abstract onDisconnect(): Promise<void>;
  protected abstract onHealthCheck(): Promise<Partial<ConnectorHealth>>;
  protected abstract onExecute<T>(action: string, params: Record<string, unknown>): Promise<T>;
}
