import * as fs from 'fs';
import * as path from 'path';

export interface Skill {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  source_url: string;
  instructions: string;
  status: 'LOADED' | 'ERROR' | 'PENDING';
}

export interface SkillSyncResponse {
  status: 'success' | 'error';
  count: number;
  synced_at: string;
  skills: Array<{ name: string; triggers: string[]; status: string }>;
}

export class SkillDiscoveryEngine {
  private skills: Map<string, Skill> = new Map();
  private registryPath: string;
  private skillsDir: string;

  constructor(skillsDir: string = './skills', registryPath: string = './skills/registry.json') {
    this.skillsDir = skillsDir;
    this.registryPath = registryPath;
  }

  parseSkillMd(content: string): Omit<Skill, 'id' | 'source_url' | 'status'> {
    const lines = content.split('\n');
    let name = '';
    let description = '';
    let triggers: string[] = [];
    let instructions = '';
    let inInstructions = false;

    for (const line of lines) {
      const nameMatch = line.match(/^#\s+(.+)$/);
      if (nameMatch) {
        name = nameMatch[1].trim();
        continue;
      }

      const descMatch = line.match(/^description:\s*(.+)/i);
      if (descMatch) {
        description = descMatch[1].trim();
        continue;
      }

      const triggerMatch = line.match(/^triggers:\s*(.+)/i);
      if (triggerMatch) {
        triggers = triggerMatch[1].split(',').map(t => t.trim()).filter(Boolean);
        continue;
      }

      if (line.match(/^##\s+Instructions/i)) {
        inInstructions = true;
        continue;
      }

      if (inInstructions) {
        instructions += line + '\n';
      }
    }

    return {
      name,
      description,
      triggers,
      instructions: instructions.trim(),
    };
  }

  async loadSkillFromFile(filePath: string): Promise<Skill> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = this.parseSkillMd(content);
    const id = path.basename(filePath, '.md').toLowerCase().replace(/\s+/g, '-');

    return {
      id,
      ...parsed,
      source_url: `local://${filePath}`,
      status: 'LOADED',
    };
  }

  async loadAllSkills(): Promise<Skill[]> {
    const skills: Skill[] = [];

    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
      return skills;
    }

    const files = fs.readdirSync(this.skillsDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      try {
        const skill = await this.loadSkillFromFile(path.join(this.skillsDir, file));
        this.skills.set(skill.id, skill);
        skills.push(skill);
      } catch (error) {
        console.error(`Failed to load skill ${file}:`, error);
      }
    }

    return skills;
  }

  async syncFromGitHub(owner: string, repo: string, branch: string = 'main'): Promise<SkillSyncResponse> {
    const skills: Skill[] = [];

    try {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/skills/`;
      // In real implementation, fetch from GitHub API
      // For now, load local skills
      const loadedSkills = await this.loadAllSkills();
      skills.push(...loadedSkills);
    } catch (error) {
      console.error('Failed to sync from GitHub:', error);
    }

    return {
      status: skills.length > 0 ? 'success' : 'error',
      count: skills.length,
      synced_at: new Date().toISOString(),
      skills: skills.map(s => ({
        name: s.name,
        triggers: s.triggers,
        status: s.status,
      })),
    };
  }

  getSkill(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  searchByTrigger(trigger: string): Skill[] {
    return Array.from(this.skills.values()).filter(s =>
      s.triggers.some(t => t.toLowerCase().includes(trigger.toLowerCase()))
    );
  }

  searchByName(query: string): Skill[] {
    return Array.from(this.skills.values()).filter(s =>
      s.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  saveRegistry(): void {
    const registry = Array.from(this.skills.values());
    fs.writeFileSync(this.registryPath, JSON.stringify(registry, null, 2));
  }

  loadRegistry(): void {
    if (fs.existsSync(this.registryPath)) {
      const data = fs.readFileSync(this.registryPath, 'utf-8');
      const registry: Skill[] = JSON.parse(data);
      for (const skill of registry) {
        this.skills.set(skill.id, skill);
      }
    }
  }

  size(): number {
    return this.skills.size;
  }
}
