// ============================================================================
// AGI OS - Event System
// Event-driven foundation with pub/sub and event sourcing
// ============================================================================

import { generateId, now, deepClone } from './utils.js';
import type { Event, EventType, Evidence } from './types.js';

/**
 * Create a new event
 */
export function createEvent(
  type: EventType,
  entityId: string,
  stateRevision: string,
  data: Record<string, unknown> = {},
  evidence?: Evidence,
  metadata?: Record<string, unknown>
): Event {
  return {
    id: generateId(),
    type,
    timestamp: now(),
    entityId,
    stateRevision,
    data: deepClone(data),
    evidence,
    metadata: metadata ? deepClone(metadata) : undefined
  };
}

/**
 * Event handler function type
 */
export type EventHandler = (event: Event) => void | Promise<void>;

/**
 * Event filter for subscriptions
 */
export interface EventFilter {
  types?: EventType[];
  entityIds?: string[];
  stateRevision?: string;
  after?: Date;
  before?: Date;
}

/**
 * Check if an event matches a filter
 */
export function matchesFilter(event: Event, filter: EventFilter): boolean {
  if (filter.types && !filter.types.includes(event.type)) {
    return false;
  }
  if (filter.entityIds && !filter.entityIds.includes(event.entityId)) {
    return false;
  }
  if (filter.stateRevision && event.stateRevision !== filter.stateRevision) {
    return false;
  }
  if (filter.after && event.timestamp < filter.after) {
    return false;
  }
  if (filter.before && event.timestamp > filter.before) {
    return false;
  }
  return true;
}

/**
 * Event bus for pub/sub
 */
export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private globalHandlers: EventHandler[] = [];

  /**
   * Subscribe to all events
   */
  subscribe(handler: EventHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      const index = this.globalHandlers.indexOf(handler);
      if (index > -1) {
        this.globalHandlers.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to specific event types
   */
  subscribeTo(
    types: EventType | EventType[],
    handler: EventHandler
  ): () => void {
    const typeArray = Array.isArray(types) ? types : [types];
    
    for (const type of typeArray) {
      if (!this.handlers.has(type)) {
        this.handlers.set(type, []);
      }
      this.handlers.get(type)!.push(handler);
    }
    
    return () => {
      for (const type of typeArray) {
        const handlers = this.handlers.get(type);
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        }
      }
    };
  }

  /**
   * Emit an event
   */
  async emit(event: Event): Promise<void> {
    // Notify global handlers
    for (const handler of this.globalHandlers) {
      await handler(event);
    }
    
    // Notify type-specific handlers
    const handlers = this.handlers.get(event.type) || [];
    for (const handler of handlers) {
      await handler(event);
    }
  }

  /**
   * Get handler count for a type
   */
  handlerCount(type?: EventType): number {
    if (type) {
      return (this.handlers.get(type) || []).length;
    }
    return this.globalHandlers.length;
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    this.globalHandlers = [];
  }
}

/**
 * Event store interface
 */
export interface EventStore {
  append(event: Event): Promise<void>;
  get(id: string): Promise<Event | null>;
  list(filter?: EventFilter): Promise<Event[]>;
  count(filter?: EventFilter): Promise<number>;
  getLatest(entityId: string): Promise<Event | null>;
  getSince(timestamp: Date): Promise<Event[]>;
}

/**
 * In-memory event store
 */
export class InMemoryEventStore implements EventStore {
  private events: Event[] = [];
  private eventsById: Map<string, Event> = new Map();

  async append(event: Event): Promise<void> {
    this.events.push(deepClone(event));
    this.eventsById.set(event.id, deepClone(event));
  }

  async get(id: string): Promise<Event | null> {
    const event = this.eventsById.get(id);
    return event ? deepClone(event) : null;
  }

  async list(filter?: EventFilter): Promise<Event[]> {
    let events = [...this.events];
    
    if (filter) {
      events = events.filter((e) => matchesFilter(e, filter));
    }
    
    return events.map(deepClone);
  }

  async count(filter?: EventFilter): Promise<number> {
    if (!filter) {
      return this.events.length;
    }
    const events = await this.list(filter);
    return events.length;
  }

  async getLatest(entityId: string): Promise<Event | null> {
    const entityEvents = this.events
      .filter((e) => e.entityId === entityId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    return entityEvents.length > 0 ? deepClone(entityEvents[0]) : null;
  }

  async getSince(timestamp: Date): Promise<Event[]> {
    return this.events
      .filter((e) => e.timestamp >= timestamp)
      .map(deepClone);
  }

  clear(): void {
    this.events = [];
    this.eventsById.clear();
  }
}

/**
 * Event sourcing - replay events to rebuild state
 */
export async function replayEvents<T>(
  events: Event[],
  initialState: T,
  reducer: (state: T, event: Event) => T
): Promise<T> {
  let state = initialState;
  for (const event of events) {
    state = reducer(state, event);
  }
  return state;
}

/**
 * Create event stream from store
 */
export function createEventStream(
  store: EventStore,
  filter?: EventFilter
): AsyncIterable<Event> {
  return {
    [Symbol.asyncIterator]: async function* () {
      const events = await store.list(filter);
      for (const event of events) {
        yield event;
      }
    }
  };
}

/**
 * Event serializer
 */
export function serializeEvent(event: Event): string {
  return JSON.stringify(event, null, 2);
}

/**
 * Event deserializer
 */
export function deserializeEvent(json: string): Event {
  const data = JSON.parse(json);
  return {
    ...data,
    timestamp: new Date(data.timestamp),
    evidence: data.evidence
      ? {
          ...data.evidence,
          timestamp: new Date(data.evidence.timestamp)
        }
      : undefined
  };
}

/**
 * Validate event structure
 */
export function validateEvent(event: unknown): event is Event {
  if (typeof event !== 'object' || event === null) {
    return false;
  }
  
  const e = event as Record<string, unknown>;
  
  return (
    typeof e.id === 'string' &&
    typeof e.type === 'string' &&
    e.timestamp instanceof Date &&
    typeof e.entityId === 'string' &&
    typeof e.stateRevision === 'string' &&
    typeof e.data === 'object' &&
    e.data !== null
  );
}
