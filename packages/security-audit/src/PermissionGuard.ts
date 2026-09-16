export type PermissionLevel = 'DENY' | 'READ' | 'WRITE' | 'EXECUTE' | 'ADMIN';

export interface Permission {
  resource: string;
  level: PermissionLevel;
  conditions?: string[];
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason: string;
  requiredLevel: PermissionLevel;
  actualLevel: PermissionLevel;
}

export class PermissionGuard {
  private permissions: Map<string, PermissionLevel> = new Map();
  private auditLog: Array<{ resource: string; level: PermissionLevel; allowed: boolean; timestamp: number }> = [];

  constructor(permissions: Permission[] = []) {
    for (const perm of permissions) {
      this.permissions.set(perm.resource, perm.level);
    }
  }

  addPermission(resource: string, level: PermissionLevel): void {
    this.permissions.set(resource, level);
  }

  removePermission(resource: string): void {
    this.permissions.delete(resource);
  }

  check(resource: string, requestedLevel: PermissionLevel): PermissionCheckResult {
    const levelHierarchy: PermissionLevel[] = ['DENY', 'READ', 'WRITE', 'EXECUTE', 'ADMIN'];
    const requiredIndex = levelHierarchy.indexOf(requestedLevel);
    const actualLevel = this.permissions.get(resource) || 'DENY';
    const actualIndex = levelHierarchy.indexOf(actualLevel);

    const allowed = actualIndex >= requiredIndex;

    this.auditLog.push({
      resource,
      level: requestedLevel,
      allowed,
      timestamp: Date.now(),
    });

    return {
      allowed,
      reason: allowed
        ? `Access granted: ${actualLevel} >= ${requestedLevel}`
        : `Access denied: ${actualLevel} < ${requestedLevel}`,
      requiredLevel: requestedLevel,
      actualLevel,
    };
  }

  canRead(resource: string): boolean {
    return this.check(resource, 'READ').allowed;
  }

  canWrite(resource: string): boolean {
    return this.check(resource, 'WRITE').allowed;
  }

  canExecute(resource: string): boolean {
    return this.check(resource, 'EXECUTE').allowed;
  }

  isAdmin(resource: string): boolean {
    return this.check(resource, 'ADMIN').allowed;
  }

  getAuditLog(): Array<{ resource: string; level: PermissionLevel; allowed: boolean; timestamp: number }> {
    return [...this.auditLog];
  }

  getPermission(resource: string): PermissionLevel | undefined {
    return this.permissions.get(resource);
  }

  getAllPermissions(): Map<string, PermissionLevel> {
    return new Map(this.permissions);
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }
}
