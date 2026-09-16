export interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  dependencies: string[];
  requirements: string[];
  entryPoint: string;
  capabilities: string[];
  repository?: string;
  license?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SkillSearchResult {
  skill: SkillMetadata;
  score: number;
  matchedCapabilities: string[];
}

export interface SkillFilter {
  category?: string;
  tags?: string[];
  capabilities?: string[];
  author?: string;
  search?: string;
}

export class SkillRegistry {
  private skills: Map<string, SkillMetadata> = new Map();
  private capabilityIndex: Map<string, Set<string>> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();

  register(skill: SkillMetadata): void {
    this.skills.set(skill.name, skill);
    this.indexSkill(skill);
  }

  unregister(skillName: string): void {
    const skill = this.skills.get(skillName);
    if (skill) {
      this.removeFromIndex(skill);
      this.skills.delete(skillName);
    }
  }

  get(skillName: string): SkillMetadata | undefined {
    return this.skills.get(skillName);
  }

  getAll(): SkillMetadata[] {
    return Array.from(this.skills.values());
  }

  search(query: string): SkillSearchResult[] {
    const results: SkillSearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const skill of this.skills.values()) {
      let score = 0;
      const matchedCapabilities: string[] = [];

      if (skill.name.toLowerCase().includes(queryLower)) score += 10;
      if (skill.description.toLowerCase().includes(queryLower)) score += 5;
      if (skill.category.toLowerCase().includes(queryLower)) score += 3;

      for (const tag of skill.tags) {
        if (tag.toLowerCase().includes(queryLower)) score += 2;
      }

      for (const cap of skill.capabilities) {
        if (cap.toLowerCase().includes(queryLower)) {
          score += 4;
          matchedCapabilities.push(cap);
        }
      }

      if (score > 0) {
        results.push({ skill, score, matchedCapabilities });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  findByCapability(capability: string): SkillMetadata[] {
    const skillNames = this.capabilityIndex.get(capability) || new Set();
    return Array.from(skillNames).map(name => this.skills.get(name)!).filter(Boolean);
  }

  findByCategory(category: string): SkillMetadata[] {
    const skillNames = this.categoryIndex.get(category) || new Set();
    return Array.from(skillNames).map(name => this.skills.get(name)!).filter(Boolean);
  }

  findByTag(tag: string): SkillMetadata[] {
    const skillNames = this.tagIndex.get(tag) || new Set();
    return Array.from(skillNames).map(name => this.skills.get(name)!).filter(Boolean);
  }

  filter(filter: SkillFilter): SkillMetadata[] {
    let results = this.getAll();

    if (filter.category) {
      results = results.filter(s => s.category === filter.category);
    }

    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(s =>
        filter.tags!.some(tag => s.tags.includes(tag))
      );
    }

    if (filter.capabilities && filter.capabilities.length > 0) {
      results = results.filter(s =>
        filter.capabilities!.some(cap => s.capabilities.includes(cap))
      );
    }

    if (filter.author) {
      results = results.filter(s => s.author === filter.author);
    }

    if (filter.search) {
      const searchResults = this.search(filter.search);
      results = results.filter(s =>
        searchResults.some(r => r.skill.name === s.name)
      );
    }

    return results;
  }

  getCategories(): string[] {
    return Array.from(this.categoryIndex.keys());
  }

  getTags(): string[] {
    return Array.from(this.tagIndex.keys());
  }

  getCapabilities(): string[] {
    return Array.from(this.capabilityIndex.keys());
  }

  size(): number {
    return this.skills.size;
  }

  clear(): void {
    this.skills.clear();
    this.capabilityIndex.clear();
    this.categoryIndex.clear();
    this.tagIndex.clear();
  }

  private indexSkill(skill: SkillMetadata): void {
    for (const cap of skill.capabilities) {
      if (!this.capabilityIndex.has(cap)) {
        this.capabilityIndex.set(cap, new Set());
      }
      this.capabilityIndex.get(cap)!.add(skill.name);
    }

    if (!this.categoryIndex.has(skill.category)) {
      this.categoryIndex.set(skill.category, new Set());
    }
    this.categoryIndex.get(skill.category)!.add(skill.name);

    for (const tag of skill.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(skill.name);
    }
  }

  private removeFromIndex(skill: SkillMetadata): void {
    for (const cap of skill.capabilities) {
      this.capabilityIndex.get(cap)?.delete(skill.name);
    }
    this.categoryIndex.get(skill.category)?.delete(skill.name);
    for (const tag of skill.tags) {
      this.tagIndex.get(tag)?.delete(skill.name);
    }
  }
}
