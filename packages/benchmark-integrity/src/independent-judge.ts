export interface RubricCriteria {
  criteria: string;
  weight: number;
}

export interface JudgeResult {
  score: number;
  criteriaScores: Record<string, number>;
  passed: boolean;
}

export class IndependentJudge {
  private passThreshold = 0.7;

  setPassThreshold(threshold: number): void {
    this.passThreshold = threshold;
  }

  evaluate(output: string, rubric: RubricCriteria[]): JudgeResult {
    const criteriaScores: Record<string, number> = {};
    let totalWeight = 0;
    let weightedSum = 0;

    for (const criterion of rubric) {
      const score = this.scoreCriteria(output, criterion.criteria);
      criteriaScores[criterion.criteria] = score;
      weightedSum += score * criterion.weight;
      totalWeight += criterion.weight;
    }

    const score = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const passed = score >= this.passThreshold;

    return { score, criteriaScores, passed };
  }

  private scoreCriteria(output: string, criteria: string): number {
    const outputLower = output.toLowerCase();
    const criteriaLower = criteria.toLowerCase();

    if (outputLower.includes(criteriaLower)) {
      return 1.0;
    }

    const words = criteriaLower.split(' ');
    const matchedWords = words.filter((w) => outputLower.includes(w));
    return matchedWords.length / words.length;
  }
}
