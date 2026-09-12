// ============================================================================
// AGI OS - Evidence System
// Proof that something happened - audit trail and verification
// ============================================================================

import { generateId, now, hashString, deepClone } from './utils.js';
import type { Evidence } from './types.js';

/**
 * Create evidence from a command execution
 */
export function createCommandEvidence(
  operation: string,
  command: string,
  args: string[],
  exitCode: number,
  stdout: string,
  stderr: string,
  stateRevision: string,
  duration: number,
  metadata?: Record<string, unknown>
): Evidence {
  return {
    id: generateId(),
    operation,
    command,
    args,
    exitCode,
    stdout,
    stdoutHash: stdout ? hashString(stdout) : undefined,
    stderr,
    stderrHash: stderr ? hashString(stderr) : undefined,
    timestamp: now(),
    stateRevision,
    duration,
    metadata
  };
}

/**
 * Create evidence from a tool execution
 */
export function createToolEvidence(
  toolId: string,
  input: Record<string, unknown>,
  output: unknown,
  success: boolean,
  stateRevision: string,
  duration: number,
  error?: string
): Evidence {
  return {
    id: generateId(),
    operation: `tool.${toolId}`,
    exitCode: success ? 0 : 1,
    stdout: JSON.stringify(output),
    stdoutHash: hashString(JSON.stringify(output)),
    stderr: error,
    stderrHash: error ? hashString(error) : undefined,
    timestamp: now(),
    stateRevision,
    duration,
    metadata: {
      toolId,
      input: deepClone(input),
      success
    }
  };
}

/**
 * Create evidence from an observation
 */
export function createObservationEvidence(
  observationType: string,
  data: Record<string, unknown>,
  stateRevision: string
): Evidence {
  return {
    id: generateId(),
    operation: `observation.${observationType}`,
    stdout: JSON.stringify(data),
    stdoutHash: hashString(JSON.stringify(data)),
    timestamp: now(),
    stateRevision,
    metadata: {
      observationType,
      data: deepClone(data)
    }
  };
}

/**
 * Evidence verifier
 */
export class EvidenceVerifier {
  /**
   * Verify evidence integrity
   */
  verify(evidence: Evidence): boolean {
    // Check required fields
    if (!evidence.id || !evidence.operation || !evidence.timestamp) {
      return false;
    }
    
    // Verify stdout hash
    if (evidence.stdout && evidence.stdoutHash) {
      const computedHash = hashString(evidence.stdout);
      if (computedHash !== evidence.stdoutHash) {
        return false;
      }
    }
    
    // Verify stderr hash
    if (evidence.stderr && evidence.stderrHash) {
      const computedHash = hashString(evidence.stderr);
      if (computedHash !== evidence.stderrHash) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Verify command succeeded
   */
  verifyCommandSuccess(evidence: Evidence): boolean {
    return evidence.exitCode === 0;
  }

  /**
   * Verify tool execution
   */
  verifyToolExecution(
    evidence: Evidence,
    expectedToolId: string
  ): boolean {
    if (!evidence.operation.startsWith('tool.')) {
      return false;
    }
    
    const toolId = evidence.operation.slice(5);
    return toolId === expectedToolId;
  }

  /**
   * Verify evidence matches state revision
   */
  verifyStateRevision(
    evidence: Evidence,
    expectedRevision: string
  ): boolean {
    return evidence.stateRevision === expectedRevision;
  }

  /**
   * Verify evidence timestamp is within range
   */
  verifyTimestampRange(
    evidence: Evidence,
    start: Date,
    end: Date
  ): boolean {
    return evidence.timestamp >= start && evidence.timestamp <= end;
  }

  /**
   * Create verification report
   */
  createReport(evidence: Evidence): EvidenceVerificationReport {
    const checks: VerificationCheck[] = [];
    
    // Basic structure check
    checks.push({
      name: 'structure',
      passed: !!(evidence.id && evidence.operation && evidence.timestamp),
      message: 'Basic structure validation'
    });
    
    // Hash verification
    if (evidence.stdout && evidence.stdoutHash) {
      const computedHash = hashString(evidence.stdout);
      checks.push({
        name: 'stdout_hash',
        passed: computedHash === evidence.stdoutHash,
        message: `Expected ${evidence.stdoutHash}, got ${computedHash}`
      });
    }
    
    if (evidence.stderr && evidence.stderrHash) {
      const computedHash = hashString(evidence.stderr);
      checks.push({
        name: 'stderr_hash',
        passed: computedHash === evidence.stderrHash,
        message: `Expected ${evidence.stderrHash}, got ${computedHash}`
      });
    }
    
    // Exit code check
    if (evidence.exitCode !== undefined) {
      checks.push({
        name: 'exit_code',
        passed: evidence.exitCode >= 0,
        message: `Exit code: ${evidence.exitCode}`
      });
    }
    
    const passed = checks.every((c) => c.passed);
    
    return {
      evidenceId: evidence.id,
      passed,
      checks,
      timestamp: now()
    };
  }
}

export interface VerificationCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface EvidenceVerificationReport {
  evidenceId: string;
  passed: boolean;
  checks: VerificationCheck[];
  timestamp: Date;
}

/**
 * Evidence store interface
 */
export interface EvidenceStore {
  save(evidence: Evidence): Promise<void>;
  get(id: string): Promise<Evidence | null>;
  list(filter?: EvidenceFilter): Promise<Evidence[]>;
  count(filter?: EvidenceFilter): Promise<number>;
  getByOperation(operation: string): Promise<Evidence[]>;
  getByStateRevision(revision: string): Promise<Evidence[]>;
  getSuccessful(): Promise<Evidence[]>;
  getFailed(): Promise<Evidence[]>;
}

export interface EvidenceFilter {
  operation?: string;
  stateRevision?: string;
  success?: boolean;
  after?: Date;
  before?: Date;
}

/**
 * In-memory evidence store
 */
export class InMemoryEvidenceStore implements EvidenceStore {
  private evidence: Evidence[] = [];
  private evidenceById: Map<string, Evidence> = new Map();

  async save(evidence: Evidence): Promise<void> {
    this.evidence.push(deepClone(evidence));
    this.evidenceById.set(evidence.id, deepClone(evidence));
  }

  async get(id: string): Promise<Evidence | null> {
    const e = this.evidenceById.get(id);
    return e ? deepClone(e) : null;
  }

  async list(filter?: EvidenceFilter): Promise<Evidence[]> {
    let results = [...this.evidence];
    
    if (filter) {
      if (filter.operation) {
        results = results.filter((e) => e.operation === filter.operation);
      }
      if (filter.stateRevision) {
        results = results.filter(
          (e) => e.stateRevision === filter.stateRevision
        );
      }
      if (filter.success !== undefined) {
        results = results.filter((e) =>
          filter.success ? e.exitCode === 0 : e.exitCode !== 0
        );
      }
      if (filter.after) {
        results = results.filter((e) => e.timestamp >= filter.after!);
      }
      if (filter.before) {
        results = results.filter((e) => e.timestamp <= filter.before!);
      }
    }
    
    return results.map(deepClone);
  }

  async count(filter?: EvidenceFilter): Promise<number> {
    if (!filter) {
      return this.evidence.length;
    }
    const results = await this.list(filter);
    return results.length;
  }

  async getByOperation(operation: string): Promise<Evidence[]> {
    return this.list({ operation });
  }

  async getByStateRevision(revision: string): Promise<Evidence[]> {
    return this.list({ stateRevision: revision });
  }

  async getSuccessful(): Promise<Evidence[]> {
    return this.list({ success: true });
  }

  async getFailed(): Promise<Evidence[]> {
    return this.list({ success: false });
  }

  clear(): void {
    this.evidence = [];
    this.evidenceById.clear();
  }
}

/**
 * Evidence serializer
 */
export function serializeEvidence(evidence: Evidence): string {
  return JSON.stringify(evidence, null, 2);
}

/**
 * Evidence deserializer
 */
export function deserializeEvidence(json: string): Evidence {
  const data = JSON.parse(json);
  return {
    ...data,
    timestamp: new Date(data.timestamp)
  };
}

/**
 * Validate evidence structure
 */
export function validateEvidence(evidence: unknown): evidence is Evidence {
  if (typeof evidence !== 'object' || evidence === null) {
    return false;
  }
  
  const e = evidence as Record<string, unknown>;
  
  return (
    typeof e.id === 'string' &&
    typeof e.operation === 'string' &&
    e.timestamp instanceof Date &&
    typeof e.stateRevision === 'string'
  );
}
