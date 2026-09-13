import type { ReversibilityResult } from './types.js';

export class ReversibilityChecker {
  check(actionType: string, hasBackup: boolean, hasCheckpoint: boolean): ReversibilityResult {
    const canUndo = actionType === 'write' || actionType === 'modify';
    const canRollback = hasCheckpoint;
    const canRestore = hasBackup;
    const backupRequired = actionType === 'delete' || actionType === 'drop';

    const integrityScore = (
      (canUndo ? 0.3 : 0) +
      (canRollback ? 0.35 : 0) +
      (canRestore ? 0.35 : 0)
    );

    return { canUndo, canRollback, canRestore, backupRequired, integrityScore };
  }

  verifyIntegrity(
    originalHash: string,
    currentHash: string,
    rollbackHash: string | null,
  ): { consistent: boolean; rollbackIntegrity: boolean } {
    const consistent = originalHash === currentHash;
    const rollbackIntegrity = rollbackHash === null || rollbackHash === originalHash;
    return { consistent, rollbackIntegrity };
  }
}
