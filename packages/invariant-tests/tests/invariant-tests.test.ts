import { describe, it, expect } from "vitest";
import {
  StateMachineExhaustiveTester,
  EventOrderingTester,
  PermissionMatrixTester,
  MutationScoreTester,
  InvariantChecker,
} from "../src/index.js";

describe("StateMachineExhaustiveTester", () => {
  const tester = new StateMachineExhaustiveTester();

  it("should validate allowed transitions", () => {
    tester.registerTransitions([
      { from: "idle", to: "running", allowed: true },
      { from: "running", to: "done", allowed: true },
    ]);
    const result = tester.validateAllTransitions();
    expect(result.valid).toHaveLength(2);
    expect(result.invalid).toHaveLength(0);
  });

  it("should validate invalid transitions", () => {
    tester.registerTransitions([{ from: "done", to: "idle", allowed: false }]);
    const result = tester.validateAllTransitions();
    expect(result.invalid).toContain("done -> idle");
  });

  it("should detect impossible states from duplicates", () => {
    const states = [
      { mission: "m1", task: "t1" },
      { mission: "m1", task: "t1" },
    ];
    const result = tester.testImpossibleStates(states);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe("duplicate state");
  });

  it("should detect impossible states from empty fields", () => {
    const states = [{ mission: "", task: "t1" }];
    const result = tester.testImpossibleStates(states);
    expect(result).toHaveLength(1);
    expect(result[0].reason).toBe("empty field");
  });
});

describe("EventOrderingTester", () => {
  const tester = new EventOrderingTester();

  it("should validate correct order", () => {
    const events = [
      { id: "e1", timestamp: 1, type: "start" },
      { id: "e2", timestamp: 2, type: "end" },
    ];
    const result = tester.validateOrder(events);
    expect(result.ordered).toBe(true);
  });

  it("should detect order violations", () => {
    const events = [
      { id: "e1", timestamp: 5, type: "start" },
      { id: "e2", timestamp: 2, type: "end" },
    ];
    const result = tester.validateOrder(events);
    expect(result.ordered).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("should detect duplicate event IDs", () => {
    const events = [{ id: "e1" }, { id: "e1" }, { id: "e2" }];
    const result = tester.detectDuplicates(events);
    expect(result.duplicates).toContain("e1");
    expect(result.uniqueCount).toBe(2);
  });

  it("should detect stale events", () => {
    const now = Date.now();
    const events = [
      { id: "e1", timestamp: now - 100000, maxAge: 1000 },
      { id: "e2", timestamp: now, maxAge: 1000 },
    ];
    const result = tester.detectStaleEvents(events);
    expect(result.stale).toContain("e1");
    expect(result.fresh).toContain("e2");
  });

  it("should handle empty events", () => {
    expect(tester.validateOrder([]).ordered).toBe(true);
    expect(tester.detectDuplicates([]).duplicates).toHaveLength(0);
  });
});

describe("PermissionMatrixTester", () => {
  const tester = new PermissionMatrixTester();

  it("should create matrix and check permission", () => {
    tester.createMatrix([
      { actor: "user1", resource: "file1", action: "read", allowed: true },
    ]);
    const result = tester.checkPermission("user1", "file1", "read");
    expect(result.allowed).toBe(true);
    expect(result.exists).toBe(true);
  });

  it("should return not found for missing permission", () => {
    const result = tester.checkPermission("user1", "file1", "delete");
    expect(result.exists).toBe(false);
  });

  it("should test all combinations", () => {
    tester.createMatrix([
      { actor: "u1", resource: "r1", action: "read", allowed: true },
      { actor: "u1", resource: "r1", action: "write", allowed: false },
    ]);
    const result = tester.testAllCombinations("u1", ["r1"], ["read", "write"]);
    expect(result.allowed).toContain("r1:read");
    expect(result.denied).toContain("r1:write");
  });

  it("should detect permission conflicts", () => {
    tester.createMatrix([
      { actor: "u1", resource: "r1", action: "read", allowed: true },
      { actor: "u1", resource: "r1", action: "read", allowed: false },
    ]);
    const result = tester.detectConflicts();
    expect(result.conflicts).toContain("u1:r1:read");
  });
});

describe("MutationScoreTester", () => {
  const tester = new MutationScoreTester();

  it("should calculate mutation score", () => {
    tester.addTestResult("t1", true);
    tester.addMutation("m1", ["t1"]);
    tester.addMutation("m2", []);
    const result = tester.calculateMutationScore();
    expect(result.killed).toBe(1);
    expect(result.survived).toBe(1);
    expect(result.score).toBe(0.5);
  });

  it("should detect unguarded mutations", () => {
    tester.addMutation("m1", ["t1"]);
    tester.addMutation("m2", []);
    tester.addMutation("m3", []);
    const unguarded = tester.detectUnguardedMutations();
    expect(unguarded).toContain("m2");
    expect(unguarded).toContain("m3");
  });

  it("should handle empty mutations", () => {
    const freshTester = new MutationScoreTester();
    const result = freshTester.calculateMutationScore();
    expect(result.score).toBe(0);
    expect(result.totalMutations).toBe(0);
  });
});

describe("InvariantChecker", () => {
  const checker = new InvariantChecker();

  it("should register and check passing invariants", () => {
    checker.register("inv1", () => true);
    checker.register("inv2", () => true);
    const result = checker.checkAll();
    expect(result.allPass).toBe(true);
    expect(result.passed).toContain("inv1");
    expect(result.passed).toContain("inv2");
  });

  it("should detect failing invariants", () => {
    checker.register("inv3", () => false);
    const result = checker.checkAll();
    expect(result.allPass).toBe(false);
    expect(result.failed).toContain("inv3");
  });

  it("should check individual invariant", () => {
    checker.register("inv4", () => 1 + 1 === 2);
    expect(checker.check("inv4")).toBe(true);
  });

  it("should throw for unknown invariant", () => {
    expect(() => checker.check("unknown")).toThrow();
  });
});
