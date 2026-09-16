import type { CalibrationSample, CalibrationResult } from './types.js';

export class CalibrationScorer {
  private samples: CalibrationSample[] = [];

  record(prediction: number, outcome: boolean): void {
    this.samples.push({ prediction, outcome });
  }

  getSamples(): CalibrationSample[] {
    return [...this.samples];
  }

  calculateBrierScore(): number {
    if (this.samples.length === 0) return 0;
    const sum = this.samples.reduce((acc, s) => {
      const outcomeNum = s.outcome ? 1 : 0;
      return acc + Math.pow(s.prediction - outcomeNum, 2);
    }, 0);
    return sum / this.samples.length;
  }

  calculateExpectedCalibrationError(numBins: number = 10): number {
    if (this.samples.length === 0) return 0;
    const binSize = 1 / numBins;
    let totalError = 0;

    for (let i = 0; i < numBins; i++) {
      const lower = i * binSize;
      const upper = (i + 1) * binSize;
      const binSamples = this.samples.filter(s => s.prediction >= lower && s.prediction < upper);
      if (binSamples.length === 0) continue;

      const avgPrediction = binSamples.reduce((a, s) => a + s.prediction, 0) / binSamples.length;
      const avgOutcome = binSamples.filter(s => s.outcome).length / binSamples.length;
      totalError += (binSamples.length / this.samples.length) * Math.abs(avgPrediction - avgOutcome);
    }

    return totalError;
  }

  calculateOverconfidenceRate(): number {
    if (this.samples.length === 0) return 0;
    const overconfident = this.samples.filter(s => s.prediction > 0.8 && !s.outcome).length;
    return overconfident / this.samples.length;
  }

  calculateUnderconfidenceRate(): number {
    if (this.samples.length === 0) return 0;
    const underconfident = this.samples.filter(s => s.prediction < 0.4 && s.outcome).length;
    return underconfident / this.samples.length;
  }

  isWellCalibrated(): boolean {
    const brier = this.calculateBrierScore();
    const ece = this.calculateExpectedCalibrationError();
    return brier < 0.25 && ece < 0.1;
  }

  getResult(): CalibrationResult {
    return {
      brierScore: this.calculateBrierScore(),
      expectedCalibrationError: this.calculateExpectedCalibrationError(),
      overconfidenceRate: this.calculateOverconfidenceRate(),
      underconfidenceRate: this.calculateUnderconfidenceRate(),
      wellCalibrated: this.isWellCalibrated(),
    };
  }

  clear(): void {
    this.samples = [];
  }
}
