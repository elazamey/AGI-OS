import type { StateMachineTransition, ImpossibleState } from "./types.js";

export class StateMachineExhaustiveTester {
  private transitions: StateMachineTransition[] = [];

  registerTransitions(transitions: StateMachineTransition[]): void {
    this.transitions = [...this.transitions, ...transitions];
  }

  validateAllTransitions(): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const t of this.transitions) {
      if (t.allowed) {
        valid.push(`${t.from} -> ${t.to}`);
      } else {
        invalid.push(`${t.from} -> ${t.to}`);
      }
    }

    return { valid, invalid };
  }

  testImpossibleStates(
    states: { mission: string; task: string }[]
  ): ImpossibleState[] {
    const impossibleStates: ImpossibleState[] = [];
    const seen = new Set<string>();

    for (const s of states) {
      const key = `${s.mission}:${s.task}`;
      if (seen.has(key)) {
        impossibleStates.push({
          mission: s.mission,
          task: s.task,
          reason: "duplicate state",
        });
      }
      seen.add(key);

      if (s.mission === "" || s.task === "") {
        impossibleStates.push({
          mission: s.mission,
          task: s.task,
          reason: "empty field",
        });
      }
    }

    return impossibleStates;
  }
}
