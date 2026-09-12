import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createEvent,
  matchesFilter,
  EventBus,
  InMemoryEventStore,
  replayEvents,
  createEventStream,
  serializeEvent,
  deserializeEvent,
  validateEvent
} from '../src/event.js';
import type { Event, EventType } from '../src/types.js';

describe('Event', () => {
  describe('createEvent', () => {
    it('should create an event with required fields', () => {
      const event = createEvent(
        'goal.created',
        'entity-1',
        'R001',
        { name: 'Test' }
      );

      expect(event).toBeDefined();
      expect(event.id).toBeDefined();
      expect(event.type).toBe('goal.created');
      expect(event.entityId).toBe('entity-1');
      expect(event.stateRevision).toBe('R001');
      expect(event.data).toEqual({ name: 'Test' });
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should create event with evidence', () => {
      const evidence = {
        id: 'ev-1',
        operation: 'test',
        timestamp: new Date(),
        stateRevision: 'R001'
      };

      const event = createEvent(
        'tool.invoked',
        'entity-1',
        'R001',
        {},
        evidence
      );

      expect(event.evidence).toBeDefined();
      expect(event.evidence!.id).toBe('ev-1');
    });

    it('should create event with empty data', () => {
      const event = createEvent('goal.created', 'entity-1', 'R001');
      expect(event.data).toEqual({});
    });
  });

  describe('matchesFilter', () => {
    it('should match event type', () => {
      const event = createEvent('goal.created', 'entity-1', 'R001');
      
      expect(matchesFilter(event, { types: ['goal.created'] })).toBe(true);
      expect(matchesFilter(event, { types: ['task.created'] })).toBe(false);
    });

    it('should match entity id', () => {
      const event = createEvent('goal.created', 'entity-1', 'R001');
      
      expect(matchesFilter(event, { entityIds: ['entity-1'] })).toBe(true);
      expect(matchesFilter(event, { entityIds: ['entity-2'] })).toBe(false);
    });

    it('should match state revision', () => {
      const event = createEvent('goal.created', 'entity-1', 'R001');
      
      expect(matchesFilter(event, { stateRevision: 'R001' })).toBe(true);
      expect(matchesFilter(event, { stateRevision: 'R002' })).toBe(false);
    });

    it('should match timestamp range', () => {
      const event = createEvent('goal.created', 'entity-1', 'R001');
      const now = new Date();
      const past = new Date(now.getTime() - 1000);
      const future = new Date(now.getTime() + 1000);
      
      expect(matchesFilter(event, { after: past })).toBe(true);
      expect(matchesFilter(event, { after: future })).toBe(false);
      expect(matchesFilter(event, { before: future })).toBe(true);
      expect(matchesFilter(event, { before: past })).toBe(false);
    });

    it('should match multiple filters', () => {
      const event = createEvent('goal.created', 'entity-1', 'R001');
      
      expect(matchesFilter(event, {
        types: ['goal.created'],
        entityIds: ['entity-1'],
        stateRevision: 'R001'
      })).toBe(true);
      
      expect(matchesFilter(event, {
        types: ['goal.created'],
        entityIds: ['entity-2']
      })).toBe(false);
    });
  });

  describe('EventBus', () => {
    let bus: EventBus;

    beforeEach(() => {
      bus = new EventBus();
    });

    it('should emit events to subscribers', async () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      const event = createEvent('goal.created', 'entity-1', 'R001');
      await bus.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should emit to type-specific subscribers', async () => {
      const goalHandler = vi.fn();
      const taskHandler = vi.fn();
      
      bus.subscribeTo('goal.created', goalHandler);
      bus.subscribeTo('task.created', taskHandler);

      const event = createEvent('goal.created', 'entity-1', 'R001');
      await bus.emit(event);

      expect(goalHandler).toHaveBeenCalledWith(event);
      expect(taskHandler).not.toHaveBeenCalled();
    });

    it('should unsubscribe', async () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe(handler);

      const event1 = createEvent('goal.created', 'entity-1', 'R001');
      await bus.emit(event1);
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      const event2 = createEvent('goal.created', 'entity-1', 'R001');
      await bus.emit(event2);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle async handlers', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe(handler);

      const event = createEvent('goal.created', 'entity-1', 'R001');
      await bus.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should clear all handlers', async () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      bus.clear();

      const event = createEvent('goal.created', 'entity-1', 'R001');
      await bus.emit(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should count handlers', () => {
      expect(bus.handlerCount()).toBe(0);

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.subscribe(handler1);
      bus.subscribeTo('goal.created', handler2);

      expect(bus.handlerCount()).toBe(1);
      expect(bus.handlerCount('goal.created')).toBe(1);
    });
  });

  describe('InMemoryEventStore', () => {
    let store: InMemoryEventStore;

    beforeEach(() => {
      store = new InMemoryEventStore();
    });

    it('should append and retrieve event', async () => {
      const event = createEvent('goal.created', 'entity-1', 'R001');
      await store.append(event);

      const retrieved = await store.get(event.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(event.id);
    });

    it('should return null for non-existent event', async () => {
      const retrieved = await store.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should list events with filter', async () => {
      await store.append(createEvent('goal.created', 'entity-1', 'R001'));
      await store.append(createEvent('task.created', 'entity-1', 'R001'));
      await store.append(createEvent('goal.created', 'entity-2', 'R001'));

      const goalEvents = await store.list({ types: ['goal.created'] });
      expect(goalEvents).toHaveLength(2);

      const entity1Events = await store.list({ entityIds: ['entity-1'] });
      expect(entity1Events).toHaveLength(2);
    });

    it('should get latest event for entity', async () => {
      const event1 = createEvent('goal.created', 'entity-1', 'R001');
      await store.append(event1);

      // Wait to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      const event2 = createEvent('goal.updated', 'entity-1', 'R002');
      await store.append(event2);

      const latest = await store.getLatest('entity-1');
      expect(latest!.id).toBe(event2.id);
    });

    it('should get events since timestamp', async () => {
      const oldEvent = createEvent('goal.created', 'entity-1', 'R001');
      await store.append(oldEvent);

      // Wait to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      const cutoff = new Date();
      await new Promise(resolve => setTimeout(resolve, 10));

      const newEvent = createEvent('goal.updated', 'entity-1', 'R002');
      await store.append(newEvent);

      const events = await store.getSince(cutoff);
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe(newEvent.id);
    });

    it('should count events', async () => {
      await store.append(createEvent('goal.created', 'entity-1', 'R001'));
      await store.append(createEvent('task.created', 'entity-1', 'R001'));

      expect(await store.count()).toBe(2);
      expect(await store.count({ types: ['goal.created'] })).toBe(1);
    });

    it('should clear events', async () => {
      await store.append(createEvent('goal.created', 'entity-1', 'R001'));
      store.clear();

      expect(await store.count()).toBe(0);
    });
  });

  describe('replayEvents', () => {
    it('should replay events to build state', async () => {
      const events = [
        createEvent('goal.created', 'entity-1', 'R001', { count: 1 }),
        createEvent('goal.updated', 'entity-1', 'R002', { count: 2 }),
        createEvent('goal.updated', 'entity-1', 'R003', { count: 3 })
      ];

      const initialState = { count: 0 };
      const reducer = (state: { count: number }, event: Event) => ({
        count: state.count + (event.data.count as number || 0)
      });

      const finalState = await replayEvents(events, initialState, reducer);
      expect(finalState.count).toBe(6);
    });
  });

  describe('createEventStream', () => {
    it('should create async iterable from store', async () => {
      const store = new InMemoryEventStore();
      await store.append(createEvent('goal.created', 'entity-1', 'R001'));
      await store.append(createEvent('task.created', 'entity-1', 'R001'));

      const stream = createEventStream(store);
      const events: Event[] = [];

      for await (const event of stream) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
    });
  });

  describe('serialize/deserialize', () => {
    it('should roundtrip event', () => {
      const event = createEvent('goal.created', 'entity-1', 'R001', { name: 'Test' });
      const json = serializeEvent(event);
      const deserialized = deserializeEvent(json);

      expect(deserialized.id).toBe(event.id);
      expect(deserialized.type).toBe(event.type);
      expect(deserialized.timestamp.getTime()).toBe(event.timestamp.getTime());
    });
  });

  describe('validateEvent', () => {
    it('should validate correct event', () => {
      const event = createEvent('goal.created', 'entity-1', 'R001');
      expect(validateEvent(event)).toBe(true);
    });

    it('should reject invalid event', () => {
      expect(validateEvent(null)).toBe(false);
      expect(validateEvent({})).toBe(false);
      expect(validateEvent({ id: '123' })).toBe(false);
    });
  });
});
