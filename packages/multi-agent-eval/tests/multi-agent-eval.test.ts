import { describe, it, expect } from "vitest";
import {
  CoordinationEvaluator,
  ConflictDetector,
  SwarmCollapseTester,
  ParallelismSafetyTester,
  DelegationEvaluator,
} from "../src/index.js";

describe("CoordinationEvaluator", () => {
  const evaluator = new CoordinationEvaluator();

  it("should assign tasks to capable agents", () => {
    const agents = [
      { id: "a1", capabilities: ["code", "test"] },
      { id: "a2", capabilities: ["design"] },
    ];
    const tasks = [
      { id: "t1", requiredCapability: "code" },
      { id: "t2", requiredCapability: "design" },
    ];
    const result = evaluator.assignTasks(agents, tasks);
    expect(result.assignments["a1"]).toContain("t1");
    expect(result.assignments["a2"]).toContain("t2");
    expect(result.unassignedTasks).toHaveLength(0);
  });

  it("should detect unassigned tasks when no agent has capability", () => {
    const agents = [{ id: "a1", capabilities: ["code"] }];
    const tasks = [{ id: "t1", requiredCapability: "design" }];
    const result = evaluator.assignTasks(agents, tasks);
    expect(result.unassignedTasks).toContain("t1");
  });

  it("should calculate delegation accuracy", () => {
    const assignments = { a1: ["t1"], a2: ["t2"], a3: [] };
    const accuracy = evaluator.calculateDelegationAccuracy(assignments);
    expect(accuracy).toBeCloseTo(2 / 3);
  });

  it("should return 0 accuracy for empty assignments", () => {
    const assignments = { a1: [], a2: [] };
    expect(evaluator.calculateDelegationAccuracy(assignments)).toBe(0);
  });
});

describe("ConflictDetector", () => {
  const detector = new ConflictDetector();

  it("should detect conflicts when multiple agents target same resource", () => {
    const actions = [
      { agentId: "a1", target: "file1", action: "write" },
      { agentId: "a2", target: "file1", action: "write" },
    ];
    const result = detector.detectConflicts(actions);
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe("file1");
  });

  it("should not detect conflict for single agent", () => {
    const actions = [{ agentId: "a1", target: "file1", action: "write" }];
    expect(detector.detectConflicts(actions)).toHaveLength(0);
  });

  it("should detect severity levels based on agent count", () => {
    const actions = [
      { agentId: "a1", target: "file1", action: "write" },
      { agentId: "a2", target: "file1", action: "write" },
      { agentId: "a3", target: "file1", action: "write" },
    ];
    const result = detector.detectConflicts(actions);
    expect(result[0].severity).toBe("high");
  });

  it("should detect file conflicts for write operations", () => {
    const actions = [
      { agentId: "a1", file: "f1.txt", operation: "write" },
      { agentId: "a2", file: "f1.txt", operation: "write" },
    ];
    const result = detector.detectFileConflicts(actions);
    expect(result.conflicts).toContain("f1.txt");
    expect(result.resolutionNeeded).toBe(true);
  });

  it("should not detect file conflict for read-only operations", () => {
    const actions = [
      { agentId: "a1", file: "f1.txt", operation: "read" },
      { agentId: "a2", file: "f1.txt", operation: "read" },
    ];
    const result = detector.detectFileConflicts(actions);
    expect(result.conflicts).toHaveLength(0);
  });

  it("should handle empty actions", () => {
    expect(detector.detectConflicts([])).toHaveLength(0);
    expect(detector.detectFileConflicts([]).conflicts).toHaveLength(0);
  });
});

describe("SwarmCollapseTester", () => {
  const tester = new SwarmCollapseTester();

  it("should simulate agent failure correctly", () => {
    const result = tester.simulateFailure(["a1", "a2"], ["a1", "a2", "a3"]);
    expect(result.healthy).toEqual(["a3"]);
    expect(result.failed).toEqual(["a1", "a2"]);
    expect(result.needsReallocation).toBe(true);
  });

  it("should not need reallocation when no failures", () => {
    const result = tester.simulateFailure([], ["a1", "a2"]);
    expect(result.needsReallocation).toBe(false);
  });

  it("should detect deadlock when all agents waiting", () => {
    const states = { a1: "waiting", a2: "blocked" };
    const result = tester.detectDeadlock(states);
    expect(result.deadlocked).toBe(true);
    expect(result.stuckAgents).toContain("a1");
    expect(result.stuckAgents).toContain("a2");
  });

  it("should not detect deadlock when agents are active", () => {
    const states = { a1: "running", a2: "idle" };
    const result = tester.detectDeadlock(states);
    expect(result.deadlocked).toBe(false);
  });

  it("should recover tasks with redistribution", () => {
    const result = tester.recover("sup1", ["a1", "a2"], ["t1", "t2", "t3"]);
    expect(result.redistributed).toBe(true);
    expect(result.coverage).toBeGreaterThan(0);
  });

  it("should not redistribute when no failures", () => {
    const result = tester.recover("sup1", [], ["t1"]);
    expect(result.redistributed).toBe(false);
    expect(result.coverage).toBe(1);
  });
});

describe("ParallelismSafetyTester", () => {
  const tester = new ParallelismSafetyTester();

  it("should detect write conflicts", () => {
    const actions = [
      { agentId: "a1", file: "f1", operation: "write" },
      { agentId: "a2", file: "f1", operation: "write" },
    ];
    const result = tester.detectWriteConflicts(actions);
    expect(result.safe).toBe(false);
    expect(result.conflicts).toContain("f1");
  });

  it("should report safe for non-overlapping writes", () => {
    const actions = [
      { agentId: "a1", file: "f1", operation: "write" },
      { agentId: "a2", file: "f2", operation: "write" },
    ];
    const result = tester.detectWriteConflicts(actions);
    expect(result.safe).toBe(true);
  });

  it("should detect race conditions from overlapping timelines", () => {
    const timelines = [
      { agentId: "a1", steps: [{ time: 0, action: "read" }, { time: 5, action: "write" }] },
      { agentId: "a2", steps: [{ time: 3, action: "read" }, { time: 7, action: "write" }] },
    ];
    const result = tester.detectRaceConditions(timelines);
    expect(result.races).toContain("read");
    expect(result.races).toContain("write");
  });

  it("should report safe for non-overlapping timelines", () => {
    const timelines = [
      { agentId: "a1", steps: [{ time: 0, action: "read" }] },
      { agentId: "a2", steps: [{ time: 100, action: "read" }] },
    ];
    const result = tester.detectRaceConditions(timelines);
    expect(result.safe).toBe(true);
  });
});

describe("DelegationEvaluator", () => {
  const evaluator = new DelegationEvaluator();

  it("should allow valid delegation", () => {
    const result = evaluator.evaluateDelegation(
      ["read", "write", "execute"],
      ["read", "write"]
    );
    expect(result.allowed).toEqual(["read", "write"]);
    expect(result.escalated).toBe(false);
  });

  it("should deny unauthorized delegation", () => {
    const result = evaluator.evaluateDelegation(
      ["read"],
      ["read", "admin"]
    );
    expect(result.denied).toContain("admin");
    expect(result.escalated).toBe(true);
  });

  it("should detect privilege escalation", () => {
    const delegations = [
      { from: "a1", to: "a2", permissions: ["admin"] },
    ];
    const result = evaluator.detectPrivilegeEscalation(delegations);
    expect(result.escalated).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("should handle empty permissions", () => {
    const result = evaluator.evaluateDelegation([], []);
    expect(result.allowed).toHaveLength(0);
    expect(result.escalated).toBe(false);
  });

  it("should not escalate when all permissions are valid", () => {
    const result = evaluator.evaluateDelegation(
      ["read", "write", "delete"],
      ["read", "write"]
    );
    expect(result.escalated).toBe(false);
    expect(result.denied).toHaveLength(0);
  });
});
