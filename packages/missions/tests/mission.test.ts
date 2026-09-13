import { describe, it, expect, beforeEach } from 'vitest';
import {
  MissionManager,
  MissionRunner,
  createMissionManager,
  createMissionRunner,
  validateMission
} from '../src/mission.js';
import type { Task, TaskExecutor, TaskResult } from '../src/types.js';

// ---------------------------------------------------------------------------
// Mock Task Executor
// ---------------------------------------------------------------------------
class MockTaskExecutor implements TaskExecutor {
  private shouldFail = false;
  private executionOrder: string[] = [];

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  getExecutionOrder(): string[] {
    return [...this.executionOrder];
  }

  async execute(task: Task): Promise<TaskResult> {
    this.executionOrder.push(task.id);

    if (this.shouldFail) {
      throw new Error(`Task ${task.id} failed`);
    }

    return {
      success: true,
      data: { output: `Completed ${task.name}` },
      output: `Output for ${task.name}`,
      duration: 100
    };
  }
}

// ---------------------------------------------------------------------------
// Mission Manager Tests
// ---------------------------------------------------------------------------
describe('MissionManager', () => {
  let manager: MissionManager;

  beforeEach(() => {
    manager = new MissionManager();
  });

  describe('createMission', () => {
    it('should create mission with goal', () => {
      const mission = manager.createMission('Test Goal');

      expect(mission).toBeDefined();
      expect(mission.id).toBeDefined();
      expect(mission.goal).toBe('Test Goal');
      expect(mission.state).toBe('created');
      expect(mission.revision).toBe(0);
      expect(mission.tasks).toEqual([]);
      expect(mission.retryCount).toBe(0);
      expect(mission.maxRetries).toBe(3);
      expect(mission.createdAt).toBeInstanceOf(Date);
    });

    it('should create mission with options', () => {
      const mission = manager.createMission('Test Goal', {
        description: 'Description',
        maxRetries: 5,
        timeout: 60000,
        metadata: { key: 'value' }
      });

      expect(mission.description).toBe('Description');
      expect(mission.maxRetries).toBe(5);
      expect(mission.timeout).toBe(60000);
      expect(mission.metadata).toEqual({ key: 'value' });
    });
  });

  describe('getMission', () => {
    it('should get mission', () => {
      const created = manager.createMission('Test Goal');
      const retrieved = manager.getMission(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
    });

    it('should return undefined for non-existent mission', () => {
      const retrieved = manager.getMission('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getAllMissions', () => {
    it('should get all missions', () => {
      manager.createMission('Goal 1');
      manager.createMission('Goal 2');

      const missions = manager.getAllMissions();
      expect(missions).toHaveLength(2);
    });
  });

  describe('getMissionsByState', () => {
    it('should get missions by state', () => {
      const mission1 = manager.createMission('Goal 1');
      manager.createMission('Goal 2');

      manager.transitionMission(mission1.id, 'planning');

      const created = manager.getMissionsByState('created');
      expect(created).toHaveLength(1);

      const planning = manager.getMissionsByState('planning');
      expect(planning).toHaveLength(1);
    });
  });

  describe('addTask', () => {
    it('should add task to mission', () => {
      const mission = manager.createMission('Test Goal');
      const task = manager.addTask(mission.id, 'Test Task');

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.missionId).toBe(mission.id);
      expect(task.name).toBe('Test Task');

      const updatedMission = manager.getMission(mission.id);
      expect(updatedMission!.tasks).toHaveLength(1);
    });

    it('should add task with options', () => {
      const mission = manager.createMission('Test Goal');
      const task = manager.addTask(mission.id, 'Test Task', {
        description: 'Description',
        priority: 'high',
        dependencies: ['dep-1'],
        maxRetries: 5,
        timeout: 60000,
        metadata: { key: 'value' }
      });

      expect(task.description).toBe('Description');
      expect(task.priority).toBe('high');
      expect(task.dependencies).toEqual(['dep-1']);
      expect(task.maxRetries).toBe(5);
      expect(task.timeout).toBe(60000);
      expect(task.metadata).toEqual({ key: 'value' });
    });

    it('should throw for non-existent mission', () => {
      expect(() => manager.addTask('non-existent', 'Task')).toThrow();
    });

    it('should increment revision', () => {
      const mission = manager.createMission('Test Goal');
      expect(mission.revision).toBe(0);

      manager.addTask(mission.id, 'Task 1');
      const updated = manager.getMission(mission.id);
      expect(updated!.revision).toBe(1);
    });
  });

  describe('transitionMission', () => {
    it('should transition mission', () => {
      const mission = manager.createMission('Test Goal');
      manager.transitionMission(mission.id, 'planning');

      const updated = manager.getMission(mission.id);
      expect(updated!.state).toBe('planning');
      expect(updated!.revision).toBe(1);
    });

    it('should reject invalid transition', () => {
      const mission = manager.createMission('Test Goal');
      expect(() => manager.transitionMission(mission.id, 'completed')).toThrow();
    });

    it('should try transition', () => {
      const mission = manager.createMission('Test Goal');
      expect(manager.tryTransitionMission(mission.id, 'planning')).toBe(true);
      expect(manager.tryTransitionMission(mission.id, 'completed')).toBe(false);
    });

    it('should set startedAt when running', () => {
      const mission = manager.createMission('Test Goal');
      manager.transitionMission(mission.id, 'planning');
      manager.transitionMission(mission.id, 'ready');
      manager.transitionMission(mission.id, 'running');

      const updated = manager.getMission(mission.id);
      expect(updated!.startedAt).toBeDefined();
    });

    it('should set completedAt when completed', () => {
      const mission = manager.createMission('Test Goal');
      manager.transitionMission(mission.id, 'planning');
      manager.transitionMission(mission.id, 'ready');
      manager.transitionMission(mission.id, 'running');
      manager.transitionMission(mission.id, 'verifying');
      manager.transitionMission(mission.id, 'completed');

      const updated = manager.getMission(mission.id);
      expect(updated!.completedAt).toBeDefined();
    });
  });

  describe('startMission', () => {
    it('should start mission', () => {
      const mission = manager.createMission('Test Goal');
      manager.addTask(mission.id, 'Task 1');

      manager.startMission(mission.id);

      const updated = manager.getMission(mission.id);
      expect(updated!.state).toBe('running');
    });

    it('should throw if no tasks', () => {
      const mission = manager.createMission('Test Goal');
      expect(() => manager.startMission(mission.id)).toThrow('no tasks');
    });

    it('should throw if invalid dependencies', () => {
      const mission = manager.createMission('Test Goal');
      manager.addTask(mission.id, 'Task 1', { dependencies: ['non-existent'] });

      expect(() => manager.startMission(mission.id)).toThrow();
    });
  });

  describe('completeMission', () => {
    it('should complete mission', () => {
      const mission = manager.createMission('Test Goal');
      manager.addTask(mission.id, 'Task 1');

      manager.startMission(mission.id);

      // Complete all tasks
      const taskManager = manager.getTaskManager(mission.id)!;
      const tasks = taskManager.getAllTasks();
      taskManager.transitionTask(tasks[0].id, 'ready');
      taskManager.transitionTask(tasks[0].id, 'running');
      taskManager.transitionTask(tasks[0].id, 'completed');

      manager.completeMission(mission.id);

      const updated = manager.getMission(mission.id);
      expect(updated!.state).toBe('completed');
    });

    it('should throw if tasks incomplete', () => {
      const mission = manager.createMission('Test Goal');
      manager.addTask(mission.id, 'Task 1');

      manager.startMission(mission.id);

      expect(() => manager.completeMission(mission.id)).toThrow('incomplete tasks');
    });
  });

  describe('cancelMission', () => {
    it('should cancel mission', () => {
      const mission = manager.createMission('Test Goal');
      manager.addTask(mission.id, 'Task 1');

      manager.cancelMission(mission.id);

      const updated = manager.getMission(mission.id);
      expect(updated!.state).toBe('cancelled');
      expect(updated!.cancelledAt).toBeDefined();
    });
  });

  describe('retryMission', () => {
    it('should retry mission', () => {
      const mission = manager.createMission('Test Goal', { maxRetries: 3 });
      manager.addTask(mission.id, 'Task 1');

      manager.startMission(mission.id);
      manager.failMission(mission.id);

      manager.retryMission(mission.id);

      const updated = manager.getMission(mission.id);
      expect(updated!.state).toBe('created');
      expect(updated!.retryCount).toBe(1);
    });

    it('should throw if max retries reached', () => {
      const mission = manager.createMission('Test Goal', { maxRetries: 1 });
      manager.addTask(mission.id, 'Task 1');

      manager.startMission(mission.id);
      manager.failMission(mission.id);

      manager.retryMission(mission.id);
      manager.startMission(mission.id);
      manager.failMission(mission.id);

      expect(() => manager.retryMission(mission.id)).toThrow('max retries');
    });
  });

  describe('getMissionEvents', () => {
    it('should get mission events', () => {
      const mission = manager.createMission('Test Goal');
      manager.addTask(mission.id, 'Task 1');

      const events = manager.getMissionEvents(mission.id);
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('removeMission', () => {
    it('should remove mission', () => {
      const mission = manager.createMission('Test Goal');
      expect(manager.removeMission(mission.id)).toBe(true);
      expect(manager.getMission(mission.id)).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all missions', () => {
      manager.createMission('Goal 1');
      manager.createMission('Goal 2');

      manager.clear();
      expect(manager.getAllMissions()).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Mission Runner Tests
// ---------------------------------------------------------------------------
describe('MissionRunner', () => {
  let manager: MissionManager;
  let executor: MockTaskExecutor;
  let runner: MissionRunner;

  beforeEach(() => {
    manager = createMissionManager();
    executor = new MockTaskExecutor();
    runner = createMissionRunner(manager, executor);
  });

  describe('execute', () => {
    it('should execute simple mission', async () => {
      const mission = manager.createMission('Test Goal');
      manager.addTask(mission.id, 'Task 1');

      const result = await runner.execute(mission.id);

      expect(result.state).toBe('completed');
      expect(result.completedAt).toBeDefined();
    });

    it('should execute mission with dependencies', async () => {
      const mission = manager.createMission('Test Goal');
      const task1 = manager.addTask(mission.id, 'Task 1');
      manager.addTask(mission.id, 'Task 2', { dependencies: [task1.id] });

      const result = await runner.execute(mission.id);

      expect(result.state).toBe('completed');
      expect(executor.getExecutionOrder()).toEqual([task1.id, expect.any(String)]);
    });

    it('should handle task failure', async () => {
      executor.setShouldFail(true);

      const mission = manager.createMission('Test Goal');
      manager.addTask(mission.id, 'Task 1');

      const result = await runner.execute(mission.id);

      expect(result.state).toBe('failed');
      expect(result.error).toBeDefined();
    });

    it('should throw for non-existent mission', async () => {
      await expect(runner.execute('non-existent')).rejects.toThrow('not found');
    });
  });

  describe('getConfig', () => {
    it('should get default config', () => {
      const config = runner.getConfig();
      expect(config.maxRetries).toBe(3);
      expect(config.timeout).toBe(300000);
    });

    it('should get custom config', () => {
      const customRunner = createMissionRunner(manager, executor, {
        maxRetries: 5,
        timeout: 60000
      });

      const config = customRunner.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.timeout).toBe(60000);
    });
  });
});

// ---------------------------------------------------------------------------
// Mission Validator Tests
// ---------------------------------------------------------------------------
describe('validateMission', () => {
  it('should validate correct mission', () => {
    const manager = createMissionManager();
    const mission = manager.createMission('Test Goal');
    expect(validateMission(mission)).toBe(true);
  });

  it('should reject invalid mission', () => {
    expect(validateMission(null)).toBe(false);
    expect(validateMission({})).toBe(false);
    expect(validateMission({ id: '123' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Factory Tests
// ---------------------------------------------------------------------------
describe('Factories', () => {
  it('createMissionManager', () => {
    const manager = createMissionManager();
    expect(manager).toBeInstanceOf(MissionManager);
  });

  it('createMissionRunner', () => {
    const manager = createMissionManager();
    const executor: TaskExecutor = {
      execute: async () => ({ success: true, duration: 0 })
    };
    const runner = createMissionRunner(manager, executor);
    expect(runner).toBeInstanceOf(MissionRunner);
  });
});
