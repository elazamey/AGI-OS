// ============================================================================
// AGI OS - Authorization System
// Temporary, scoped authorizations with TTL
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  Authorization,
  CapabilityScope,
  ToolEventType,
  ToolEvent
} from './types.js';
import { matchesScope } from './types.js';

// ---------------------------------------------------------------------------
// Authorization Manager
// ---------------------------------------------------------------------------
export class AuthorizationManager {
  private authorizations: Map<string, Authorization> = new Map();
  private events: ToolEvent[] = [];

  /**
   * Grant authorization
   */
  grant(params: {
    capabilityId: string;
    toolId: string;
    scope: CapabilityScope;
    missionId: string;
    grantedBy: string;
    ttl: number;
  }): Authorization {
    const id = generateId();
    const grantedAt = now();
    const expiresAt = new Date(grantedAt.getTime() + params.ttl);

    const auth: Authorization = {
      id,
      capabilityId: params.capabilityId,
      toolId: params.toolId,
      scope: { ...params.scope },
      missionId: params.missionId,
      grantedBy: params.grantedBy,
      grantedAt,
      expiresAt,
      ttl: params.ttl,
      revoked: false
    };

    this.authorizations.set(id, auth);
    this.recordEvent('authorization.granted', {
      authorizationId: id,
      toolId: params.toolId,
      missionId: params.missionId,
      ttl: params.ttl
    });

    return auth;
  }

  /**
   * Revoke authorization
   */
  revoke(authorizationId: string, reason?: string): boolean {
    const auth = this.authorizations.get(authorizationId);
    if (!auth) return false;

    auth.revoked = true;
    auth.revokedAt = now();
    auth.reason = reason;

    this.recordEvent('authorization.revoked', {
      authorizationId,
      toolId: auth.toolId,
      missionId: auth.missionId,
      reason
    });

    return true;
  }

  /**
   * Check if authorization is valid
   */
  isValid(authorizationId: string): boolean {
    const auth = this.authorizations.get(authorizationId);
    if (!auth) return false;
    if (auth.revoked) return false;
    if (new Date() > auth.expiresAt) return false;
    return true;
  }

  /**
   * Get an authorization
   */
  getAuthorization(authorizationId: string): Authorization | undefined {
    const auth = this.authorizations.get(authorizationId);
    return auth ? { ...auth, scope: { ...auth.scope } } : undefined;
  }

  /**
   * Get all authorizations for a mission
   */
  getAuthorizationsForMission(missionId: string): Authorization[] {
    return this.getAllAuthorizations().filter(
      (a) => a.missionId === missionId && !a.revoked
    );
  }

  /**
   * Get all authorizations for a tool
   */
  getAuthorizationsForTool(toolId: string): Authorization[] {
    return this.getAllAuthorizations().filter(
      (a) => a.toolId === toolId && !a.revoked
    );
  }

  /**
   * Get valid authorizations
   */
  getValidAuthorizations(): Authorization[] {
    return this.getAllAuthorizations().filter((a) => this.isValid(a.id));
  }

  /**
   * Get all authorizations
   */
  getAllAuthorizations(): Authorization[] {
    return Array.from(this.authorizations.values()).map((a) => ({
      ...a,
      scope: { ...a.scope }
    }));
  }

  /**
   * Check if authorization covers a scope
   */
  coversScope(authorizationId: string, target: string): boolean {
    const auth = this.authorizations.get(authorizationId);
    if (!auth || !this.isValid(authorizationId)) return false;

    return matchesScope(auth.scope, target);
  }

  /**
   * Revoke all authorizations for a mission
   */
  revokeAllForMission(missionId: string, reason?: string): number {
    let count = 0;
    for (const auth of this.authorizations.values()) {
      if (auth.missionId === missionId && !auth.revoked) {
        auth.revoked = true;
        auth.revokedAt = now();
        auth.reason = reason;
        count++;
      }
    }
    return count;
  }

  /**
   * Clean up expired authorizations
   */
  cleanup(): number {
    let count = 0;
    const nowTime = new Date();

    for (const auth of this.authorizations.values()) {
      if (!auth.revoked && nowTime > auth.expiresAt) {
        auth.revoked = true;
        auth.revokedAt = nowTime;
        auth.reason = 'expired';
        count++;

        this.recordEvent('authorization.expired', {
          authorizationId: auth.id,
          toolId: auth.toolId,
          missionId: auth.missionId
        });
      }
    }

    return count;
  }

  /**
   * Get stats
   */
  getStats(): {
    total: number;
    valid: number;
    revoked: number;
    expired: number;
  } {
    const all = this.getAllAuthorizations();
    const valid = all.filter((a) => this.isValid(a.id));
    const revoked = all.filter((a) => a.revoked);
    const nowTime = new Date();
    const expired = all.filter(
      (a) => !a.revoked && nowTime > a.expiresAt
    );

    return {
      total: all.length,
      valid: valid.length,
      revoked: revoked.length,
      expired: expired.length
    };
  }

  /**
   * Get events
   */
  getEvents(): ToolEvent[] {
    return [...this.events];
  }

  /**
   * Clear all authorizations
   */
  clear(): void {
    this.authorizations.clear();
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
// Authorization Manager Factory
// ---------------------------------------------------------------------------
export function createAuthorizationManager(): AuthorizationManager {
  return new AuthorizationManager();
}
