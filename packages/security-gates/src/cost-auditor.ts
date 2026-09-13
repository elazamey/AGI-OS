import { generateId, now } from '@agi-os/kernel';
import type { GateResult } from './types.js';

export interface CostAuditEntry {
  providerId: string;
  requestedCost: number;
  allowed: boolean;
  reason: string;
  timestamp: string;
}

const BLOCKED_PROVIDERS = ['openai', 'anthropic', 'cohere', 'ai21', 'mistral'];

export class CostAuditor {
  private log: CostAuditEntry[] = [];

  auditRequest(providerId: string, estimatedCost: number): CostAuditEntry {
    const isPaid = BLOCKED_PROVIDERS.some(p => providerId.toLowerCase().includes(p));
    const entry: CostAuditEntry = {
      providerId,
      requestedCost: estimatedCost,
      allowed: !isPaid && estimatedCost === 0,
      reason: isPaid ? `Paid provider ${providerId} blocked` : estimatedCost > 0 ? `Non-zero cost blocked` : 'Allowed',
      timestamp: now().toISOString(),
    };
    this.log.push(entry);
    return entry;
  }

  runGate(): GateResult {
    const start = Date.now();
    const paidBlocked = this.log.filter(e => BLOCKED_PROVIDERS.some(p => e.providerId.toLowerCase().includes(p)) && !e.allowed);
    const zeroAllowed = this.log.filter(e => e.providerId.toLowerCase().includes('local') && e.allowed);
    const nonZeroBlocked = this.log.filter(e => e.requestedCost > 0 && !e.allowed);

    return {
      gate: 'G3-CostEnforcement',
      status: paidBlocked.length > 0 && zeroAllowed.length > 0 ? 'PASS' : 'FAIL',
      tests: this.log.length + BLOCKED_PROVIDERS.length,
      passed: paidBlocked.length + zeroAllowed.length + nonZeroBlocked.length,
      failed: this.log.filter(e => e.allowed && e.requestedCost > 0).length,
      details: [
        `Paid providers blocked: ${paidBlocked.length}/${this.log.filter(e => BLOCKED_PROVIDERS.some(p => e.providerId.toLowerCase().includes(p))).length}`,
        `Local providers allowed: ${zeroAllowed.length}`,
        `Non-zero cost requests blocked: ${nonZeroBlocked.length}`,
      ],
      duration: Date.now() - start,
      timestamp: now().toISOString(),
    };
  }

  getLog(): CostAuditEntry[] { return [...this.log]; }
  clear(): void { this.log = []; }
}
