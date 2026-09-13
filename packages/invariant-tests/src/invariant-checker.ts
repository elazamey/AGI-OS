export class InvariantChecker {
  private invariants: Map<string, () => boolean> = new Map();

  register(invariantId: string, check: () => boolean): void {
    this.invariants.set(invariantId, check);
  }

  checkAll(): { passed: string[]; failed: string[]; allPass: boolean } {
    const passed: string[] = [];
    const failed: string[] = [];

    for (const [id, check] of this.invariants) {
      if (check()) {
        passed.push(id);
      } else {
        failed.push(id);
      }
    }

    return { passed, failed, allPass: failed.length === 0 };
  }

  check(invariantId: string): boolean {
    const check = this.invariants.get(invariantId);
    if (!check) {
      throw new Error(`Invariant ${invariantId} not found`);
    }
    return check();
  }
}
