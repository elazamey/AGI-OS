import { describe, it, expect } from 'vitest';
import { PromptEngine } from '../src/PromptEngine.js';
import type { BrainContext } from '../src/types.js';

describe('PromptEngine', () => {
  const engine = new PromptEngine();

  it('should build system prompt with skills', () => {
    const skills = [
      { contract: { id: 'fs.read', description: 'Read files' } },
      { contract: { id: 'fs.write', description: 'Write files' } },
    ] as any[];

    const prompt = engine.buildSystemPrompt(skills);
    expect(prompt).toContain('fs.read');
    expect(prompt).toContain('fs.write');
    expect(prompt).toContain('JSON');
  });

  it('should build task prompt', () => {
    const context: BrainContext = {
      missionId: 'm1',
      taskId: 't1',
      goal: 'Read file',
      taskDescription: 'Read /tmp/test.txt',
      history: [],
      observations: [],
      workingMemory: {},
    };

    const prompt = engine.buildTaskPrompt(context);
    expect(prompt).toContain('Read /tmp/test.txt');
    expect(prompt).toContain('Read file');
  });

  it('should parse valid JSON response', () => {
    const response = JSON.stringify({
      action: 'execute_skill',
      skillId: 'fs.read',
      input: { path: '/tmp/test.txt' },
      reasoning: 'Need to read the file',
      confidence: 0.9,
    });

    const decision = engine.parseLLMResponse(response);
    expect(decision.action).toBe('execute_skill');
    expect(decision.skillId).toBe('fs.read');
    expect(decision.confidence).toBe(0.9);
  });

  it('should handle invalid JSON gracefully', () => {
    const decision = engine.parseLLMResponse('not json at all');
    expect(decision.action).toBe('fail');
  });
});
