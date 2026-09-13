import { DelegationResult } from "./types.js";

export class DelegationEvaluator {
  evaluateDelegation(
    supervisorPermissions: string[],
    delegatedPermissions: string[]
  ): DelegationResult {
    const allowed = delegatedPermissions.filter((p) =>
      supervisorPermissions.includes(p)
    );
    const denied = delegatedPermissions.filter(
      (p) => !supervisorPermissions.includes(p)
    );

    return {
      allowed,
      denied,
      escalated: denied.length > 0,
    };
  }

  detectPrivilegeEscalation(
    delegations: { from: string; to: string; permissions: string[] }[]
  ): { escalated: boolean; violations: string[] } {
    const violations: string[] = [];
    const ownedPermissions: Record<string, Set<string>> = {};

    for (const d of delegations) {
      if (!ownedPermissions[d.from]) ownedPermissions[d.from] = new Set();
      if (!ownedPermissions[d.to]) ownedPermissions[d.to] = new Set();

      for (const perm of d.permissions) {
        if (!ownedPermissions[d.from].has(perm)) {
          violations.push(`${d.from} cannot delegate ${perm} to ${d.to}`);
        }
        ownedPermissions[d.to].add(perm);
      }
    }

    return { escalated: violations.length > 0, violations };
  }
}
