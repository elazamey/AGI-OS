import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '@agi-os/skill-registry';
import { CapabilityFetcher, CapabilityManager } from '../src/index.js';

describe('CapabilityFetcher', () => {
  let fetcher: CapabilityFetcher;

  beforeEach(() => {
    fetcher = new CapabilityFetcher({
      owner: 'elazamey',
      repo: 'skills-registry',
    });
  });

  it('should create fetcher', () => {
    expect(fetcher).toBeDefined();
  });

  it('should generate registry URL', () => {
    expect(fetcher.getRegistryUrl()).toBe('https://github.com/elazamey/skills-registry');
  });

  it('should generate raw URL', () => {
    const url = fetcher.getRawUrl('skills/file-reader/SKILL.md');
    expect(url).toContain('raw.githubusercontent.com');
    expect(url).toContain('skills/file-reader/SKILL.md');
  });

  it('should generate API URL', () => {
    const url = fetcher.getApiUrl();
    expect(url).toContain('api.github.com');
    expect(url).toContain('contents/skills');
  });

  it('should fetch skill list', async () => {
    const skills = await fetcher.fetchSkillList();
    expect(skills.length).toBeGreaterThan(0);
    expect(skills).toContain('file-reader');
  });

  it('should fetch skill content', async () => {
    const content = await fetcher.fetchSkillContent('file-reader');
    expect(content).toContain('# Name');
    expect(content).toContain('file-reader');
  });

  it('should fetch all skills', async () => {
    const skills = await fetcher.fetchAllSkills();
    expect(skills.length).toBeGreaterThan(0);
  });
});

describe('CapabilityManager', () => {
  let registry: SkillRegistry;
  let fetcher: CapabilityFetcher;
  let manager: CapabilityManager;

  beforeEach(() => {
    registry = new SkillRegistry();
    fetcher = new CapabilityFetcher({
      owner: 'elazamey',
      repo: 'skills-registry',
    });
    manager = new CapabilityManager({ registry, fetcher });
  });

  it('should create manager', () => {
    expect(manager).toBeDefined();
  });

  it('should sync skills from registry', async () => {
    const result = await manager.sync();
    expect(result.fetched).toBeGreaterThan(0);
    expect(result.loaded).toBeGreaterThan(0);
  });

  it('should install skill', async () => {
    const success = await manager.install('file-reader');
    expect(success).toBe(true);
    expect(manager.isInstalled('file-reader')).toBe(true);
  });

  it('should uninstall skill', async () => {
    await manager.install('file-reader');
    const success = await manager.uninstall('file-reader');
    expect(success).toBe(true);
    expect(manager.isInstalled('file-reader')).toBe(false);
  });

  it('should update skill', async () => {
    await manager.install('file-reader');
    const success = await manager.update('file-reader');
    expect(success).toBe(true);
  });

  it('should get installed skills', async () => {
    await manager.sync();
    const skills = manager.getInstalledSkills();
    expect(skills.length).toBeGreaterThan(0);
  });

  it('should search skills', async () => {
    await manager.sync();
    const results = manager.search('file');
    expect(results.length).toBeGreaterThan(0);
  });
});
