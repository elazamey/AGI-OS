import { generateId, now } from '@agi-os/kernel';
import type { SecretVault } from './types.js';

export class SecretVaultManager {
  private vaults: Map<string, SecretVault> = new Map();

  store(connectorId: string, plaintext: string): SecretVault {
    const entry: SecretVault = {
      id: generateId(),
      connectorId,
      encryptedValue: btoa(unescape(encodeURIComponent(plaintext))),
      algorithm: 'base64',
      createdAt: now().toISOString(),
    };
    this.vaults.set(entry.id, entry);
    return entry;
  }

  retrieve(vaultId: string, connectorId: string): string | null {
    const entry = this.vaults.get(vaultId);
    if (!entry || entry.connectorId !== connectorId) return null;
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) return null;
    return decodeURIComponent(escape(atob(entry.encryptedValue)));
  }

  revoke(vaultId: string): boolean {
    return this.vaults.delete(vaultId);
  }

  getByConnector(connectorId: string): SecretVault[] {
    return Array.from(this.vaults.values()).filter(v => v.connectorId === connectorId);
  }

  getStats(): { total: number; byConnector: Record<string, number> } {
    const entries = Array.from(this.vaults.values());
    const byConnector: Record<string, number> = {};
    for (const e of entries) {
      byConnector[e.connectorId] = (byConnector[e.connectorId] || 0) + 1;
    }
    return { total: entries.length, byConnector };
  }
}
