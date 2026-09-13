import type { RiskPrediction } from './types.js';

export class RiskPredictor {
  private moduleRiskWeights: Record<string, number> = {
    'exec': 0.9, 'shell': 0.9, 'db': 0.8, 'git': 0.6, 'network': 0.5,
    'fs': 0.4, 'browser': 0.4, 'memory': 0.3,
  };

  predict(module: string, operation: string, target: string): RiskPrediction {
    const factors: string[] = [];
    let score = 0;

    const moduleWeight = this.moduleRiskWeights[module] ?? 0.3;
    score += moduleWeight * 40;
    factors.push(`module:${module}=${moduleWeight}`);

    if (operation === 'delete' || operation === 'drop') { score += 25; factors.push('destructive_operation'); }
    else if (operation === 'write' || operation === 'execute') { score += 15; factors.push('write_operation'); }
    else if (operation === 'read') { score += 5; factors.push('read_only'); }

    if (target.includes('production') || target.includes('main')) { score += 15; factors.push('production_target'); }
    if (target.includes('delete') || target.includes('rm')) { score += 10; factors.push('destructive_target'); }

    let predicted: RiskPrediction['predicted'];
    if (score >= 75) predicted = 'CRITICAL';
    else if (score >= 50) predicted = 'HIGH';
    else if (score >= 25) predicted = 'MEDIUM';
    else predicted = 'LOW';

    return { predicted, confidence: Math.min(score / 100, 1), factors };
  }

  getWorstRisk(predictions: RiskPrediction[]): RiskPrediction | null {
    if (predictions.length === 0) return null;
    const order = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    return predictions.reduce((worst, curr) =>
      (order[curr.predicted] > order[worst.predicted]) ? curr : worst
    );
  }

  cumulativeRisk(predictions: RiskPrediction[]): RiskPrediction {
    const allFactors = predictions.flatMap(p => p.factors);
    const maxScore = predictions.reduce((max, p) => Math.max(max, p.confidence), 0);
    const cumulativeScore = maxScore + (predictions.length * 0.05);
    const predicted: RiskPrediction['predicted'] =
      cumulativeScore >= 0.8 ? 'CRITICAL' :
      cumulativeScore >= 0.6 ? 'HIGH' :
      cumulativeScore >= 0.3 ? 'MEDIUM' : 'LOW';
    return { predicted, confidence: Math.min(cumulativeScore, 1), factors: allFactors };
  }
}
