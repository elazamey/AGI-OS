import type { DecisionOption, DecisionQualityResult } from './types.js';

export class DecisionQualityEvaluator {
  evaluate(
    selectedId: string,
    options: DecisionOption[],
    goalKeywords: string[],
    policyRules: string[],
  ): DecisionQualityResult {
    const selected = options.find(o => o.id === selectedId);
    if (!selected) {
      return {
        selectedOption: selectedId,
        alternatives: options.map(o => o.id),
        criteria: [],
        justifiedByGoal: false,
        justifiedByPolicy: false,
        justifiedByRisk: false,
        qualityScore: 0,
      };
    }

    const alternatives = options.filter(o => o.id !== selectedId).map(o => o.id);
    const goalMatch = goalKeywords.some(kw =>
      selected.label.toLowerCase().includes(kw.toLowerCase())
    );
    const policyMatch = policyRules.length === 0 || selected.safetyScore >= 0.5;
    const riskJustified = selected.riskScore <= 0.7;
    const safetyBest = selected.safetyScore >= Math.max(...options.map(o => o.safetyScore)) * 0.8;
    const costBest = selected.costScore <= Math.min(...options.map(o => o.costScore)) * 1.2;

    const qualityScore = (
      (goalMatch ? 0.3 : 0) +
      (policyMatch ? 0.2 : 0) +
      (riskJustified ? 0.2 : 0) +
      (safetyBest ? 0.15 : 0) +
      (costBest ? 0.15 : 0)
    );

    return {
      selectedOption: selectedId,
      alternatives,
      criteria: ['goal', 'policy', 'risk', 'safety', 'cost'],
      justifiedByGoal: goalMatch,
      justifiedByPolicy: policyMatch,
      justifiedByRisk: riskJustified,
      qualityScore,
    };
  }

  rankByParetoFront(options: DecisionOption[]): { paretoOptimal: string[]; dominated: string[] } {
    const paretoOptimal: string[] = [];
    const dominated: string[] = [];

    for (const a of options) {
      let isDominated = false;
      for (const b of options) {
        if (a.id === b.id) continue;
        const bBetterOrEqual =
          b.safetyScore >= a.safetyScore &&
          b.costScore <= a.costScore &&
          b.reversibilityScore >= a.reversibilityScore;
        const bStrictlyBetter =
          b.safetyScore > a.safetyScore ||
          b.costScore < a.costScore ||
          b.reversibilityScore > a.reversibilityScore;
        if (bBetterOrEqual && bStrictlyBetter) {
          isDominated = true;
          break;
        }
      }
      if (isDominated) dominated.push(a.id);
      else paretoOptimal.push(a.id);
    }

    return { paretoOptimal, dominated };
  }
}
