import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import { MissionManager, MissionRunner } from '@agi-os/missions';
import type { TaskExecutor, Task, MissionContext, TaskResult } from '@agi-os/missions';
import { GovernanceGateway } from '@agi-os/governance';
import { SkillExecutor, SkillRunner, InputValidator, OutputValidator, ExecutionPolicy } from '@agi-os/skill-executor';
import type { SkillHandler, SkillExecutionContext } from '@agi-os/skill-executor';
import { FileSystemReadSkill, FILESYSTEM_READ_CONTRACT } from '@agi-os/real-skills';
import type { SkillContract } from '@agi-os/skills';

/**
 * DirectTaskExecutor — Executes skills directly from task metadata without LLM.
 * Proves SkillExecutor + Governance + Evidence pipeline works end-to-end.
 */
class DirectTaskExecutor implements TaskExecutor {
  constructor(
    private skillExecutor: SkillExecutor,
    private governance: GovernanceGateway,
  ) {}

  async execute(task: Task, context: MissionContext): Promise<TaskResult> {
    const skillId = task.metadata.skillId as string;
    const input = (task.metadata.input as Record<string, unknown>) ?? {};

    const skillContext: SkillExecutionContext = {
      missionId: context.missionId,
      taskId: task.id,
      workingDir: process.cwd(),
      timeout: 30000,
      governance: this.governance,
    };

    const result = await this.skillExecutor.execute(
      { missionId: context.missionId, taskId: task.id, skillId, input, requestedBy: 'direct' },
      skillContext,
    );

    return {
      success: result.success,
      data: result.output,
      output: result.success ? JSON.stringify(result.output) : undefined,
      duration: result.duration,
      evidence: result.evidence,
    };
  }

  canExecute(task: Task): boolean {
    return task.metadata.skillId !== undefined;
  }
}

describe('MISSION-001: Read File → Evidence → Complete', () => {
  const testDir = '.agi-os-test/mission-001';
  const testFile = `${testDir}/input.txt`;
  const testContent = 'AGI-OS is a zero-cost agent operating system. It provides governance, evidence, and recovery.';

  beforeAll(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(testFile, testContent, 'utf-8');
  });

  afterAll(async () => {
    await fs.rm('.agi-os-test', { recursive: true, force: true });
  });

  it('should complete mission with real file read', async () => {
    const governance = new GovernanceGateway();
    const handlers = new Map<string, SkillHandler>();
    const contracts = new Map<string, SkillContract>();
    handlers.set('filesystem.read', new FileSystemReadSkill());
    contracts.set('filesystem.read', FILESYSTEM_READ_CONTRACT);

    const skillRunner = new SkillRunner({
      handlers, contracts,
      inputValidator: new InputValidator(),
      outputValidator: new OutputValidator(),
      executionPolicy: new ExecutionPolicy(),
    });
    const skillExecutor = new SkillExecutor(skillRunner);
    const taskExecutor = new DirectTaskExecutor(skillExecutor, governance);

    const missionManager = new MissionManager();
    const mission = missionManager.createMission('Read file and produce evidence');
    missionManager.addTask(mission.id, 'read-file', {
      description: `Read the file ${testFile}`,
      metadata: { skillId: 'filesystem.read', input: { path: testFile } },
    });

    const runner = new MissionRunner(missionManager, taskExecutor);
    const completed = await runner.execute(mission.id);

    // Mission state transitions: created → planning → ready → running → verifying → completed
    expect(completed.state).toBe('completed');
    expect(completed.tasks.length).toBe(1);

    // Task was executed (check via TaskManager)
    const taskManager = missionManager.getTaskManager(completed.id)!;
    const tasks = taskManager.getAllTasks();
    expect(tasks[0].state).toBe('completed');
    expect(tasks[0].result).toBeDefined();
    expect(tasks[0].result?.success).toBe(true);
  });

  it('should produce real evidence with file content', async () => {
    const governance = new GovernanceGateway();
    const handlers = new Map<string, SkillHandler>();
    const contracts = new Map<string, SkillContract>();
    handlers.set('filesystem.read', new FileSystemReadSkill());
    contracts.set('filesystem.read', FILESYSTEM_READ_CONTRACT);

    const skillRunner = new SkillRunner({
      handlers, contracts,
      inputValidator: new InputValidator(),
      outputValidator: new OutputValidator(),
      executionPolicy: new ExecutionPolicy(),
    });
    const skillExecutor = new SkillExecutor(skillRunner);
    const taskExecutor = new DirectTaskExecutor(skillExecutor, governance);

    const missionManager = new MissionManager();
    const mission = missionManager.createMission('Read file content');
    missionManager.addTask(mission.id, 'read-file', {
      description: `Read ${testFile}`,
      metadata: { skillId: 'filesystem.read', input: { path: testFile } },
    });

    const runner = new MissionRunner(missionManager, taskExecutor);
    await runner.execute(mission.id);

    // Get task result via TaskManager (mission.tasks has stale copies)
    const taskManager = missionManager.getTaskManager(mission.id)!;
    const tasks = taskManager.getAllTasks();
    const task = tasks[0];

    expect(task.result).toBeDefined();
    expect(task.result?.success).toBe(true);
    expect(task.result?.data).toBeDefined();

    // Verify real file content
    const data = task.result?.data as any;
    expect(data.content).toBe(testContent);
    expect(data.size).toBeGreaterThan(0);
    expect(data.lastModified).toBeDefined();

    // Verify evidence
    expect(task.result?.evidence).toBeDefined();
    const evidence = task.result?.evidence!;
    expect(evidence.operation).toContain('filesystem.read');
    expect(evidence.exitCode).toBe(0);
    expect(evidence.stdoutHash).toBeDefined();
    expect(evidence.metadata).toBeDefined();
    expect((evidence.metadata as any).success).toBe(true);
  });

  it('should write file and read it back', async () => {
    const governance = new GovernanceGateway();
    const handlers = new Map<string, SkillHandler>();
    const contracts = new Map<string, SkillContract>();

    const { FileSystemWriteSkill, FILESYSTEM_WRITE_CONTRACT } = await import('@agi-os/real-skills');
    handlers.set('filesystem.read', new FileSystemReadSkill());
    handlers.set('filesystem.write', new FileSystemWriteSkill());
    contracts.set('filesystem.read', FILESYSTEM_READ_CONTRACT);
    contracts.set('filesystem.write', FILESYSTEM_WRITE_CONTRACT);

    const skillRunner = new SkillRunner({
      handlers, contracts,
      inputValidator: new InputValidator(),
      outputValidator: new OutputValidator(),
      executionPolicy: new ExecutionPolicy(),
    });
    const skillExecutor = new SkillExecutor(skillRunner);

    const missionManager = new MissionManager();
    const mission = missionManager.createMission('Write then read file');
    const writeTarget = `${testDir}/output.txt`;
    const writeContent = 'Written by AGI-OS skill executor!';

    // Task 1: Write file
    missionManager.addTask(mission.id, 'write-file', {
      description: `Write to ${writeTarget}`,
      metadata: { skillId: 'filesystem.write', input: { path: writeTarget, content: writeContent } },
    });

    // Task 2: Read file back (depends on task 1)
    const writeTaskId = mission.tasks[0].id;
    missionManager.addTask(mission.id, 'read-back', {
      description: `Read from ${writeTarget}`,
      dependencies: [writeTaskId],
      metadata: { skillId: 'filesystem.read', input: { path: writeTarget } },
    });

    const executor: TaskExecutor = {
      execute: async (task, context) => {
        const skillId = task.metadata.skillId as string;
        const input = (task.metadata.input as Record<string, unknown>) ?? {};
        const result = await skillExecutor.execute(
          { missionId: context.missionId, taskId: task.id, skillId, input, requestedBy: 'test' },
          { missionId: context.missionId, taskId: task.id, workingDir: process.cwd(), timeout: 30000, governance },
        );
        return { success: result.success, data: result.output, output: JSON.stringify(result.output), duration: result.duration, evidence: result.evidence };
      },
    };

    const runner = new MissionRunner(missionManager, executor);
    const completed = await runner.execute(mission.id);

    expect(completed.state).toBe('completed');

    const taskManager = missionManager.getTaskManager(mission.id)!;
    const allTasks = taskManager.getAllTasks();
    expect(allTasks.length).toBe(2);
    expect(allTasks.every(t => t.state === 'completed')).toBe(true);

    // Verify write produced evidence
    const writeResult = allTasks.find(t => t.name === 'write-file')?.result;
    expect(writeResult?.success).toBe(true);
    const writeData = writeResult?.data as any;
    expect(writeData.bytesWritten).toBe(Buffer.byteLength(writeContent, 'utf-8'));

    // Verify read returned correct content
    const readResult = allTasks.find(t => t.name === 'read-back')?.result;
    expect(readResult?.success).toBe(true);
    const readData = readResult?.data as any;
    expect(readData.content).toBe(writeContent);
  });
});
