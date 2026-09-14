import { SkillMetadata } from '@agi-os/skill-registry';

export interface ParsedSkill {
  metadata: SkillMetadata;
  instructions: string;
  code: string;
  requirements: string[];
  examples: string[];
}

export class SkillParser {
  static parse(content: string): ParsedSkill {
    const sections = this.extractSections(content);
    const metadata = this.extractMetadata(sections);
    const instructions = this.extractInstructions(sections);
    const code = this.extractCode(sections);
    const requirements = this.extractRequirements(sections);
    const examples = this.extractExamples(sections);

    return {
      metadata,
      instructions,
      code,
      requirements,
      examples,
    };
  }

  private static extractSections(content: string): Map<string, string> {
    const sections = new Map<string, string>();
    const lines = content.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^#{1,3}\s+(.+)/);
      if (headerMatch) {
        if (currentSection) {
          sections.set(currentSection, currentContent.join('\n').trim());
        }
        currentSection = headerMatch[1].toLowerCase();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentSection) {
      sections.set(currentSection, currentContent.join('\n').trim());
    }

    return sections;
  }

  private static extractMetadata(sections: Map<string, string>): SkillMetadata {
    const name = sections.get('name') || 'unknown-skill';
    const version = sections.get('version') || '1.0.0';
    const description = sections.get('description') || '';
    const author = sections.get('author') || 'unknown';
    const category = sections.get('category') || 'general';
    const tags = this.parseList(sections.get('tags') || '');
    const dependencies = this.parseList(sections.get('dependencies') || '');
    const capabilities = this.parseList(sections.get('capabilities') || '');

    return {
      name,
      version,
      description,
      author,
      category,
      tags,
      dependencies,
      requirements: [],
      entryPoint: 'index.js',
      capabilities,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  private static extractInstructions(sections: Map<string, string>): string {
    return sections.get('instructions') || sections.get('usage') || '';
  }

  private static extractCode(sections: Map<string, string>): string {
    const codeBlock = sections.get('code') || sections.get('implementation') || '';
    const codeMatch = codeBlock.match(/```[\s\S]*?\n([\s\S]*?)```/);
    return codeMatch ? codeMatch[1].trim() : codeBlock;
  }

  private static extractRequirements(sections: Map<string, string>): string[] {
    const reqs = sections.get('requirements') || '';
    return this.parseList(reqs);
  }

  private static extractExamples(sections: Map<string, string>): string[] {
    const examples = sections.get('examples') || '';
    const exampleBlocks = examples.match(/```[\s\S]*?\n([\s\S]*?)```/g) || [];
    return exampleBlocks.map(block => {
      const match = block.match(/```[\s\S]*?\n([\s\S]*?)```/);
      return match ? match[1].trim() : '';
    }).filter(Boolean);
  }

  private static parseList(content: string): string[] {
    return content
      .split('\n')
      .map(line => line.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean);
  }

  static validate(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const sections = this.extractSections(content);

    if (!sections.has('name')) {
      errors.push('Missing required section: # Name');
    }
    if (!sections.has('description')) {
      errors.push('Missing required section: # Description');
    }
    if (!sections.has('instructions') && !sections.has('usage')) {
      errors.push('Missing required section: # Instructions or # Usage');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
