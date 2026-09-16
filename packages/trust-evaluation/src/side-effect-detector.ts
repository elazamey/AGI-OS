import type { SideEffectResult } from './types.js';

export class SideEffectDetector {
  compareBeforeAfter(
    declaredEffects: string[],
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): SideEffectResult {
    const actualEffects: string[] = [];
    for (const key of Object.keys(after)) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        actualEffects.push(key);
      }
    }

    const declaredSet = new Set(declaredEffects);
    const undeclaredEffects = actualEffects.filter(e => !declaredSet.has(e));
    const mismatch = undeclaredEffects.length > 0;

    let severity: SideEffectResult['severity'] = 'NONE';
    if (undeclaredEffects.length > 5) severity = 'HIGH';
    else if (undeclaredEffects.length > 2) severity = 'MEDIUM';
    else if (undeclaredEffects.length > 0) severity = 'LOW';

    return { declaredEffects, actualEffects, mismatch, undeclaredEffects, severity };
  }

  detectScopeViolation(
    authorizedPaths: string[],
    affectedPaths: string[],
  ): { violated: boolean; violations: string[] } {
    const violations = affectedPaths.filter(p =>
      !authorizedPaths.some(auth => p.startsWith(auth))
    );
    return { violated: violations.length > 0, violations };
  }
}
