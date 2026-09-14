// ═══════════════════════════════════════════════════════
// Integration Status Store — Track connected provider status
// ═══════════════════════════════════════════════════════

export interface IntegrationStatus {
  status: string;
  connectedAt?: number;
  capabilities?: string[];
}

const STATUS_STORE = new Map<string, IntegrationStatus>();

export function setIntegrationStatus(providerId: string, status: string, capabilities?: string[]): void {
  STATUS_STORE.set(providerId, {
    status,
    connectedAt: status === 'connected' ? Date.now() : undefined,
    capabilities,
  });
}

export function getIntegrationStatus(providerId: string): IntegrationStatus | undefined {
  return STATUS_STORE.get(providerId);
}

export function getAllIntegrationStatuses(): Array<{ id: string } & IntegrationStatus> {
  return Array.from(STATUS_STORE.entries()).map(([id, data]) => ({ id, ...data }));
}
