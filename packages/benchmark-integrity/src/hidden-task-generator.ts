import { generateId } from '@agi-os/kernel';

export interface TaskTemplate {
  id: string;
  category: string;
  generate: (seed: number) => string;
}

export interface GeneratedTask {
  taskId: string;
  category: string;
  task: string;
}

export class HiddenTaskGenerator {
  private templates: TaskTemplate[] = [];

  registerTemplate(template: TaskTemplate): void {
    this.templates.push(template);
  }

  generate(seed: number): GeneratedTask[] {
    return this.templates.map((template) => ({
      taskId: generateId(),
      category: template.category,
      task: template.generate(seed),
    }));
  }

  getTemplateCount(): number {
    return this.templates.length;
  }
}
