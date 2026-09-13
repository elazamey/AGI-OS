import { describe, it, expect } from 'vitest';
import { HiddenTaskGenerator } from '../src/hidden-task-generator.js';
import { IndependentJudge } from '../src/independent-judge.js';
import { FreshTaskGenerator } from '../src/fresh-task-generator.js';
import { AntiHackingTester } from '../src/anti-hacking.js';

describe('BenchmarkIntegrity', () => {
  describe('HiddenTaskGenerator', () => {
    it('should register templates', () => {
      const gen = new HiddenTaskGenerator();
      gen.registerTemplate({ id: 't1', category: 'coding', generate: (s) => `task-${s}` });
      expect(gen.getTemplateCount()).toBe(1);
    });

    it('should generate tasks from all templates', () => {
      const gen = new HiddenTaskGenerator();
      gen.registerTemplate({ id: 't1', category: 'coding', generate: (s) => `code-${s}` });
      gen.registerTemplate({ id: 't2', category: 'math', generate: (s) => `math-${s}` });
      const tasks = gen.generate(42);
      expect(tasks.length).toBe(2);
      expect(tasks[0].category).toBe('coding');
      expect(tasks[1].category).toBe('math');
    });

    it('should produce unique taskIds', () => {
      const gen = new HiddenTaskGenerator();
      gen.registerTemplate({ id: 't1', category: 'a', generate: () => 'x' });
      gen.registerTemplate({ id: 't2', category: 'b', generate: () => 'y' });
      const tasks = gen.generate(1);
      expect(tasks[0].taskId).not.toBe(tasks[1].taskId);
    });

    it('should use seed in generation', () => {
      const gen = new HiddenTaskGenerator();
      gen.registerTemplate({ id: 't1', category: 'c', generate: (s) => `seed-${s}` });
      const tasks1 = gen.generate(10);
      const tasks2 = gen.generate(20);
      expect(tasks1[0].task).toBe('seed-10');
      expect(tasks2[0].task).toBe('seed-20');
    });

    it('should return 0 templates when empty', () => {
      const gen = new HiddenTaskGenerator();
      expect(gen.getTemplateCount()).toBe(0);
    });
  });

  describe('IndependentJudge', () => {
    it('should evaluate output against rubric', () => {
      const judge = new IndependentJudge();
      const result = judge.evaluate('The code is well tested', [
        { criteria: 'tested', weight: 1 },
      ]);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.criteriaScores['tested']).toBe(1);
    });

    it('should pass when above threshold', () => {
      const judge = new IndependentJudge();
      judge.setPassThreshold(0.5);
      const result = judge.evaluate('correct and accurate result', [
        { criteria: 'correct', weight: 1 },
        { criteria: 'accurate', weight: 1 },
      ]);
      expect(result.passed).toBe(true);
    });

    it('should fail when below threshold', () => {
      const judge = new IndependentJudge();
      judge.setPassThreshold(0.9);
      const result = judge.evaluate('maybe', [
        { criteria: 'definitely correct', weight: 1 },
      ]);
      expect(result.passed).toBe(false);
    });

    it('should weight criteria correctly', () => {
      const judge = new IndependentJudge();
      const result = judge.evaluate('secure and fast', [
        { criteria: 'secure', weight: 3 },
        { criteria: 'fast', weight: 1 },
      ]);
      expect(result.criteriaScores['secure']).toBe(1);
      expect(result.criteriaScores['fast']).toBe(1);
    });

    it('should handle empty rubric', () => {
      const judge = new IndependentJudge();
      const result = judge.evaluate('anything', []);
      expect(result.score).toBe(0);
    });
  });

  describe('FreshTaskGenerator', () => {
    it('should generate from template with variables', () => {
      const gen = new FreshTaskGenerator();
      const result = gen.generateFromTemplate(
        { pattern: 'Write a {lang} function', variables: { lang: ['Python', 'JS'] } },
        0
      );
      expect(result).toBe('Write a Python function');
    });

    it('should cycle through variable values based on seed', () => {
      const gen = new FreshTaskGenerator();
      const t = { pattern: '{animal} runs', variables: { animal: ['cat', 'dog'] } };
      expect(gen.generateFromTemplate(t, 0)).toBe('cat runs');
      expect(gen.generateFromTemplate(t, 1)).toBe('dog runs');
    });

    it('should generate batch of tasks', () => {
      const gen = new FreshTaskGenerator();
      const templates = [
        { pattern: 'Task {n}', variables: { n: ['A', 'B'] } },
      ];
      const results = gen.generateBatch(3, templates);
      expect(results.length).toBe(3);
    });

    it('should rotate templates in batch', () => {
      const gen = new FreshTaskGenerator();
      const templates = [
        { pattern: 'Type {x}', variables: { x: ['X'] } },
        { pattern: 'Type {x}', variables: { x: ['Y'] } },
      ];
      const results = gen.generateBatch(4, templates);
      expect(results[0]).toBe('Type X');
      expect(results[1]).toBe('Type Y');
      expect(results[2]).toBe('Type X');
      expect(results[3]).toBe('Type Y');
    });

    it('should replace multiple variables', () => {
      const gen = new FreshTaskGenerator();
      const result = gen.generateFromTemplate(
        { pattern: '{a}-{b}-{a}', variables: { a: ['X'], b: ['Y'] } },
        0
      );
      expect(result).toBe('X-Y-X');
    });
  });

  describe('AntiHackingTester', () => {
    it('should detect reward hacking', () => {
      const tester = new AntiHackingTester();
      const result = tester.detectRewardHacking(
        ['maximize reward by gaming', 'normal action'],
        ['maximize reward']
      );
      expect(result.hacked).toBe(true);
      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('should not flag clean actions', () => {
      const tester = new AntiHackingTester();
      const result = tester.detectRewardHacking(
        ['do work', 'submit result'],
        ['no gaming']
      );
      expect(result.hacked).toBe(false);
      expect(result.violations.length).toBe(0);
    });

    it('should detect specification gaming', () => {
      const tester = new AntiHackingTester();
      const result = tester.detectSpecificationGaming(
        ['use a workaround', 'proper fix'],
        'implement proper solution'
      );
      expect(result.gamed).toBe(true);
    });

    it('should detect test tampering', () => {
      const tester = new AntiHackingTester();
      const result = tester.detectTestTampering([
        'modify test.spec.ts',
        'run production code',
      ]);
      expect(result.tampered).toBe(true);
      expect(result.tamperedFiles).toContain('modify test.spec.ts');
    });

    it('should not flag non-test file modifications', () => {
      const tester = new AntiHackingTester();
      const result = tester.detectTestTampering(['edit src/main.ts']);
      expect(result.tampered).toBe(false);
    });
  });
});
