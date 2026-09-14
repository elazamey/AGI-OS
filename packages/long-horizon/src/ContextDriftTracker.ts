export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: number;
  tokens_used: number;
}

export interface SessionMetrics {
  session_id: string;
  total_tool_calls: number;
  unique_tools: string[];
  goal: string;
  goal_retention_score: number;
  loop_detected: boolean;
  loop_pattern?: string;
  context_drift_score: number;
  memory_retrieval_accuracy: number;
  duration_ms: number;
}

export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: number;
  tool_call_id: string;
  importance: number;
}

export class ContextDriftTracker {
  private toolCalls: ToolCall[] = [];
  private memory: MemoryEntry[] = [];
  private goal: string = '';
  private sessionId: string = '';
  private loopThreshold: number = 3;

  constructor() {
    this.sessionId = `session-${Date.now()}`;
  }

  startSession(goal: string): void {
    this.goal = goal;
    this.toolCalls = [];
    this.memory = [];
    this.sessionId = `session-${Date.now()}`;
  }

  recordToolCall(call: Omit<ToolCall, 'id' | 'timestamp'>): ToolCall {
    const fullCall: ToolCall = {
      ...call,
      id: `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    this.toolCalls.push(fullCall);
    return fullCall;
  }

  storeMemory(content: string, toolCallId: string, importance: number = 0.5): MemoryEntry {
    const entry: MemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      timestamp: Date.now(),
      tool_call_id: toolCallId,
      importance,
    };
    this.memory.push(entry);
    return entry;
  }

  retrieveMemory(query: string): MemoryEntry[] {
    const queryLower = query.toLowerCase();
    return this.memory
      .filter(m => m.content.toLowerCase().includes(queryLower))
      .sort((a, b) => b.importance - a.importance);
  }

  detectLoop(): { detected: boolean; pattern?: string; count: number } {
    if (this.toolCalls.length < this.loopThreshold) {
      return { detected: false, count: 0 };
    }

    const recent = this.toolCalls.slice(-this.loopThreshold);
    const names = recent.map(c => c.name);

    const allSame = names.every(n => n === names[0]);
    if (allSame) {
      return {
        detected: true,
        pattern: names[0],
        count: names.length,
      };
    }

    if (this.toolCalls.length >= this.loopThreshold * 2) {
      const prev = this.toolCalls.slice(-this.loopThreshold * 2, -this.loopThreshold);
      const prevNames = prev.map(c => c.name);
      if (JSON.stringify(names) === JSON.stringify(prevNames)) {
        return {
          detected: true,
          pattern: names.join(' -> '),
          count: this.loopThreshold * 2,
        };
      }
    }

    return { detected: false, count: 0 };
  }

  calculateGoalRetention(): number {
    if (this.toolCalls.length === 0) return 1;

    const goalKeywords = this.goal.toLowerCase().split(/\s+/);
    let relevantCalls = 0;

    for (const call of this.toolCalls) {
      const callStr = JSON.stringify(call.args).toLowerCase() + call.name.toLowerCase();
      const hasKeyword = goalKeywords.some(kw => callStr.includes(kw));
      if (hasKeyword) relevantCalls++;
    }

    return relevantCalls / this.toolCalls.length;
  }

  calculateContextDrift(): number {
    if (this.toolCalls.length < 2) return 0;

    const firstHalf = this.toolCalls.slice(0, Math.floor(this.toolCalls.length / 2));
    const secondHalf = this.toolCalls.slice(Math.floor(this.toolCalls.length / 2));

    const firstTools = new Set(firstHalf.map(c => c.name));
    const secondTools = new Set(secondHalf.map(c => c.name));

    const intersection = new Set([...firstTools].filter(t => secondTools.has(t)));
    const union = new Set([...firstTools, ...secondTools]);

    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 1;

    return 1 - jaccardSimilarity;
  }

  calculateMemoryAccuracy(): number {
    if (this.memory.length === 0) return 1;

    let retrievedCorrectly = 0;
    for (const mem of this.memory) {
      const results = this.retrieveMemory(mem.content.substring(0, 20));
      if (results.some(r => r.id === mem.id)) {
        retrievedCorrectly++;
      }
    }

    return retrievedCorrectly / this.memory.length;
  }

  getSessionMetrics(): SessionMetrics {
    const uniqueTools = [...new Set(this.toolCalls.map(c => c.name))];
    const loop = this.detectLoop();

    return {
      session_id: this.sessionId,
      total_tool_calls: this.toolCalls.length,
      unique_tools: uniqueTools,
      goal: this.goal,
      goal_retention_score: this.calculateGoalRetention(),
      loop_detected: loop.detected,
      loop_pattern: loop.pattern,
      context_drift_score: this.calculateContextDrift(),
      memory_retrieval_accuracy: this.calculateMemoryAccuracy(),
      duration_ms: this.toolCalls.length > 0
        ? this.toolCalls[this.toolCalls.length - 1].timestamp - this.toolCalls[0].timestamp
        : 0,
    };
  }

  getToolCalls(): ToolCall[] {
    return [...this.toolCalls];
  }

  getMemory(): MemoryEntry[] {
    return [...this.memory];
  }

  clear(): void {
    this.toolCalls = [];
    this.memory = [];
  }
}
