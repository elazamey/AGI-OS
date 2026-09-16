import { generateId } from '@agi-os/kernel';
import type { Goal } from './types.js';

export class GoalExtractor {
  extract(intent: string): Goal[] {
    const goals: Goal[] = [];
    const lines = intent.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        goals.push({
          id: generateId(),
          description: trimmed,
          constraints: this.extractInlineConstraints(trimmed),
          priority: goals.length + 1,
        });
      }
    }
    return goals.length > 0 ? goals : [{ id: generateId(), description: intent, constraints: [], priority: 1 }];
  }

  private extractInlineConstraints(text: string): string[] {
    const constraints: string[] = [];
    if (text.includes('بدون') || text.includes('without')) constraints.push('negative constraint');
    if (text.includes('يجب') || text.includes('must')) constraints.push('requirement');
    return constraints;
  }

  prioritize(goals: Goal[]): Goal[] {
    return [...goals].sort((a, b) => a.priority - b.priority);
  }
}
