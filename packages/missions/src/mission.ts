// ============================================================================
// AGI OS - Mission System
// Mission creation, management, and execution
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import {
  type Mission,
  type MissionState,
  type Task,
  type TaskExecutor,
  type MissionConfig,
  type MissionError,
  DEFAULT_MISSION_CONFIG,
  InvalidTransitionError
} from './types.js';
import { MissionStateMachine } from './state-machine.js';
import { TaskManager, createTask } from './task.js';
import { createTaskGraph } from './task-graph.js';
import type { MissionContextImpl} from './mission-context.js';
import { createMissionContext, MissionEventStore } from './mission-context.js';

// ---------------------------------------------------------------------------
// Mission Manager - Creates and manages missions
// ---------------------------------------------------------------------------
export class MissionManager {
  private missions: Map<string, Mission> = new Map();
  private stateMachines: Map<string, MissionStateMachine> = new Map();
  private taskManagers: Map<string, TaskManager> = new Map();
  private eventStores: Map<string, MissionEventStore> = new Map();

  /**
   * Create a new mission
   */
  createMission(
    goal: string,
    options: {
      description?: string;
      metadata?: Record<string, unknown>;
      maxRetries?: number;
      timeout?: number;
    } = {}
  ): Mission {
    const timestamp = now();
    const id = generateId();

    const mission: Mission = {
      id,
      goal,
      description: options.description,
      state: 'created',
      revision: 0,
      tasks: [],
      metadata: options.metadata ? { ...options.metadata } : {},
      createdAt: timestamp,
      updatedAt: timestamp,
      retryCount: 0,
      maxRetries: options.maxRetries ?? DEFAULT_MISSION_CONFIG.maxRetries,
      timeout: options.timeout
    };

    this.missions.set(id, mission);
    this.stateMachines.set(id, new MissionStateMachine('created'));
    this.taskManagers.set(id, new TaskManager());
    this.eventStores.set(id, new MissionEventStore());

    // Record creation event
    this.recordEvent(id, 'mission.created', { goal });

    return mission;
  }

  /**
   * Get a mission
   */
  getMission(missionId: string): Mission | undefined {
    const mission = this.missions.get(missionId);
    return mission ? { ...mission, tasks: mission.tasks.map((t) => ({ ...t })) } : undefined;
  }

  /**
   * Get all missions
   */
  getAllMissions(): Mission[] {
    return Array.from(this.missions.values()).map((m) => ({
      ...m,
      tasks: m.tasks.map((t) => ({ ...t }))
    }));
  }

  /**
   * Get missions by state
   */
  getMissionsByState(state: MissionState): Mission[] {
    return this.getAllMissions().filter((m) => m.state === state);
  }

  /**
   * Add task to mission
   */
  addTask(
    missionId: string,
    name: string,
    options: {
      description?: string;
      priority?: Task['priority'];
      dependencies?: string[];
      maxRetries?: number;
      timeout?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Task {
    const mission = this.missions.get(missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`);
    }

    const task = createTask(missionId, name, options);
    const taskManager = this.taskManagers.get(missionId)!;
    taskManager.addTask(task);

    mission.tasks.push(task);
    mission.updatedAt = now();
    mission.revision++;

    // Record event
    this.recordEvent(missionId, 'task.created', { task }, task.id);

    return task;
  }

  /**
   * Transition mission state
   */
  transitionMission(missionId: string, toState: MissionState): void {
    const mission = this.missions.get(missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`);
    }

    const sm = this.stateMachines.get(missionId)!;

    try {
      sm.transition(toState);
    } catch (error) {
      if (error instanceof InvalidTransitionError) {
        throw new InvalidTransitionError(
          'mission',
          missionId,
          mission.state,
          toState
        );
      }
      throw error;
    }

    const timestamp = now();
    mission.state = toState;
    mission.updatedAt = timestamp;
    mission.revision++;

    // Set timestamps
    switch (toState) {
      case 'running':
        mission.startedAt = timestamp;
        break;
      case 'completed':
        mission.completedAt = timestamp;
        break;
      case 'failed':
        mission.failedAt = timestamp;
        break;
      case 'cancelled':
        mission.cancelledAt = timestamp;
        break;
    }

    // Record event
    const eventType = `mission.${toState}` as const;
    this.recordEvent(missionId, eventType, { state: toState });
  }

  /**
   * Try to transition mission
   */
  tryTransitionMission(missionId: string, toState: MissionState): boolean {
    try {
      this.transitionMission(missionId, toState);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start mission (transition to running)
   */
  startMission(missionId: string): void {
    const mission = this.missions.get(missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`);
    }

    // Validate tasks exist
    if (mission.tasks.length === 0) {
      throw new Error(`Mission ${missionId} has no tasks`);
    }

    // Validate task dependencies
    const graph = createTaskGraph(mission.tasks);
    const validation = graph.validate();
    if (!validation.valid) {
      throw new Error(`Invalid task dependencies: ${validation.errors.join(', ')}`);
    }

    // Transition through states
    if (mission.state === 'created') {
      this.transitionMission(missionId, 'planning');
    }
    if (mission.state === 'planning') {
      this.transitionMission(missionId, 'ready');
    }
    if (mission.state === 'ready') {
      this.transitionMission(missionId, 'running');
    }
  }

  /**
   * Complete mission
   */
  completeMission(missionId: string): void {
    const mission = this.missions.get(missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`);
    }

    // Check all tasks are completed
    const taskManager = this.taskManagers.get(missionId)!;
    const incompleteTasks = taskManager.getTasksByState('pending')
      .concat(taskManager.getTasksByState('ready'))
      .concat(taskManager.getTasksByState('running'))
      .concat(taskManager.getTasksByState('failed'));

    if (incompleteTasks.length > 0) {
      throw new Error(`Mission ${missionId} has incomplete tasks`);
    }

    this.transitionMission(missionId, 'verifying');
    this.transitionMission(missionId, 'completed');
  }

  /**
   * Fail mission
   */
  failMission(missionId: string, error?: MissionError): void {
    const mission = this.missions.get(missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`);
    }

    if (error) {
      mission.error = error;
    }

    this.transitionMission(missionId, 'failed');
  }

  /**
   * Cancel mission
   */
  cancelMission(missionId: string): void {
    const mission = this.missions.get(missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`);
    }

    // Cancel all pending tasks
    const taskManager = this.taskManagers.get(missionId)!;
    const pendingTasks = taskManager.getTasksByState('pending')
      .concat(taskManager.getTasksByState('ready'))
      .concat(taskManager.getTasksByState('waiting'));

    for (const task of pendingTasks) {
      taskManager.transitionTask(task.id, 'cancelled');
    }

    this.transitionMission(missionId, 'cancelled');
  }

  /**
   * Retry mission
   */
  retryMission(missionId: string): void {
    const mission = this.missions.get(missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`);
    }

    if (mission.retryCount >= mission.maxRetries) {
      throw new Error(`Mission ${missionId} has reached max retries`);
    }

    mission.retryCount++;
    mission.error = undefined;

    // Reset state machine
    const sm = this.stateMachines.get(missionId)!;
    sm.reset();

    // Reset mission state
    mission.state = 'created';
    mission.updatedAt = now();
    mission.revision++;

    // Reset failed tasks
    const taskManager = this.taskManagers.get(missionId)!;
    const failedTasks = taskManager.getTasksByState('failed');
    for (const task of failedTasks) {
      taskManager.transitionTask(task.id, 'pending');
      task.retryCount = 0;
      task.error = undefined;
    }

    // Record event
    this.recordEvent(missionId, 'mission.retrying', {
      retryCount: mission.retryCount
    });
  }

  /**
   * Get mission state machine
   */
  getStateMachine(missionId: string): MissionStateMachine | undefined {
    return this.stateMachines.get(missionId);
  }

  /**
   * Get task manager for mission
   */
  getTaskManager(missionId: string): TaskManager | undefined {
    return this.taskManagers.get(missionId);
  }

  /**
   * Get event store for mission
   */
  getEventStore(missionId: string): MissionEventStore | undefined {
    return this.eventStores.get(missionId);
  }

  /**
   * Get mission events
   */
  getMissionEvents(missionId: string) {
    const store = this.eventStores.get(missionId);
    return store ? store.getAllEvents() : [];
  }

  /**
   * Remove mission
   */
  removeMission(missionId: string): boolean {
    this.stateMachines.delete(missionId);
    this.taskManagers.delete(missionId);
    this.eventStores.delete(missionId);
    return this.missions.delete(missionId);
  }

  /**
   * Clear all missions
   */
  clear(): void {
    this.missions.clear();
    this.stateMachines.clear();
    this.taskManagers.clear();
    this.eventStores.clear();
  }

  /**
   * Record event
   */
  private recordEvent(
    missionId: string,
    type: any,
    data: Record<string, unknown>,
    taskId?: string
  ): void {
    const mission = this.missions.get(missionId);
    const store = this.eventStores.get(missionId);
    if (mission && store) {
      store.createEvent(type, missionId, mission.revision, taskId, data);
    }
  }
}

// ---------------------------------------------------------------------------
// Mission Runner - Executes missions
// ---------------------------------------------------------------------------
export class MissionRunner {
  private executor: TaskExecutor;
  private config: MissionConfig;
  private missionManager: MissionManager;

  constructor(
    missionManager: MissionManager,
    executor: TaskExecutor,
    config: Partial<MissionConfig> = {}
  ) {
    this.missionManager = missionManager;
    this.executor = executor;
    this.config = { ...DEFAULT_MISSION_CONFIG, ...config };
  }

  /**
   * Execute a mission
   */
  async execute(missionId: string): Promise<Mission> {
    const mission = this.missionManager.getMission(missionId);
    if (!mission) {
      throw new Error(`Mission not found: ${missionId}`);
    }

    // Start mission
    this.missionManager.startMission(missionId);

    // Create context
    const context = createMissionContext(
      missionId,
      mission.goal,
      mission.tasks
    );

    // Execute tasks
    try {
      await this.executeTasks(missionId, context);

      // Complete mission
      this.missionManager.completeMission(missionId);

      return this.missionManager.getMission(missionId)!;
    } catch (error) {
      // Fail mission
      this.missionManager.failMission(missionId, {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      return this.missionManager.getMission(missionId)!;
    }
  }

  /**
   * Execute tasks in dependency order
   */
  private async executeTasks(
    missionId: string,
    context: MissionContextImpl
  ): Promise<void> {
    const mission = this.missionManager.getMission(missionId)!;

    // Build task graph
    const graph = createTaskGraph(mission.tasks);
    const layers = graph.getExecutionLayers();

    // Execute layer by layer
    for (const layer of layers) {
      // Execute tasks in layer (potentially parallel)
      const promises = layer.map((taskId) =>
        this.executeTask(missionId, taskId, context)
      );

      await Promise.all(promises);

      // Check if mission was cancelled or failed
      const currentMission = this.missionManager.getMission(missionId);
      if (!currentMission || currentMission.state === 'cancelled') {
        throw new Error('Mission was cancelled');
      }
      if (currentMission.state === 'failed') {
        throw new Error('Mission failed');
      }
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    missionId: string,
    taskId: string,
    context: MissionContextImpl
  ): Promise<void> {
    const taskManager = this.missionManager.getTaskManager(missionId)!;
    const task = taskManager.getTask(taskId);

    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Check dependencies
    if (!taskManager.areDependenciesMet(task)) {
      throw new Error(`Task ${taskId} dependencies not met`);
    }

    // Transition to ready
    taskManager.transitionTask(taskId, 'ready');

    // Transition to running
    taskManager.transitionTask(taskId, 'running');

    const startTime = Date.now();

    try {
      // Execute task
      const result = await this.executor.execute(task, context);
      const duration = Date.now() - startTime;

      // Set result
      taskManager.setTaskResult(taskId, {
        success: true,
        data: result.data,
        output: result.output,
        duration,
        evidence: result.evidence
      });

      // Add evidence to context
      if (result.evidence) {
        context.addEvidence(result.evidence);
      }

      // Transition to completed
      taskManager.transitionTask(taskId, 'completed');
    } catch (error) {
      // Set error
      taskManager.setTaskError(taskId, {
        code: 'TASK_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        retryable: true
      });

      // Check if can retry
      if (taskManager.canRetry(taskId)) {
        taskManager.incrementRetry(taskId);
        taskManager.transitionTask(taskId, 'retrying');
        taskManager.transitionTask(taskId, 'pending');

        // Re-add to task manager
        taskManager.transitionTask(taskId, 'ready');
        taskManager.transitionTask(taskId, 'running');

        // Retry
        return this.executeTask(missionId, taskId, context);
      }

      // Transition to failed
      taskManager.transitionTask(taskId, 'failed');

      // Fail mission
      throw error;
    }
  }

  /**
   * Get config
   */
  getConfig(): MissionConfig {
    return { ...this.config };
  }
}

// ---------------------------------------------------------------------------
// Mission Factory
// ---------------------------------------------------------------------------
export function createMissionManager(): MissionManager {
  return new MissionManager();
}

export function createMissionRunner(
  missionManager: MissionManager,
  executor: TaskExecutor,
  config?: Partial<MissionConfig>
): MissionRunner {
  return new MissionRunner(missionManager, executor, config);
}

// ---------------------------------------------------------------------------
// Mission Validator
// ---------------------------------------------------------------------------
export function validateMission(mission: unknown): mission is Mission {
  if (typeof mission !== 'object' || mission === null) {
    return false;
  }

  const m = mission as Record<string, unknown>;

  return (
    typeof m.id === 'string' &&
    typeof m.goal === 'string' &&
    typeof m.state === 'string' &&
    typeof m.revision === 'number' &&
    Array.isArray(m.tasks) &&
    typeof m.retryCount === 'number' &&
    typeof m.maxRetries === 'number' &&
    m.createdAt instanceof Date &&
    m.updatedAt instanceof Date
  );
}
