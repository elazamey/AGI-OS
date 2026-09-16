import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillSynthesizer } from '../src/index.js';
import { join } from 'path';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';

describe('SkillSynthesizer — Autonomous Skill Acquisition', () => {
  let testRegistry: string;
  let synthesizer: SkillSynthesizer;

  beforeEach(() => {
    testRegistry = join(tmpdir(), `test-registry-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`);
    mkdirSync(testRegistry, { recursive: true });
    synthesizer = new SkillSynthesizer(testRegistry);
  });

  afterEach(() => {
    if (existsSync(testRegistry)) rmSync(testRegistry, { recursive: true, force: true });
  });

  it('should create synthesizer with registry path', () => {
    expect(synthesizer).toBeDefined();
    expect(synthesizer.getRegistryPath()).toBe(testRegistry);
  });

  it('should generate valid SKILL.md content', () => {
    const spec = {
      name: 'test-skill',
      description: 'A test skill',
      triggers: ['test', 'demo'],
      instructions: '1. Do something\n2. Do something else',
      testCode: '',
    };

    const md = synthesizer.generateSkillMd(spec);
    expect(md).toContain('# Name');
    expect(md).toContain('test-skill');
    expect(md).toContain('A test skill');
    expect(md).toContain('test, demo');
    expect(md).toContain('1. Do something');
  });

  it('should validate spec correctly', () => {
    const validSpec = {
      name: 'valid-skill',
      description: 'A valid skill',
      triggers: ['valid'],
      instructions: 'Do valid things',
      testCode: 'const assert = require("assert"); assert.strictEqual(1, 1);',
    };

    const result = synthesizer.validateSpec(validSpec);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should reject empty name', () => {
    const result = synthesizer.validateSpec({
      name: '',
      description: 'test',
      triggers: ['test'],
      instructions: 'test',
      testCode: 'test',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('should reject invalid name format', () => {
    const result = synthesizer.validateSpec({
      name: 'Invalid Name!',
      description: 'test',
      triggers: ['test'],
      instructions: 'test',
      testCode: 'test',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
  });

  it('should reject empty triggers', () => {
    const result = synthesizer.validateSpec({
      name: 'test-skill',
      description: 'test',
      triggers: [],
      instructions: 'test',
      testCode: 'test',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('trigger'))).toBe(true);
  });

  it('should reject empty test code', () => {
    const result = synthesizer.validateSpec({
      name: 'test-skill',
      description: 'test',
      triggers: ['test'],
      instructions: 'test',
      testCode: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Test code'))).toBe(true);
  });

  it('should synthesize, verify in sandbox, and register a valid skill', async () => {
    const spec = {
      name: 'generated-string-utils',
      description: 'Automatically synthesized string utility functions.',
      triggers: ['reverse-string', 'capitalize'],
      instructions: '1. Reverse or capitalize input text securely.',
      testCode: `
        const assert = require('assert');
        function reverse(str) { return str.split('').reverse().join(''); }
        assert.strictEqual(reverse('agi'), 'iga');
        assert.strictEqual(reverse('hello'), 'olleh');
        assert.strictEqual(reverse(''), '');
      `,
    };

    const result = await synthesizer.synthesizeAndRegister(spec);

    expect(result.success).toBe(true);
    expect(result.registered).toBe(true);
    expect(result.skill_name).toBe('generated-string-utils');
    expect(result.duration_ms).toBeGreaterThan(0);

    const skillDir = join(testRegistry, 'generated-string-utils');
    expect(existsSync(skillDir)).toBe(true);
    expect(existsSync(join(skillDir, 'SKILL.md'))).toBe(true);

    const content = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
    expect(content).toContain('generated-string-utils');
    expect(content).toContain('reverse-string');
  });

  it('should reject and clean up if skill fails sandbox test', async () => {
    const spec = {
      name: 'failing-skill',
      description: 'A skill that will fail validation.',
      triggers: ['fail'],
      instructions: '1. Fail on execution.',
      testCode: `
        const assert = require('assert');
        assert.strictEqual(1, 2);
      `,
    };

    const result = await synthesizer.synthesizeAndRegister(spec);

    expect(result.success).toBe(false);
    expect(result.registered).toBe(false);
    expect(result.error).toContain('Sandbox test failed');

    const skillDir = join(testRegistry, 'failing-skill');
    expect(existsSync(skillDir)).toBe(false);
  });

  it('should track synthesis history', async () => {
    const successSpec = {
      name: 'success-skill',
      description: 'Will succeed',
      triggers: ['ok'],
      instructions: 'Do OK',
      testCode: 'const assert = require("assert"); assert.strictEqual(1, 1);',
    };

    const failSpec = {
      name: 'fail-skill',
      description: 'Will fail',
      triggers: ['fail'],
      instructions: 'Fail',
      testCode: 'const assert = require("assert"); assert.strictEqual(1, 2);',
    };

    await synthesizer.synthesizeAndRegister(successSpec);
    await synthesizer.synthesizeAndRegister(failSpec);

    const history = synthesizer.getHistory();
    expect(history.attempts).toBe(2);
    expect(history.successes).toBe(1);
    expect(history.failures).toBe(1);
    expect(history.registered_skills).toContain('success-skill');
    expect(history.registered_skills).not.toContain('fail-skill');
  });

  it('should check if skill is registered', async () => {
    expect(synthesizer.isSkillRegistered('nonexistent')).toBe(false);

    await synthesizer.synthesizeAndRegister({
      name: 'check-skill',
      description: 'Check me',
      triggers: ['check'],
      instructions: 'Check',
      testCode: 'const assert = require("assert"); assert.ok(true);',
    });

    expect(synthesizer.isSkillRegistered('check-skill')).toBe(true);
  });

  it('should list registered skills', async () => {
    await synthesizer.synthesizeAndRegister({
      name: 'list-skill-a',
      description: 'Skill A',
      triggers: ['a'],
      instructions: 'A',
      testCode: 'const assert = require("assert"); assert.ok(true);',
    });

    await synthesizer.synthesizeAndRegister({
      name: 'list-skill-b',
      description: 'Skill B',
      triggers: ['b'],
      instructions: 'B',
      testCode: 'const assert = require("assert"); assert.ok(true);',
    });

    const skills = synthesizer.listRegisteredSkills();
    expect(skills).toContain('list-skill-a');
    expect(skills).toContain('list-skill-b');
  });

  it('should get skill content', async () => {
    await synthesizer.synthesizeAndRegister({
      name: 'content-skill',
      description: 'Content test',
      triggers: ['content'],
      instructions: 'Content instructions',
      testCode: 'const assert = require("assert"); assert.ok(true);',
    });

    const content = synthesizer.getSkillContent('content-skill');
    expect(content).toContain('content-skill');
    expect(content).toContain('Content test');
    expect(content).toContain('Content instructions');
  });

  it('should return null for non-existent skill content', () => {
    expect(synthesizer.getSkillContent('nonexistent')).toBeNull();
  });

  it('should handle multiple concurrent synthesis', async () => {
    const specs = [
      {
        name: 'concurrent-1',
        description: 'Concurrent 1',
        triggers: ['c1'],
        instructions: 'C1',
        testCode: 'const assert = require("assert"); assert.ok(true);',
      },
      {
        name: 'concurrent-2',
        description: 'Concurrent 2',
        triggers: ['c2'],
        instructions: 'C2',
        testCode: 'const assert = require("assert"); assert.ok(true);',
      },
      {
        name: 'concurrent-3',
        description: 'Concurrent 3',
        triggers: ['c3'],
        instructions: 'C3',
        testCode: 'const assert = require("assert"); assert.ok(true);',
      },
    ];

    const results = await Promise.all(specs.map(s => synthesizer.synthesizeAndRegister(s)));

    results.forEach(r => {
      expect(r.success).toBe(true);
      expect(r.registered).toBe(true);
    });

    const skills = synthesizer.listRegisteredSkills();
    expect(skills.length).toBe(3);
  });
});
