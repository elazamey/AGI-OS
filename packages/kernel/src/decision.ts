// ============================================================================
// AGI OS - Decision System
// Decision making with options, reasoning, and confidence
// ============================================================================

import { generateId, now, deepClone } from './utils.js';
import type { Decision, DecisionType, DecisionOption, Evidence } from './types.js';

/**
 * Create a decision
 */
export function createDecision(
  type: DecisionType,
  context: string,
  options: DecisionOption[],
  selected: string,
  reasoning: string,
  confidence: number,
  stateRevision: string,
  evidence?: Evidence
): Decision {
  return {
    id: generateId(),
    type,
    context,
    options: deepClone(options),
    selected,
    reasoning,
    confidence,
    evidence,
    timestamp: now(),
    stateRevision
  };
}

/**
 * Create a decision option
 */
export function createDecisionOption(
  label: string,
  description: string,
  risk: number,
  confidence: number,
  predictedOutcome: string
): DecisionOption {
  return {
    id: generateId(),
    label,
    description,
    risk,
    confidence,
    predictedOutcome
  };
}

/**
 * Decision analyzer - analyze decision quality
 */
export class DecisionAnalyzer {
  /**
   * Calculate decision score
   */
  calculateScore(decision: Decision): DecisionScore {
    const selectedOption = decision.options.find(
      (o) => o.id === decision.selected || o.label === decision.selected
    );
    
    if (!selectedOption) {
      return {
        decisionId: decision.id,
        score: 0,
        riskScore: 1,
        confidenceScore: 0,
        reasoningQuality: 0
      };
    }
    
    // Risk score (lower is better)
    const riskScore = selectedOption.risk;
    
    // Confidence score
    const confidenceScore = decision.confidence;
    
    // Reasoning quality (simple heuristic: length + specificity)
    const reasoningQuality = Math.min(
      1,
      decision.reasoning.length / 200
    );
    
    // Overall score (weighted average)
    const score =
      (1 - riskScore) * 0.3 +
      confidenceScore * 0.4 +
      reasoningQuality * 0.3;
    
    return {
      decisionId: decision.id,
      score,
      riskScore,
      confidenceScore,
      reasoningQuality
    };
  }

  /**
   * Compare two decisions
   */
  compareDecisions(
    decision1: Decision,
    decision2: Decision
  ): DecisionComparison {
    const score1 = this.calculateScore(decision1);
    const score2 = this.calculateScore(decision2);
    
    return {
      decision1Id: decision1.id,
      decision2Id: decision2.id,
      score1: score1.score,
      score2: score2.score,
      winner: score1.score >= score2.score ? decision1.id : decision2.id,
      reasoning: `Decision ${score1.score >= score2.score ? '1' : '2'} has higher score (${Math.max(score1.score, score2.score).toFixed(3)} vs ${Math.min(score1.score, score2.score).toFixed(3)})`
    };
  }

  /**
   * Validate decision
   */
  validate(decision: Decision): DecisionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    if (!decision.id) errors.push('Missing decision id');
    if (!decision.type) errors.push('Missing decision type');
    if (!decision.context) errors.push('Missing decision context');
    if (!decision.selected) errors.push('Missing selected option');
    if (!decision.reasoning) errors.push('Missing reasoning');
    
    // Check options
    if (!decision.options || decision.options.length === 0) {
      errors.push('No options provided');
    } else {
      // Check if selected option exists
      const selectedExists = decision.options.some(
        (o) => o.id === decision.selected || o.label === decision.selected
      );
      if (!selectedExists) {
        errors.push('Selected option not found in options');
      }
    }
    
    // Check confidence
    if (decision.confidence < 0 || decision.confidence > 1) {
      errors.push('Confidence must be between 0 and 1');
    }
    
    // Check reasoning quality
    if (decision.reasoning.length < 10) {
      warnings.push('Reasoning is very short');
    }
    
    return {
      decisionId: decision.id,
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export interface DecisionScore {
  decisionId: string;
  score: number;
  riskScore: number;
  confidenceScore: number;
  reasoningQuality: number;
}

export interface DecisionComparison {
  decision1Id: string;
  decision2Id: string;
  score1: number;
  score2: number;
  winner: string;
  reasoning: string;
}

export interface DecisionValidation {
  decisionId: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Decision store interface
 */
export interface DecisionStore {
  save(decision: Decision): Promise<void>;
  get(id: string): Promise<Decision | null>;
  list(filter?: DecisionFilter): Promise<Decision[]>;
  count(filter?: DecisionFilter): Promise<number>;
  getByType(type: DecisionType): Promise<Decision[]>;
  getByStateRevision(revision: string): Promise<Decision[]>;
  getLatest(): Promise<Decision | null>;
}

export interface DecisionFilter {
  type?: DecisionType;
  stateRevision?: string;
  after?: Date;
  before?: Date;
}

/**
 * In-memory decision store
 */
export class InMemoryDecisionStore implements DecisionStore {
  private decisions: Decision[] = [];
  private decisionsById: Map<string, Decision> = new Map();

  async save(decision: Decision): Promise<void> {
    this.decisions.push(deepClone(decision));
    this.decisionsById.set(decision.id, deepClone(decision));
  }

  async get(id: string): Promise<Decision | null> {
    const decision = this.decisionsById.get(id);
    return decision ? deepClone(decision) : null;
  }

  async list(filter?: DecisionFilter): Promise<Decision[]> {
    let results = [...this.decisions];
    
    if (filter) {
      if (filter.type) {
        results = results.filter((d) => d.type === filter.type);
      }
      if (filter.stateRevision) {
        results = results.filter(
          (d) => d.stateRevision === filter.stateRevision
        );
      }
      if (filter.after) {
        results = results.filter((d) => d.timestamp >= filter.after!);
      }
      if (filter.before) {
        results = results.filter((d) => d.timestamp <= filter.before!);
      }
    }
    
    return results.map(deepClone);
  }

  async count(filter?: DecisionFilter): Promise<number> {
    if (!filter) {
      return this.decisions.length;
    }
    const results = await this.list(filter);
    return results.length;
  }

  async getByType(type: DecisionType): Promise<Decision[]> {
    return this.list({ type });
  }

  async getByStateRevision(revision: string): Promise<Decision[]> {
    return this.list({ stateRevision: revision });
  }

  async getLatest(): Promise<Decision | null> {
    if (this.decisions.length === 0) {
      return null;
    }
    
    const sorted = [...this.decisions].sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    
    return deepClone(sorted[0]);
  }

  clear(): void {
    this.decisions = [];
    this.decisionsById.clear();
  }
}

/**
 * Decision serializer
 */
export function serializeDecision(decision: Decision): string {
  return JSON.stringify(decision, null, 2);
}

/**
 * Decision deserializer
 */
export function deserializeDecision(json: string): Decision {
  const data = JSON.parse(json);
  return {
    ...data,
    timestamp: new Date(data.timestamp)
  };
}

/**
 * Validate decision structure
 */
export function validateDecision(decision: unknown): decision is Decision {
  if (typeof decision !== 'object' || decision === null) {
    return false;
  }
  
  const d = decision as Record<string, unknown>;
  
  return (
    typeof d.id === 'string' &&
    typeof d.type === 'string' &&
    typeof d.context === 'string' &&
    Array.isArray(d.options) &&
    typeof d.selected === 'string' &&
    typeof d.reasoning === 'string' &&
    typeof d.confidence === 'number' &&
    d.timestamp instanceof Date
  );
}
