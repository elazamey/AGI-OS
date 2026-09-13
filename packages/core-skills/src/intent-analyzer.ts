import { generateId, now } from '@agi-os/kernel';
import type { IntentAnalysis, Goal } from './types.js';

export class IntentAnalyzer {
  analyze(userInput: string): IntentAnalysis {
    const goals = this.extractGoals(userInput);
    const constraints = this.extractConstraints(userInput);
    const riskAssessment = this.assessRisk(goals, constraints);
    const suggestedSkills = this.suggestSkills(goals);

    return {
      id: generateId(),
      rawInput: userInput,
      goals,
      constraints,
      riskAssessment,
      suggestedSkills,
    };
  }

  private extractGoals(input: string): Goal[] {
    const sentences = input.split(/[.!?]+/).filter(s => s.trim().length > 0);
    return sentences.map((s, i) => ({
      id: generateId(),
      description: s.trim(),
      constraints: [],
      priority: i === 0 ? 1 : 2,
    }));
  }

  private extractConstraints(input: string): string[] {
    const constraintPatterns = [
      /(?:يجب|يجب أن|يجب عليك|ต้อง|ต้องการ|يجب علي)/g,
      /(?:بدون|لا|من غير|without|no|don't)/g,
      /(?:في غضون|within|before|قبل)/g,
    ];
    const constraints: string[] = [];
    for (const pattern of constraintPatterns) {
      const matches = input.match(pattern);
      if (matches) constraints.push(...matches);
    }
    return constraints;
  }

  private assessRisk(goals: Goal[], constraints: string[]): string {
    if (goals.length > 5 || constraints.length > 3) return 'HIGH';
    if (goals.length > 2 || constraints.length > 1) return 'MEDIUM';
    return 'LOW';
  }

  private suggestSkills(goals: Goal[]): string[] {
    const skills: string[] = [];
    for (const goal of goals) {
      const desc = goal.description.toLowerCase();
      if (desc.includes('بحث') || desc.includes('search') || desc.includes('find')) skills.push('research');
      if (desc.includes('كود') || desc.includes('code') || desc.includes('write') || desc.includes('ابنِ')) skills.push('coding');
      if (desc.includes('موقع') || desc.includes('website') || desc.includes('browser') || desc.includes('افتح')) skills.push('browser');
      if (desc.includes('تقرير') || desc.includes('report') || desc.includes('compare')) skills.push('research', 'artifact');
      if (desc.includes('ملف') || desc.includes('file') || desc.includes('إنشاء')) skills.push('filesystem');
    }
    return [...new Set(skills)];
  }
}
