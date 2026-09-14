import { SkillRegistry, SkillMetadata } from '@agi-os/skill-registry';
import { SkillLoader, ParsedSkill } from '@agi-os/skill-loader';
import { CapabilityFetcher, RegistryConfig, FetchedSkill } from './CapabilityFetcher.js';

export interface MarketplaceConfig {
  registry: SkillRegistry;
  fetcher: CapabilityFetcher;
  autoSync?: boolean;
}

export interface SyncResult {
  fetched: number;
  loaded: number;
  errors: string[];
}

export class CapabilityManager {
  private registry: SkillRegistry;
  private loader: SkillLoader;
  private fetcher: CapabilityFetcher;
  private installedSkills: Map<string, ParsedSkill> = new Map();

  constructor(config: MarketplaceConfig) {
    this.registry = config.registry;
    this.fetcher = config.fetcher;
    this.loader = new SkillLoader({ registry: this.registry });
  }

  async sync(): Promise<SyncResult> {
    const result: SyncResult = { fetched: 0, loaded: 0, errors: [] };

    try {
      const skills = await this.fetcher.fetchAllSkills();
      result.fetched = skills.length;

      for (const skill of skills) {
        try {
          const parsed = await this.loader.loadFromContent(skill.content);
          this.installedSkills.set(skill.name, parsed);
          result.loaded++;
        } catch (error) {
          result.errors.push(`Failed to load ${skill.name}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to fetch skills: ${error}`);
    }

    return result;
  }

  async install(skillName: string): Promise<boolean> {
    try {
      const content = await this.fetcher.fetchSkillContent(skillName);
      const parsed = await this.loader.loadFromContent(content);
      this.installedSkills.set(skillName, parsed);
      return true;
    } catch (error) {
      return false;
    }
  }

  async uninstall(skillName: string): Promise<boolean> {
    if (this.installedSkills.has(skillName)) {
      this.installedSkills.delete(skillName);
      this.registry.unregister(skillName);
      return true;
    }
    return false;
  }

  async update(skillName: string): Promise<boolean> {
    await this.uninstall(skillName);
    return this.install(skillName);
  }

  getInstalledSkills(): ParsedSkill[] {
    return Array.from(this.installedSkills.values());
  }

  isInstalled(skillName: string): boolean {
    return this.installedSkills.has(skillName);
  }

  search(query: string): ParsedSkill[] {
    return this.loader.searchSkills(query);
  }

  getLoader(): SkillLoader {
    return this.loader;
  }
}
