import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '@agi-os/skill-registry';
import { SkillParser, SkillExecutor, SkillLoader } from '../src/index.js';

describe('SkillParser', () => {
  const validSkillMd = `
# Name
file-reader

# Version
1.0.0

# Description
A skill that reads files from the filesystem

# Author
agi-os

# Category
utility

# Tags
- file
- read
- filesystem

# Dependencies
- none

# Capabilities
- read-file
- list-directory

# Instructions
Use this skill to read files from the filesystem.
Provide the file path as input.

# Examples
\`\`\`javascript
const result = await execute({ path: '/home/user/file.txt' });
\`\`\`
`;

  it('should parse valid SKILL.md', () => {
    const result = SkillParser.parse(validSkillMd);
    expect(result.metadata.name).toBe('file-reader');
    expect(result.metadata.version).toBe('1.0.0');
    expect(result.metadata.description).toContain('reads files');
    expect(result.metadata.author).toBe('agi-os');
    expect(result.metadata.category).toBe('utility');
    expect(result.metadata.tags).toContain('file');
    expect(result.metadata.capabilities).toContain('read-file');
    expect(result.instructions).toContain('read files');
  });

  it('should validate valid SKILL.md', () => {
    const result = SkillParser.validate(validSkillMd);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should detect missing name', () => {
    const invalid = `
# Description
A skill without name

# Instructions
Some instructions
`;
    const result = SkillParser.validate(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required section: # Name');
  });

  it('should detect missing description', () => {
    const invalid = `
# Name
test-skill

# Instructions
Some instructions
`;
    const result = SkillParser.validate(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required section: # Description');
  });

  it('should detect missing instructions', () => {
    const invalid = `
# Name
test-skill

# Description
A test skill
`;
    const result = SkillParser.validate(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required section: # Instructions or # Usage');
  });
});

describe('SkillExecutor', () => {
  let executor: SkillExecutor;

  beforeEach(() => {
    executor = new SkillExecutor();
  });

  it('should create executor', () => {
    expect(executor).toBeDefined();
  });

  it('should execute skill and record history', async () => {
    const parsed = SkillParser.parse(`
# Name
test-skill

# Description
Test

# Instructions
Do something
`);
    const result = await executor.execute({
      skill: parsed,
      input: { test: true },
      environment: {},
    });

    expect(result.success).toBe(true);
    expect(result.skillName).toBe('test-skill');
    expect(executor.getHistory().length).toBe(1);
  });

  it('should get history by skill', async () => {
    const parsed = SkillParser.parse(`
# Name
test-skill

# Description
Test

# Instructions
Do something
`);
    await executor.execute({ skill: parsed, input: {}, environment: {} });
    await executor.execute({ skill: parsed, input: {}, environment: {} });

    expect(executor.getHistoryBySkill('test-skill').length).toBe(2);
  });

  it('should clear history', async () => {
    const parsed = SkillParser.parse(`
# Name
test-skill

# Description
Test

# Instructions
Do something
`);
    await executor.execute({ skill: parsed, input: {}, environment: {} });
    executor.clearHistory();
    expect(executor.getHistory().length).toBe(0);
  });
});

describe('SkillLoader', () => {
  let registry: SkillRegistry;
  let loader: SkillLoader;

  beforeEach(() => {
    registry = new SkillRegistry();
    loader = new SkillLoader({ registry });
  });

  it('should create loader', () => {
    expect(loader).toBeDefined();
  });

  it('should load skill from content', async () => {
    const content = `
# Name
file-reader

# Description
Reads files

# Instructions
Read files from filesystem
`;
    const skill = await loader.loadFromContent(content);
    expect(skill.metadata.name).toBe('file-reader');
    expect(loader.size()).toBe(1);
  });

  it('should load multiple skills', async () => {
    const contents = [
      `
# Name
skill-1

# Description
Skill 1

# Instructions
Do 1
`,
      `
# Name
skill-2

# Description
Skill 2

# Instructions
Do 2
`,
    ];
    const skills = await loader.loadFromMultiple(contents);
    expect(skills.length).toBe(2);
    expect(loader.size()).toBe(2);
  });

  it('should execute loaded skill', async () => {
    const content = `
# Name
test-skill

# Description
Test

# Instructions
Do something
`;
    await loader.loadFromContent(content);
    const result = await loader.executeSkill('test-skill', { input: 'test' });
    expect(result.success).toBe(true);
  });

  it('should throw on missing skill', async () => {
    await expect(loader.executeSkill('nonexistent')).rejects.toThrow('Skill not found');
  });

  it('should search loaded skills', async () => {
    const contents = [
      `
# Name
file-reader

# Description
Reads files

# Instructions
Read files
`,
      `
# Name
web-browser

# Description
Browses web

# Instructions
Browse web
`,
    ];
    await loader.loadFromMultiple(contents);

    const results = loader.searchSkills('file');
    expect(results.length).toBe(1);
    expect(results[0].metadata.name).toBe('file-reader');
  });

  it('should get loaded skills', async () => {
    const content = `
# Name
test-skill

# Description
Test

# Instructions
Do something
`;
    await loader.loadFromContent(content);
    const skills = loader.getLoadedSkills();
    expect(skills.length).toBe(1);
  });
});
