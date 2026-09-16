export class MutationScoreTester {
  private testResults: Map<string, boolean> = new Map();
  private mutations: Map<string, string[]> = new Map();

  addTestResult(testId: string, passed: boolean): void {
    this.testResults.set(testId, passed);
  }

  addMutation(mutationId: string, killedBy: string[]): void {
    this.mutations.set(mutationId, killedBy);
  }

  calculateMutationScore(): {
    score: number;
    killed: number;
    survived: number;
    totalMutations: number;
  } {
    let killed = 0;
    let survived = 0;

    for (const [_, killedBy] of this.mutations) {
      if (killedBy.length > 0) {
        killed++;
      } else {
        survived++;
      }
    }

    const totalMutations = killed + survived;
    const score = totalMutations > 0 ? killed / totalMutations : 0;

    return { score, killed, survived, totalMutations };
  }

  detectUnguardedMutations(): string[] {
    const unguarded: string[] = [];

    for (const [mutationId, killedBy] of this.mutations) {
      if (killedBy.length === 0) {
        unguarded.push(mutationId);
      }
    }

    return unguarded;
  }
}
