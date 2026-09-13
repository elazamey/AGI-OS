import { generateId } from '@agi-os/kernel';

export interface AuditEvent {
  id: string;
  type: 'governance' | 'tool' | 'mission' | 'security' | 'system';
  action: string;
  actor: string;
  target?: string;
  result: 'success' | 'failure' | 'denied';
  metadata: Record<string, unknown>;
  timestamp: number;
}

export interface AuditQuery {
  type?: string;
  action?: string;
  actor?: string;
  result?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents: number;

  constructor(maxEvents: number = 10000) {
    this.maxEvents = maxEvents;
  }

  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): AuditEvent {
    if (this.events.length >= this.maxEvents) {
      this.events.shift();
    }

    const fullEvent: AuditEvent = {
      ...event,
      id: generateId(),
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);
    return fullEvent;
  }

  logGovernance(action: string, actor: string, target: string, result: 'success' | 'failure' | 'denied', metadata: Record<string, unknown> = {}): AuditEvent {
    return this.log({
      type: 'governance',
      action,
      actor,
      target,
      result,
      metadata,
    });
  }

  logTool(action: string, actor: string, target: string, result: 'success' | 'failure' | 'denied', metadata: Record<string, unknown> = {}): AuditEvent {
    return this.log({
      type: 'tool',
      action,
      actor,
      target,
      result,
      metadata,
    });
  }

  logMission(action: string, actor: string, target: string, result: 'success' | 'failure' | 'denied', metadata: Record<string, unknown> = {}): AuditEvent {
    return this.log({
      type: 'mission',
      action,
      actor,
      target,
      result,
      metadata,
    });
  }

  logSecurity(action: string, actor: string, target: string, result: 'success' | 'failure' | 'denied', metadata: Record<string, unknown> = {}): AuditEvent {
    return this.log({
      type: 'security',
      action,
      actor,
      target,
      result,
      metadata,
    });
  }

  logSystem(action: string, actor: string, result: 'success' | 'failure' | 'denied', metadata: Record<string, unknown> = {}): AuditEvent {
    return this.log({
      type: 'system',
      action,
      actor,
      result,
      metadata,
    });
  }

  query(query: AuditQuery): AuditEvent[] {
    let results = [...this.events];

    if (query.type) {
      results = results.filter(e => e.type === query.type);
    }
    if (query.action) {
      results = results.filter(e => e.action === query.action);
    }
    if (query.actor) {
      results = results.filter(e => e.actor === query.actor);
    }
    if (query.result) {
      results = results.filter(e => e.result === query.result);
    }
    if (query.startTime) {
      results = results.filter(e => e.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      results = results.filter(e => e.timestamp <= query.endTime!);
    }
    if (query.limit) {
      results = results.slice(-query.limit);
    }

    return results;
  }

  getEvents(): AuditEvent[] {
    return [...this.events];
  }

  getEventsByType(type: string): AuditEvent[] {
    return this.events.filter(e => e.type === type);
  }

  getEventsByResult(result: string): AuditEvent[] {
    return this.events.filter(e => e.result === result);
  }

  clear(): void {
    this.events = [];
  }

  size(): number {
    return this.events.length;
  }
}
