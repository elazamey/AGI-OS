export interface CostGuardConfig {
  maxSpend: number;
  alertThreshold?: number;
  hardLimit?: boolean;
}

export interface CostRecord {
  requestId: string;
  provider: string;
  model: string;
  cost: number;
  timestamp: number;
}

export class CostGuard {
  private config: CostGuardConfig;
  private records: CostRecord[] = [];
  private totalCost: number = 0;

  constructor(config: CostGuardConfig) {
    this.config = {
      alertThreshold: 0.8,
      hardLimit: true,
      ...config,
    };
  }

  checkBudget(provider: string, estimatedCost: number = 0): boolean {
    if (this.config.hardLimit && this.totalCost + estimatedCost > this.config.maxSpend) {
      return false;
    }
    return true;
  }

  recordUsage(record: CostRecord): void {
    this.records.push(record);
    this.totalCost += record.cost;
  }

  getTotalCost(): number {
    return this.totalCost;
  }

  getRemainingBudget(): number {
    return this.config.maxSpend - this.totalCost;
  }

  isOverBudget(): boolean {
    return this.totalCost > this.config.maxSpend;
  }

  isNearThreshold(): boolean {
    return this.totalCost >= this.config.maxSpend * (this.config.alertThreshold || 0.8);
  }

  getRecords(): CostRecord[] {
    return [...this.records];
  }

  getRecordsByProvider(provider: string): CostRecord[] {
    return this.records.filter(r => r.provider === provider);
  }

  reset(): void {
    this.records = [];
    this.totalCost = 0;
  }
}
