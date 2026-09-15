// ============================================================================
// Evidence: an append-only JSONL ledger for every control-plane decision.
// ----------------------------------------------------------------------------
// Same discipline as tests/production/evidence: one line per event, redacted,
// monotonic sequence numbers, and the file is written as the run proceeds so a
// run that dies mid-flight still leaves an audit trail.
// ============================================================================

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { EvidenceSink } from './types.ts';

const REDACT_PATTERNS: Array<[RegExp, string]> = [
  [/(Bearer\s+)[A-Za-z0-9._\-]{6,}/gi, '$1«redacted»'],
  [/("(?:api_?key|token|secret|password|authorization)"\s*:\s*")[^"]{4,}(")/gi, '$1«redacted»$2'],
  [/\b(?:hf_|ghp_|github_pat_|sk-|AKIA)[A-Za-z0-9_\-]{6,}/g, '«credential»'],
];

export function redact(value: unknown): unknown {
  if (typeof value === 'string') {
    return REDACT_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      out[key] = /token|secret|key|authorization|password/i.test(key) ? '«redacted»' : redact(raw);
    }
    return out;
  }
  return value;
}

export function truncate(value: unknown, max = 4000): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…<+${text.length - max}B>` : text;
}

export interface LedgerOptions {
  path: string;
  runId: string;
  /** Set to false to keep the ledger in memory only (tests). */
  persist?: boolean;
}

export class JsonlLedger implements EvidenceSink {
  readonly path: string;
  readonly runId: string;
  private seq = 0;
  private buffer: string[] = [];
  private readonly persist: boolean;

  constructor(options: LedgerOptions) {
    this.path = options.path;
    this.runId = options.runId;
    this.persist = options.persist !== false;
    if (this.persist) {
      mkdirSync(dirname(this.path), { recursive: true });
      writeFileSync(this.path, '', 'utf8');
      this.write({ type: 'run:start', runId: this.runId, node: process.version, at: new Date().toISOString() });
    }
  }

  write(event: Record<string, unknown>): void {
    this.seq += 1;
    const line = JSON.stringify(redact({ seq: this.seq, at: new Date().toISOString(), ...event }));
    this.buffer.push(line);
    if (this.persist) appendFileSync(this.path, `${line}\n`, 'utf8');
  }

  get events(): number {
    return this.seq;
  }

  read(): Array<Record<string, unknown>> {
    const source = this.persist ? readFileSync(this.path, 'utf8') : this.buffer.join('\n');
    return source
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }

  close(summary: Record<string, unknown>): void {
    this.write({ type: 'run:end', ...summary });
  }
}

export function defaultLedgerPath(baseDir: string, runId: string): string {
  return `${baseDir}/${runId}.jsonl`;
}
