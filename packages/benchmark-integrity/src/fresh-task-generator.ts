export interface FreshTemplate {
  pattern: string;
  variables: Record<string, string[]>;
}

export class FreshTaskGenerator {
  generateFromTemplate(template: FreshTemplate, seed: number): string {
    let result = template.pattern;

    for (const [key, values] of Object.entries(template.variables)) {
      const index = Math.abs(seed) % values.length;
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), values[index]);
    }

    return result;
  }

  generateBatch(count: number, templates: FreshTemplate[]): string[] {
    const results: string[] = [];

    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      results.push(this.generateFromTemplate(template, i));
    }

    return results;
  }
}
