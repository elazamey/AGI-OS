import { SkillMetadata } from '@agi-os/skill-registry';

export interface RegistryConfig {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

export interface FetchedSkill {
  name: string;
  content: string;
  metadata?: SkillMetadata;
}

export class CapabilityFetcher {
  private config: RegistryConfig;

  constructor(config: RegistryConfig) {
    this.config = {
      branch: 'main',
      path: 'skills',
      ...config,
    };
  }

  getRegistryUrl(): string {
    return `https://github.com/${this.config.owner}/${this.config.repo}`;
  }

  getRawUrl(path: string): string {
    return `https://raw.githubusercontent.com/${this.config.owner}/${this.config.repo}/${this.config.branch}/${path}`;
  }

  getApiUrl(): string {
    return `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${this.config.path}?ref=${this.config.branch}`;
  }

  async fetchSkillList(): Promise<string[]> {
    // In real implementation, this would call GitHub API
    // For now, return mock data
    return [
      'file-reader',
      'web-browser',
      'code-generator',
      'test-runner',
      'database-query',
    ];
  }

  async fetchSkillContent(skillName: string): Promise<string> {
    const url = this.getRawUrl(`${this.config.path}/${skillName}/SKILL.md`);
    // In real implementation, this would fetch from GitHub
    // For now, return mock content
    return `
# Name
${skillName}

# Description
A dynamically loaded skill from GitHub registry

# Instructions
Use this skill to perform ${skillName} operations

# Capabilities
- ${skillName}
`;
  }

  async fetchAllSkills(): Promise<FetchedSkill[]> {
    const skillNames = await this.fetchSkillList();
    const skills: FetchedSkill[] = [];

    for (const name of skillNames) {
      const content = await this.fetchSkillContent(name);
      skills.push({ name, content });
    }

    return skills;
  }
}
