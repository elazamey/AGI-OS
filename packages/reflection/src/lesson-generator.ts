import { generateId } from '@agi-os/kernel';
import type {
  RootCause,
  CandidateLesson,
  LessonCategory,
  LessonImpact,
  MissionOutcome,
} from './types.js';

export class LessonGenerator {
  generate(params: {
    outcome: MissionOutcome;
    rootCauses: RootCause[];
  }): CandidateLesson[] {
    const { outcome, rootCauses } = params;
    const lessons: CandidateLesson[] = [];

    for (const rc of rootCauses) {
      const lesson = this.inferLesson(rc, outcome);
      if (lesson) lessons.push(lesson);
    }

    return lessons;
  }

  private inferLesson(
    rootCause: RootCause,
    outcome: MissionOutcome
  ): CandidateLesson | null {
    const category = this.mapToLessonCategory(rootCause);
    const impact = this.assessImpact(rootCause, outcome);
    const statement = this.generateStatement(rootCause);
    const suggestedAction = this.generateAction(rootCause);
    const applicability = this.inferApplicability(rootCause);
    const prerequisites = this.inferPrerequisites(rootCause);

    return {
      id: generateId(),
      rootCauseId: rootCause.id,
      statement,
      category,
      impact,
      applicability,
      prerequisites,
      suggestedAction,
      confidence: rootCause.confidence === 'high' ? 0.8
        : rootCause.confidence === 'medium' ? 0.6
        : 0.4,
    };
  }

  private mapToLessonCategory(rc: RootCause): LessonCategory {
    const cause = rc.cause.toLowerCase();
    const mechanism = rc.mechanism.toLowerCase();

    if (cause.includes('assum') || mechanism.includes('assum')) return 'strategic';
    if (cause.includes('plan') || mechanism.includes('plan')) return 'tactical';
    if (cause.includes('tool') || cause.includes('execution')) return 'procedural';
    if (cause.includes('resource') || cause.includes('external')) return 'resource';
    if (cause.includes('constraint')) return 'constraint_awareness';
    if (cause.includes('information') || cause.includes('data')) return 'environmental';

    return 'procedural';
  }

  private assessImpact(rc: RootCause, outcome: MissionOutcome): LessonImpact {
    if (rc.confidence === 'high' && !outcome.success) return 'high';
    if (rc.confidence === 'high' && outcome.success) return 'medium';
    if (rc.reproducible) return 'high';
    return 'medium';
  }

  private generateStatement(rc: RootCause): string {
    return `${rc.cause}. Mechanism: ${rc.mechanism}`;
  }

  private generateAction(rc: RootCause): string {
    const cause = rc.cause.toLowerCase();

    if (cause.includes('assum')) return 'Validate assumptions before committing to a strategy';
    if (cause.includes('information')) return 'Gather more information before planning';
    if (cause.includes('resource')) return 'Check resource availability before execution';
    if (cause.includes('constraint')) return 'Include constraint validation in plan review';
    if (cause.includes('tool')) return 'Add tool capability verification step';
    if (cause.includes('plan')) return 'Review plan logic and dependency ordering';
    if (cause.includes('execution')) return 'Add monitoring and rollback capability';
    if (cause.includes('external')) return 'Add fallback for external dependencies';

    return 'Investigate and add preventive check';
  }

  private inferApplicability(rc: RootCause): string[] {
    const tags: string[] = [];
    const cause = rc.cause.toLowerCase();

    if (cause.includes('assum')) tags.push('planning', 'prediction');
    if (cause.includes('resource')) tags.push('resource_management', 'execution');
    if (cause.includes('constraint')) tags.push('validation', 'compliance');
    if (cause.includes('tool')) tags.push('tool_selection', 'execution');
    if (cause.includes('plan')) tags.push('planning', 'strategy');
    if (cause.includes('information')) tags.push('context_gathering', 'planning');
    if (cause.includes('external')) tags.push('dependency_management', 'resilience');

    return tags.length > 0 ? tags : ['general'];
  }

  private inferPrerequisites(rc: RootCause): string[] {
    const prereqs: string[] = [];
    const cause = rc.cause.toLowerCase();

    if (cause.includes('resource')) prereqs.push('resource_availability_check');
    if (cause.includes('constraint')) prereqs.push('constraint_registry_populated');
    if (cause.includes('information')) prereqs.push('world_state_accessible');

    return prereqs;
  }

  sortByImpact(lessons: CandidateLesson[]): CandidateLesson[] {
    const impactOrder: Record<LessonImpact, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    return [...lessons].sort((a, b) => impactOrder[b.impact] - impactOrder[a.impact]);
  }

  sortByConfidence(lessons: CandidateLesson[]): CandidateLesson[] {
    return [...lessons].sort((a, b) => b.confidence - a.confidence);
  }
}

export function createLessonGenerator(): LessonGenerator {
  return new LessonGenerator();
}
