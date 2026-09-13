import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMemoryStore,
  createEpisodicMemory,
  createSemanticMemory,
  createProceduralMemory,
  createMetaMemory,
} from '../src/index.js';

// ===========================================================================
// Episodic Memory
// ===========================================================================
describe('Episodic Memory', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let memory: ReturnType<typeof createEpisodicMemory>;

  beforeEach(async () => {
    store = createMemoryStore();
    memory = createEpisodicMemory(store);
  });

  it('should record a successful episode', async () => {
    const record = await memory.recordEpisode({
      missionId: 'm1',
      missionGoal: 'Read file',
      outcome: 'success',
      duration: 1000,
      taskSummaries: [
        { taskId: 't1', name: 'Read', outcome: 'success', duration: 500 },
      ],
      keyEvents: [
        { type: 'started', timestamp: new Date().toISOString(), description: 'Started' },
      ],
      lessonsLearned: ['Use faster read'],
    });

    expect(record.type).toBe('episodic');
    expect(record.confidence).toBeGreaterThan(0.5);

    const content = record.content as any;
    expect(content.outcome).toBe('success');
    expect(content.taskSummaries).toHaveLength(1);
    expect(content.lessonsLearned).toEqual(['Use faster read']);
  });

  it('should record a failure episode', async () => {
    const record = await memory.recordEpisode({
      missionId: 'm2',
      missionGoal: 'Write file',
      outcome: 'failure',
      duration: 500,
      taskSummaries: [],
      keyEvents: [],
    });

    expect(record.confidence).toBeLessThan(0.5);
  });

  it('should get episode by mission ID', async () => {
    await memory.recordEpisode({
      missionId: 'm-find',
      missionGoal: 'Find me',
      outcome: 'success',
      duration: 100,
      taskSummaries: [],
      keyEvents: [],
    });

    const found = await memory.getByMissionId('m-find');
    expect(found).not.toBeNull();
    expect((found!.content as any).missionId).toBe('m-find');
  });

  it('should get episodes by outcome', async () => {
    await memory.recordEpisode({ missionId: 'm-s', missionGoal: 'a', outcome: 'success', duration: 10, taskSummaries: [], keyEvents: [] });
    await memory.recordEpisode({ missionId: 'm-f', missionGoal: 'b', outcome: 'failure', duration: 10, taskSummaries: [], keyEvents: [] });

    const failures = await memory.getByOutcome('failure');
    expect(failures).toHaveLength(1);
  });

  it('should get all lessons', async () => {
    await memory.recordEpisode({ missionId: 'm1', missionGoal: 'a', outcome: 'success', duration: 10, taskSummaries: [], keyEvents: [], lessonsLearned: ['Lesson A'] });
    await memory.recordEpisode({ missionId: 'm2', missionGoal: 'b', outcome: 'success', duration: 10, taskSummaries: [], keyEvents: [], lessonsLearned: ['Lesson B', 'Lesson A'] });

    const lessons = await memory.getAllLessons();
    expect(lessons).toContain('Lesson A');
    expect(lessons).toContain('Lesson B');
    expect(lessons.length).toBe(2); // deduplicated
  });

  it('should calculate success rate', async () => {
    await memory.recordEpisode({ missionId: 'm1', missionGoal: 'a', outcome: 'success', duration: 10, taskSummaries: [], keyEvents: [] });
    await memory.recordEpisode({ missionId: 'm2', missionGoal: 'b', outcome: 'success', duration: 10, taskSummaries: [], keyEvents: [] });
    await memory.recordEpisode({ missionId: 'm3', missionGoal: 'c', outcome: 'failure', duration: 10, taskSummaries: [], keyEvents: [] });

    const rate = await memory.getSuccessRate();
    expect(rate).toBeCloseTo(2 / 3, 1);
  });
});

// ===========================================================================
// Semantic Memory
// ===========================================================================
describe('Semantic Memory', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let memory: ReturnType<typeof createSemanticMemory>;

  beforeEach(async () => {
    store = createMemoryStore();
    memory = createSemanticMemory(store);
  });

  it('should store a fact', async () => {
    const record = await memory.storeFact({
      subject: 'TypeScript',
      predicate: 'is',
      object: 'a language',
      source: 'observation',
    });

    expect(record.type).toBe('semantic');
    const content = record.content as any;
    expect(content.subject).toBe('TypeScript');
    expect(content.predicate).toBe('is');
    expect(content.object).toBe('a language');
  });

  it('should reinforce existing fact', async () => {
    await memory.storeFact({ subject: 'A', predicate: 'is', object: 'B', source: 's1' });
    const reinforced = await memory.storeFact({ subject: 'A', predicate: 'is', object: 'B', source: 's2' });

    const content = reinforced.content as any;
    expect(content.strength).toBeGreaterThan(0.7); // reinforced
  });

  it('should query by subject', async () => {
    await memory.storeFact({ subject: 'X', predicate: 'has', object: 'Y', source: 's' });
    await memory.storeFact({ subject: 'X', predicate: 'is', object: 'Z', source: 's' });
    await memory.storeFact({ subject: 'W', predicate: 'has', object: 'V', source: 's' });

    const results = await memory.queryBySubject('X');
    expect(results).toHaveLength(2);
  });

  it('should search by text', async () => {
    await memory.storeFact({ subject: 'File system', predicate: 'stores', object: 'files', source: 's' });
    await memory.storeFact({ subject: 'Network', predicate: 'sends', object: 'packets', source: 's' });

    const results = await memory.search('file');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should decay weak facts', async () => {
    await memory.storeFact({ subject: 'A', predicate: 'is', object: 'B', source: 's', strength: 0.2 });
    await memory.decay(0.5);

    const all = await memory.getAllFacts();
    // Very weak fact may be removed
    expect(all.length).toBeLessThanOrEqual(1);
  });
});

// ===========================================================================
// Procedural Memory
// ===========================================================================
describe('Procedural Memory', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let memory: ReturnType<typeof createProceduralMemory>;

  beforeEach(async () => {
    store = createMemoryStore();
    memory = createProceduralMemory(store);
  });

  it('should store a procedure', async () => {
    const record = await memory.storeProcedure({
      skill: 'read-file',
      description: 'Read a file from disk',
      steps: [
        { order: 1, action: 'Validate path', toolId: 'filesystem.read' },
        { order: 2, action: 'Execute read' },
      ],
    });

    expect(record.type).toBe('procedural');
    const content = record.content as any;
    expect(content.skill).toBe('read-file');
    expect(content.steps).toHaveLength(2);
    expect(content.successCount).toBe(1);
  });

  it('should reinforce existing procedure', async () => {
    await memory.storeProcedure({ skill: 'write', description: 'Write file', steps: [] });
    const reinforced = await memory.storeProcedure({ skill: 'write', description: 'Write file', steps: [] });

    const content = reinforced.content as any;
    expect(content.successCount).toBe(2);
  });

  it('should record success', async () => {
    await memory.storeProcedure({ skill: 'test', description: 'Test', steps: [] });
    await memory.recordSuccess('test', 100);

    const content = (await memory.findBySkill('test'))!.content as any;
    expect(content.successCount).toBe(2);
  });

  it('should record failure', async () => {
    await memory.storeProcedure({ skill: 'test', description: 'Test', steps: [] });
    await memory.recordFailure('test');

    const content = (await memory.findBySkill('test'))!.content as any;
    expect(content.failureCount).toBe(1);
  });

  it('should calculate success rate', async () => {
    await memory.storeProcedure({ skill: 'test', description: 'Test', steps: [] });
    await memory.recordSuccess('test', 100);
    await memory.recordFailure('test');

    const rate = await memory.getSuccessRate('test');
    expect(rate).toBeCloseTo(2 / 3, 1);
  });

  it('should find by skill', async () => {
    await memory.storeProcedure({ skill: 'deploy', description: 'Deploy app', steps: [] });
    const found = await memory.findBySkill('deploy');
    expect(found).not.toBeNull();
    expect((found!.content as any).skill).toBe('deploy');
  });
});

// ===========================================================================
// Meta Memory
// ===========================================================================
describe('Meta Memory', () => {
  let store: ReturnType<typeof createMemoryStore>;
  let memory: ReturnType<typeof createMetaMemory>;

  beforeEach(async () => {
    store = createMemoryStore();
    memory = createMetaMemory(store);
  });

  it('should record confidence assessment', async () => {
    const record = await memory.recordConfidence({
      subject: 'filesystem.read',
      metric: 'accuracy',
      value: 0.95,
      sampleSize: 100,
    });

    expect(record.type).toBe('meta');
    const content = record.content as any;
    expect(content.value).toBe(0.95);
    expect(content.sampleSize).toBe(100);
  });

  it('should update existing assessment', async () => {
    await memory.recordConfidence({ subject: 'A', metric: 'B', value: 0.8, sampleSize: 50 });
    const updated = await memory.recordConfidence({ subject: 'A', metric: 'B', value: 0.9, sampleSize: 50 });

    const content = updated.content as any;
    expect(content.sampleSize).toBe(100);
    expect(content.value).toBeCloseTo(0.85, 1);
  });

  it('should record reliability', async () => {
    await memory.recordReliability({
      toolId: 'filesystem.read',
      successRate: 0.98,
      sampleSize: 200,
    });

    const reliability = await memory.getReliability('filesystem.read');
    expect(reliability).not.toBeNull();
    expect(reliability).toBeCloseTo(0.98, 1);
  });

  it('should record failure pattern', async () => {
    await memory.recordFailurePattern({
      subject: 'git.commit',
      pattern: 'timeout',
      frequency: 3,
    });

    const patterns = await memory.getFailurePatterns('git.commit');
    expect(patterns).toHaveLength(1);
  });

  it('should get declining assessments', async () => {
    await memory.recordConfidence({ subject: 'A', metric: 'B', value: 0.9, sampleSize: 10 });
    await memory.recordConfidence({ subject: 'A', metric: 'B', value: 0.5, sampleSize: 10 });

    const declining = await memory.getDeclining();
    expect(declining.length).toBeGreaterThanOrEqual(1);
  });
});
