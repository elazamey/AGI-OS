// ============================================================================
// AGI OS - Mission Context
// Shared context for mission execution
// ============================================================================

import type { Evidence } from '@agi-os/kernel';
import type { Task, TaskResult, MissionContext } from './types.js';

// ---------------------------------------------------------------------------
// Mission Context Implementation
// ---------------------------------------------------------------------------
export class MissionContextImpl implements MissionContext {
  private state: Record<string, unknown> = {};
  private evidences: Evidence[] = [];
  private taskResults: Map<string, TaskResult> = new Map();

  constructor(
    public readonly missionId: string,
    public readonly missionGoal: string,
    private _tasks: Task[] = [],
    public readonly metadata: Record<string, unknown> = {}
  ) {}

  /**
   * Get tasks
   */
  get tasks(): Task[] {
    return [...this._tasks];
  }

  /**
   * Set tasks
   */
  setTasks(tasks: Task[]): void {
    this._tasks = tasks;
  }

  /**
   * Get state
   */
  getState(): Record<string, unknown> {
    return { ...this.state };
  }

  /**
   * Set state value
   */
  setState(key: string, value: unknown): void {
    this.state[key] = value;
  }

  /**
   * Get state value
   */
  getStateValue<T = unknown>(key: string): T | undefined {
    return this.state[key] as T | undefined;
  }

  /**
   * Get task result
   */
  getTaskResult(taskId: string): TaskResult | undefined {
    const result = this.taskResults.get(taskId);
    return result ? { ...result } : undefined;
  }

  /**
   * Set task result
   */
  setTaskResult(taskId: string, result: TaskResult): void {
    this.taskResults.set(taskId, { ...result });
  }

  /**
   * Add evidence
   */
  addEvidence(evidence: Evidence): void {
    this.evidences.push({ ...evidence });
  }

  /**
   * Get all evidences
   */
  getEvidences(): Evidence[] {
    return [...this.evidences];
  }

  /**
   * Get evidence count
   */
  getEvidenceCount(): number {
    return this.evidences.length;
  }

  /**
   * Get task IDs
   */
  getTaskIds(): string[] {
    return this._tasks.map((t) => t.id);
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this._tasks.find((t) => t.id === taskId);
  }

  /**
   * Clear context
   */
  clear(): void {
    this.state = {};
    this.evidences = [];
    this.taskResults.clear();
  }
}

// ---------------------------------------------------------------------------
// Mission Context Factory
// ---------------------------------------------------------------------------
export function createMissionContext(
  missionId: string,
  missionGoal: string,
  tasks: Task[] = [],
  metadata: Record<string, unknown> = {}
): MissionContextImpl {
  return new MissionContextImpl(missionId, missionGoal, tasks, metadata);
}

// ---------------------------------------------------------------------------
// Mission Events
// ---------------------------------------------------------------------------
import { generateId, now } from '@agi-os/kernel';
import type { MissionEvent, MissionEventType } from './types.js';

// ---------------------------------------------------------------------------
// Event Store for Missions
// ---------------------------------------------------------------------------
export class MissionEventStore {
  private events: MissionEvent[] = [];
  private eventsById: Map<string, MissionEvent> = new Map();

  /**
   * Create and store an event
   */
  createEvent(
    type: MissionEventType,
    missionId: string,
    revision: number,
    taskId?: string,
    data: Record<string, unknown> = {}
  ): MissionEvent {
    const event: MissionEvent = {
      id: generateId(),
      type,
      missionId,
      taskId,
      timestamp: now(),
      data: { ...data },
      revision
    };

    this.events.push({ ...event });
    this.eventsById.set(event.id, { ...event });

    return event;
  }

  /**
   * Get event by ID
   */
  getEvent(id: string): MissionEvent | undefined {
    const event = this.eventsById.get(id);
    return event ? { ...event } : undefined;
  }

  /**
   * Get all events
   */
  getAllEvents(): MissionEvent[] {
    return this.events.map((e) => ({ ...e }));
  }

  /**
   * Get events for a mission
   */
  getMissionEvents(missionId: string): MissionEvent[] {
    return this.events
      .filter((e) => e.missionId === missionId)
      .map((e) => ({ ...e }));
  }

  /**
   * Get events for a task
   */
  getTaskEvents(taskId: string): MissionEvent[] {
    return this.events
      .filter((e) => e.taskId === taskId)
      .map((e) => ({ ...e }));
  }

  /**
   * Get events by type
   */
  getEventsByType(type: MissionEventType): MissionEvent[] {
    return this.events
      .filter((e) => e.type === type)
      .map((e) => ({ ...e }));
  }

  /**
   * Get events in revision range
   */
  getEventsInRevisionRange(
    missionId: string,
    fromRevision: number,
    toRevision: number
  ): MissionEvent[] {
    return this.events
      .filter(
        (e) =>
          e.missionId === missionId &&
          e.revision >= fromRevision &&
          e.revision <= toRevision
      )
      .map((e) => ({ ...e }));
  }

  /**
   * Get latest event for mission
   */
  getLatestMissionEvent(missionId: string): MissionEvent | undefined {
    const missionEvents = this.getMissionEvents(missionId);
    if (missionEvents.length === 0) return undefined;
    return missionEvents[missionEvents.length - 1];
  }

  /**
   * Get event count
   */
  count(): number {
    return this.events.length;
  }

  /**
   * Clear events
   */
  clear(): void {
    this.events = [];
    this.eventsById.clear();
  }
}

// ---------------------------------------------------------------------------
// Event Store Factory
// ---------------------------------------------------------------------------
export function createMissionEventStore(): MissionEventStore {
  return new MissionEventStore();
}
