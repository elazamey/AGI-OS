import type { DelayedAttackResult } from './types.js';

export class DelayedAttackTester {
  private attacks: { id: string; type: string; injectAt: number }[] = [];

  registerAttack(id: string, type: string, injectAtStep: number): void {
    this.attacks.push({ id, type, injectAt: injectAtStep });
  }

  evaluate(stepNumber: number, actionTaken: string, detectionReport?: string): DelayedAttackResult[] {
    return this.attacks.map(attack => {
      const detectedAtStep = detectionReport && stepNumber >= attack.injectAt ? stepNumber : null;
      return {
        attackId: attack.id,
        attackType: attack.type,
        injectedAtStep: attack.injectAt,
        detectedAtStep,
        detected: detectedAtStep !== null,
        contained: detectedAtStep !== null && detectedAtStep <= attack.injectAt + 3,
      };
    });
  }

  getAttackCount(): number {
    return this.attacks.length;
  }

  clear(): void {
    this.attacks = [];
  }
}
