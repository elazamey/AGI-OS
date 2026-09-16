import type { ActionEfficiencyResult } from './types.js';

export class ActionEfficiencyScorer {
  evaluate(
    taskSuccess: boolean,
    totalActions: number,
    necessaryActions: number,
  ): ActionEfficiencyResult {
    const redundantActions = Math.max(0, totalActions - necessaryActions);
    const efficiencyScore = totalActions > 0 ? necessaryActions / totalActions : 0;
    const unnecessaryActionRate = totalActions > 0 ? redundantActions / totalActions : 0;

    return {
      taskSuccess,
      totalActions,
      necessaryActions,
      redundantActions,
      efficiencyScore,
      unnecessaryActionRate,
    };
  }

  detectRedundantToolCalls(toolCalls: string[]): { redundant: string[]; rate: number } {
    const seen = new Set<string>();
    const redundant: string[] = [];

    for (const call of toolCalls) {
      if (seen.has(call)) {
        redundant.push(call);
      }
      seen.add(call);
    }

    return {
      redundant,
      rate: toolCalls.length > 0 ? redundant.length / toolCalls.length : 0,
    };
  }

  detectLoop(toolCalls: string[], windowSize: number = 3): { inLoop: boolean; loopPattern: string[]; loopCount: number } {
    if (toolCalls.length < windowSize * 2) {
      return { inLoop: false, loopPattern: [], loopCount: 0 };
    }

    for (let w = 1; w <= Math.floor(toolCalls.length / 2); w++) {
      const candidate = toolCalls.slice(0, w);
      let loopCount = 0;

      for (let i = w; i + w <= toolCalls.length; i += w) {
        const segment = toolCalls.slice(i, i + w);
        if (JSON.stringify(segment) === JSON.stringify(candidate)) {
          loopCount++;
        } else {
          break;
        }
      }

      if (loopCount >= 2) {
        return { inLoop: true, loopPattern: candidate, loopCount: loopCount + 1 };
      }
    }

    return { inLoop: false, loopPattern: [], loopCount: 0 };
  }

  getGrade(efficiencyScore: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (efficiencyScore >= 0.9) return 'A';
    if (efficiencyScore >= 0.7) return 'B';
    if (efficiencyScore >= 0.5) return 'C';
    if (efficiencyScore >= 0.3) return 'D';
    return 'F';
  }
}
