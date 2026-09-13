import type { ConnectorBase } from './connector-base.js';
import type { ConnectorContract, ConnectorResult } from './types.js';

export class ConnectorRouter {
  private connectors: Map<string, ConnectorBase> = new Map();

  register(connector: ConnectorBase): void {
    const contract = connector.getContract();
    this.connectors.set(contract.id, connector);
  }

  unregister(id: string): boolean {
    return this.connectors.delete(id);
  }

  getConnector(id: string): ConnectorBase | undefined {
    return this.connectors.get(id);
  }

  getByCapability(capability: string): ConnectorBase[] {
    return Array.from(this.connectors.values()).filter(c =>
      c.getContract().capabilities.includes(capability) && c.isConnected()
    );
  }

  getByCategory(category: string): ConnectorBase[] {
    return Array.from(this.connectors.values()).filter(c => c.getContract().category === category);
  }

  getConnected(): ConnectorBase[] {
    return Array.from(this.connectors.values()).filter(c => c.isConnected());
  }

  getDisconnected(): ConnectorBase[] {
    return Array.from(this.connectors.values()).filter(c => !c.isConnected());
  }

  async executeWithCapability<T>(capability: string, action: string, params: Record<string, unknown>): Promise<ConnectorResult<T>> {
    const candidates = this.getByCapability(capability);
    if (candidates.length === 0) return { success: false, error: `No connected connector with capability: ${capability}` };
    return candidates[0].execute<T>(action, params);
  }

  getStats(): { total: number; connected: number; disconnected: number; byCategory: Record<string, number> } {
    const all = Array.from(this.connectors.values());
    const byCategory: Record<string, number> = {};
    for (const c of all) {
      const cat = c.getContract().category;
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    return {
      total: all.length,
      connected: all.filter(c => c.isConnected()).length,
      disconnected: all.filter(c => !c.isConnected()).length,
      byCategory,
    };
  }

  async healthCheckAll(): Promise<Record<string, { status: string; latency: number }>> {
    const results: Record<string, { status: string; latency: number }> = {};
    for (const [id, connector] of this.connectors) {
      if (connector.isConnected()) {
        const health = await connector.healthCheck();
        results[id] = { status: health.status, latency: health.latency };
      }
    }
    return results;
  }
}
