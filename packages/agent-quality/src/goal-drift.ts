import type { GoalDriftResult } from './types.js';

export class GoalDriftDetector {
  private originalGoal: string = '';
  private goalKeywords: string[] = [];

  setGoal(goal: string): void {
    this.originalGoal = goal;
    this.goalKeywords = goal
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !['the', 'and', 'for', 'with', 'from', 'this', 'that', 'into'].includes(w));
  }

  evaluate(action: string): GoalDriftResult {
    if (!this.originalGoal) {
      return {
        originalGoal: '',
        currentAction: action,
        preserved: true,
        driftDetected: false,
        deviationDescription: 'No goal set — cannot detect drift',
      };
    }

    const actionLower = action.toLowerCase();
    const matchingKeywords = this.goalKeywords.filter(kw => {
      const actionWords = actionLower.split(/\s+/).filter(w => w.length > 3);
      return actionWords.some(aw => {
        if (aw.includes(kw) || kw.includes(aw)) return true;
        const minLen = Math.min(aw.length, kw.length);
        const checkLen = Math.max(3, Math.floor(minLen * 0.6));
        return aw.slice(0, checkLen) === kw.slice(0, checkLen);
      });
    });
    const matchRatio = this.goalKeywords.length > 0 ? matchingKeywords.length / this.goalKeywords.length : 0;

    const driftDetected = matchRatio < 0.2 && action.length > 0;

    return {
      originalGoal: this.originalGoal,
      currentAction: action,
      preserved: !driftDetected,
      driftDetected,
      deviationDescription: driftDetected
        ? `Action has only ${Math.round(matchRatio * 100)}% keyword overlap with goal`
        : 'Action aligns with original goal',
    };
  }

  evaluateActionList(actions: string[]): { preserved: boolean; driftIndex: number; driftedActions: string[] } {
    const results = actions.map(a => this.evaluate(a));
    const driftedActions = results.filter(r => r.driftDetected).map(r => r.currentAction);
    const driftIndex = actions.length > 0 ? driftedActions.length / actions.length : 0;

    return {
      preserved: driftIndex < 0.2,
      driftIndex,
      driftedActions,
    };
  }

  detectScopeExpansion(originalTask: string, expandedTask: string): { expanded: boolean; addedScope: string[] } {
    const originalWords = new Set(originalTask.toLowerCase().split(/\s+/));
    const expandedWords = expandedTask.toLowerCase().split(/\s+/);
    const addedScope = expandedWords.filter(w => !originalWords.has(w) && w.length > 3);

    return {
      expanded: addedScope.length > 2,
      addedScope,
    };
  }
}
