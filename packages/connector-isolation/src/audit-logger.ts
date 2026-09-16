import { generateId } from '@agi-os/kernel';
import type { ConnectorAuditEntry } from './types.js';

export class ConnectorAuditLogger {
  private entries: ConnectorAuditEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 10000) {
    this.maxEntries = maxEntries;
  }

  log(entry: Omit<ConnectorAuditEntry, 'requestId'>): ConnectorAuditEntry {
    const full: ConnectorAuditEntry = { ...entry, requestId: generateId() };
    this.entries.push(full);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    return full;
  }

  getByConnector(connectorId: string): ConnectorAuditEntry[] {
    return this.entries.filter(e => e.connectorId === connectorId);
  }

  getByStatus(status: ConnectorAuditEntry['status']): ConnectorAuditEntry[] {
    return this.entries.filter(e => e.status === status);
  }

  getRecent(count: number): ConnectorAuditEntry[] {
    return this.entries.slice(-count);
  }

  getStats(): { total: number; byStatus: Record<string, number>; byConnector: Record<string, number> } {
    const byStatus: Record<string, number> = {};
    const byConnector: Record<string, number> = {};
    for (const e of this.entries) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      byConnector[e.connectorId] = (byConnector[e.connectorId] || 0) + 1;
    }
    return { total: this.entries.length, byStatus, byConnector };
  }

  reset(): void { this.entries = []; }
}