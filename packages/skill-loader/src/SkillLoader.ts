import { SkillRegistry, SkillMetadata } from '@agi-os/skill-registry';
import { SkillParser, ParsedSkill } from './SkillParser.js';
import { SkillExecutor, ExecutionContext, ExecutionResult } from './SkillExecutor.js';

export interface SkillLoaderConfig {
  registry: SkillRegistry;
  skillsPath?: string;
  autoLoad?: boolean;
}

export class SkillLoader {
  private registry: SkillRegistry;
  private executor: SkillExecutor;
  private loadedSkills: Map<string, ParsedSkill> = new Map();

  constructor(config: SkillLoaderConfig) {
    this.registry = config.registry;
    this.executor = new SkillExecutor();
  }

  async loadFromContent(content: string): Promise<ParsedSkill> {
    const parsed = SkillParser.parse(content);
    this.loadedSkills.set(parsed.metadata.name, parsed);
    this.registry.register(parsed.metadata);
    return parsed;
  }

  async loadFromMultiple(contents: string[]): Promise<ParsedSkill[]> {
    const results: ParsedSkill[] = [];
    for (const content of contents) {
      const parsed = await this.loadFromContent(content);
      results.push(parsed);
    }
    return results;
  }

  async executeSkill(skillName: string, input: Record<string, unknown> = {}): Promise<ExecutionResult> {
    const skill = this.loadedSkills.get(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    const context: ExecutionContext = {
      skill,
      input,
      environment: process.env as Record<string, string>,
    };

    return this.executor.execute(context);
  }

  getLoadedSkill(skillName: string): ParsedSkill | undefined {
    return this.loadedSkills.get(skillName);
  }

  getLoadedSkills(): ParsedSkill[] {
    return Array.from(this.loadedSkills.values());
  }

  searchSkills(query: string): ParsedSkill[] {
    const results = this.registry.search(query);
    return results
      .map(r => this.loadedSkills.get(r.skill.name))
      .filter((s): s is ParsedSkill => s !== undefined);
  }

  getExecutor(): SkillExecutor {
    return this.executor;
  }

  size(): number {
    return this.loadedSkills.size;
  }
}
