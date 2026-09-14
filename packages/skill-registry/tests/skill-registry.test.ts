import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry, SkillMetadata } from '../src/index.js';

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  const createSkill = (overrides: Partial<SkillMetadata> = {}): SkillMetadata => ({
    name: 'test-skill',
    version: '1.0.0',
    description: 'A test skill',
    author: 'test-author',
    category: 'utility',
    tags: ['test', 'utility'],
    dependencies: [],
    requirements: [],
    entryPoint: 'index.js',
    capabilities: ['test-capability'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  beforeEach(() => {
    registry = new SkillRegistry();
  });

  it('should create empty registry', () => {
    expect(registry.size()).toBe(0);
  });

  it('should register and retrieve skills', () => {
    const skill = createSkill();
    registry.register(skill);
    expect(registry.size()).toBe(1);
    expect(registry.get('test-skill')).toBeDefined();
  });

  it('should unregister skills', () => {
    const skill = createSkill();
    registry.register(skill);
    registry.unregister('test-skill');
    expect(registry.size()).toBe(0);
  });

  it('should get all skills', () => {
    registry.register(createSkill({ name: 'skill-1' }));
    registry.register(createSkill({ name: 'skill-2' }));
    expect(registry.getAll().length).toBe(2);
  });

  it('should search skills by name', () => {
    registry.register(createSkill({ name: 'file-reader', description: 'Reads files' }));
    registry.register(createSkill({ name: 'file-writer', description: 'Writes files' }));
    registry.register(createSkill({ name: 'web-browser', description: 'Browses web' }));

    const results = registry.search('file');
    expect(results.length).toBe(2);
    expect(results[0].skill.name).toContain('file');
  });

  it('should search skills by capability', () => {
    registry.register(createSkill({ name: 'skill-1', capabilities: ['read-file', 'write-file'] }));
    registry.register(createSkill({ name: 'skill-2', capabilities: ['web-search'] }));

    const results = registry.search('read');
    expect(results.length).toBe(1);
    expect(results[0].matchedCapabilities).toContain('read-file');
  });

  it('should find by capability', () => {
    registry.register(createSkill({ name: 'skill-1', capabilities: ['read-file'] }));
    registry.register(createSkill({ name: 'skill-2', capabilities: ['write-file'] }));

    const results = registry.findByCapability('read-file');
    expect(results.length).toBe(1);
    expect(results[0].name).toBe('skill-1');
  });

  it('should find by category', () => {
    registry.register(createSkill({ name: 'skill-1', category: 'utility' }));
    registry.register(createSkill({ name: 'skill-2', category: 'automation' }));

    const results = registry.findByCategory('utility');
    expect(results.length).toBe(1);
  });

  it('should find by tag', () => {
    registry.register(createSkill({ name: 'skill-1', tags: ['fast', 'lightweight'] }));
    registry.register(createSkill({ name: 'skill-2', tags: ['slow', 'heavy'] }));

    const results = registry.findByTag('fast');
    expect(results.length).toBe(1);
  });

  it('should filter skills', () => {
    registry.register(createSkill({
      name: 'skill-1',
      category: 'utility',
      tags: ['fast'],
      author: 'author-1',
    }));
    registry.register(createSkill({
      name: 'skill-2',
      category: 'automation',
      tags: ['slow'],
      author: 'author-2',
    }));

    const results = registry.filter({ category: 'utility' });
    expect(results.length).toBe(1);

    const results2 = registry.filter({ tags: ['slow'] });
    expect(results2.length).toBe(1);

    const results3 = registry.filter({ author: 'author-1' });
    expect(results3.length).toBe(1);
  });

  it('should get categories', () => {
    registry.register(createSkill({ name: 'skill-1', category: 'utility' }));
    registry.register(createSkill({ name: 'skill-2', category: 'automation' }));

    const categories = registry.getCategories();
    expect(categories.length).toBe(2);
    expect(categories).toContain('utility');
    expect(categories).toContain('automation');
  });

  it('should get tags', () => {
    registry.register(createSkill({ name: 'skill-1', tags: ['fast', 'lightweight'] }));
    registry.register(createSkill({ name: 'skill-2', tags: ['slow', 'heavy'] }));

    const tags = registry.getTags();
    expect(tags.length).toBe(4);
  });

  it('should get capabilities', () => {
    registry.register(createSkill({ name: 'skill-1', capabilities: ['read-file'] }));
    registry.register(createSkill({ name: 'skill-2', capabilities: ['write-file'] }));

    const capabilities = registry.getCapabilities();
    expect(capabilities.length).toBe(2);
  });

  it('should clear registry', () => {
    registry.register(createSkill());
    registry.clear();
    expect(registry.size()).toBe(0);
  });
});
