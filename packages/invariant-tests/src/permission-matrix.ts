import type { PermissionMatrix } from "./types.js";

export class PermissionMatrixTester {
  private matrix: PermissionMatrix[] = [];

  createMatrix(entries: PermissionMatrix[]): void {
    this.matrix = [...entries];
  }

  checkPermission(
    actor: string,
    resource: string,
    action: string
  ): { allowed: boolean; exists: boolean } {
    const entry = this.matrix.find(
      (m) => m.actor === actor && m.resource === resource && m.action === action
    );

    if (!entry) {
      return { allowed: false, exists: false };
    }

    return { allowed: entry.allowed, exists: true };
  }

  testAllCombinations(
    actor: string,
    resources: string[],
    actions: string[]
  ): { allowed: string[]; denied: string[] } {
    const allowed: string[] = [];
    const denied: string[] = [];

    for (const resource of resources) {
      for (const action of actions) {
        const result = this.checkPermission(actor, resource, action);
        const combo = `${resource}:${action}`;
        if (result.exists && result.allowed) {
          allowed.push(combo);
        } else {
          denied.push(combo);
        }
      }
    }

    return { allowed, denied };
  }

  detectConflicts(): { conflicts: string[] } {
    const conflicts: string[] = [];
    const seen = new Map<string, boolean>();

    for (const entry of this.matrix) {
      const key = `${entry.actor}:${entry.resource}:${entry.action}`;
      if (seen.has(key)) {
        if (seen.get(key) !== entry.allowed) {
          conflicts.push(key);
        }
      }
      seen.set(key, entry.allowed);
    }

    return { conflicts };
  }
}
