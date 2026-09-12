// ============================================================================
// AGI OS - Capability Registry
// Scoped permissions for tools
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  Capability,
  ToolRisk,
  ToolEventType,
  ToolEvent
} from './types.js';
import { validateCapability, matchesScope } from './types.js';

// ---------------------------------------------------------------------------
// Capability Registry
// ---------------------------------------------------------------------------
export class CapabilityRegistry {
  private capabilities: Map<string, Capability> = new Map();
  private events: ToolEvent[] = [];

  /**
   * Grant a capability
   */
  grant(capability: Omit<Capability, 'id'>): Capability {
    const id = generateId();
    const cap: Capability = {
      ...capability,
      id
    };

    if (!validateCapability(cap)) {
      throw new Error('Invalid capability');
    }

    this.capabilities.set(id, cap);
    this.recordEvent('capability.granted', {
      capabilityId: id,
      toolId: cap.toolId,
      scope: cap.scope
    });

    return cap;
  }

  /**
   * Revoke a capability
   */
  revoke(capabilityId: string): boolean {
    const cap = this.capabilities.get(capabilityId);
    if (!cap) return false;

    this.capabilities.delete(capabilityId);
    this.recordEvent('capability.revoked', {
      capabilityId,
      toolId: cap.toolId
    });

    return true;
  }

  /**
   * Enable a capability
   */
  enable(capabilityId: string): boolean {
    const cap = this.capabilities.get(capabilityId);
    if (!cap) return false;
    cap.enabled = true;
    return true;
  }

  /**
   * Disable a capability
   */
  disable(capabilityId: string): boolean {
    const cap = this.capabilities.get(capabilityId);
    if (!cap) return false;
    cap.enabled = false;
    return true;
  }

  /**
   * Get a capability
   */
  getCapability(capabilityId: string): Capability | undefined {
    const cap = this.capabilities.get(capabilityId);
    return cap ? { ...cap, scope: { ...cap.scope } } : undefined;
  }

  /**
   * Get all capabilities
   */
  getAllCapabilities(): Capability[] {
    return Array.from(this.capabilities.values()).map((c) => ({
      ...c,
      scope: { ...c.scope }
    }));
  }

  /**
   * Get capabilities for a tool
   */
  getCapabilitiesForTool(toolId: string): Capability[] {
    return this.getAllCapabilities().filter((c) => c.toolId === toolId);
  }

  /**
   * Get enabled capabilities
   */
  getEnabledCapabilities(): Capability[] {
    return this.getAllCapabilities().filter((c) => c.enabled);
  }

  /**
   * Check if a tool has a capability
   */
  hasCapability(toolId: string): boolean {
    return this.getAllCapabilities().some((c) => c.toolId === toolId && c.enabled);
  }

  /**
   * Check if a tool has a capability for a specific scope
   */
  hasCapabilityForScope(toolId: string, target: string): boolean {
    return this.getAllCapabilities().some(
      (c) => c.toolId === toolId && c.enabled && matchesScope(c.scope, target)
    );
  }

  /**
   * Find matching capabilities for a tool and target
   */
  findMatchingCapabilities(toolId: string, target: string): Capability[] {
    return this.getAllCapabilities().filter(
      (c) => c.toolId === toolId && c.enabled && matchesScope(c.scope, target)
    );
  }

  /**
   * Check if operation requires approval
   */
  requiresApproval(toolId: string, target: string): boolean {
    const caps = this.findMatchingCapabilities(toolId, target);
    return caps.some((c) => c.requiresApproval);
  }

  /**
   * Get risk level for operation
   */
  getRiskLevel(toolId: string, target: string): ToolRisk {
    const caps = this.findMatchingCapabilities(toolId, target);
    if (caps.length === 0) return 'none';

    const riskOrder: ToolRisk[] = ['none', 'low', 'medium', 'high', 'critical'];
    let maxRisk: ToolRisk = 'none';

    for (const cap of caps) {
      if (riskOrder.indexOf(cap.risk) > riskOrder.indexOf(maxRisk)) {
        maxRisk = cap.risk;
      }
    }

    return maxRisk;
  }

  /**
   * Get events
   */
  getEvents(): ToolEvent[] {
    return [...this.events];
  }

  /**
   * Clear all capabilities
   */
  clear(): void {
    this.capabilities.clear();
    this.events = [];
  }

  /**
   * Record event
   */
  private recordEvent(type: ToolEventType, data: Record<string, unknown>): void {
    this.events.push({
      id: generateId(),
      type,
      timestamp: now(),
      data
    });
  }
}

// ---------------------------------------------------------------------------
// Capability Registry Factory
// ---------------------------------------------------------------------------
export function createCapabilityRegistry(): CapabilityRegistry {
  return new CapabilityRegistry();
}

// ---------------------------------------------------------------------------
// Built-in Capabilities (READ-ONLY)
// ---------------------------------------------------------------------------

export const FILESYSTEM_READ_CAPABILITY: Omit<Capability, 'id'> = {
  name: 'Read Filesystem',
  description: 'Read files and directories',
  toolId: 'filesystem.read',
  scope: {
    type: 'prefix',
    pattern: '/workspace',
    description: 'Workspace directory'
  },
  risk: 'low',
  requiresApproval: false,
  enabled: true,
  metadata: {}
};

export const FILESYSTEM_LIST_CAPABILITY: Omit<Capability, 'id'> = {
  name: 'List Filesystem',
  description: 'List directory contents',
  toolId: 'filesystem.list',
  scope: {
    type: 'prefix',
    pattern: '/workspace',
    description: 'Workspace directory'
  },
  risk: 'low',
  requiresApproval: false,
  enabled: true,
  metadata: {}
};

export const GIT_READ_CAPABILITY: Omit<Capability, 'id'> = {
  name: 'Read Git',
  description: 'Read git repository state',
  toolId: 'git.status',
  scope: {
    type: 'prefix',
    pattern: '/workspace',
    description: 'Workspace directory'
  },
  risk: 'none',
  requiresApproval: false,
  enabled: true,
  metadata: {}
};

export const MISSION_READ_CAPABILITY: Omit<Capability, 'id'> = {
  name: 'Read Mission',
  description: 'Inspect mission state',
  toolId: 'mission.inspect',
  scope: {
    type: 'all',
    pattern: '*',
    description: 'All missions'
  },
  risk: 'none',
  requiresApproval: false,
  enabled: true,
  metadata: {}
};

// ---------------------------------------------------------------------------
// Built-in Capabilities (WRITE - require approval)
// ---------------------------------------------------------------------------

export const FILESYSTEM_WRITE_CAPABILITY: Omit<Capability, 'id'> = {
  name: 'Write Filesystem',
  description: 'Write files to filesystem',
  toolId: 'filesystem.write',
  scope: {
    type: 'prefix',
    pattern: '/workspace',
    description: 'Workspace directory'
  },
  risk: 'high',
  requiresApproval: true,
  enabled: true,
  metadata: {}
};

export const GIT_WRITE_CAPABILITY: Omit<Capability, 'id'> = {
  name: 'Write Git',
  description: 'Create git commits',
  toolId: 'git.commit',
  scope: {
    type: 'prefix',
    pattern: '/workspace',
    description: 'Workspace directory'
  },
  risk: 'high',
  requiresApproval: true,
  enabled: true,
  metadata: {}
};

export const TERMINAL_EXECUTE_CAPABILITY: Omit<Capability, 'id'> = {
  name: 'Execute Terminal',
  description: 'Execute terminal commands',
  toolId: 'terminal.execute',
  scope: {
    type: 'prefix',
    pattern: '/workspace',
    description: 'Workspace directory'
  },
  risk: 'critical',
  requiresApproval: true,
  enabled: true,
  metadata: {}
};
