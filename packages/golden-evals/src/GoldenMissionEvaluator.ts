export interface MissionScenario {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  category: 'bug_fix' | 'feature' | 'refactor' | 'security' | 'optimization';
  context: {
    repository: string;
    branch: string;
    files: string[];
    test_command: string;
  };
  requirements: string[];
  success_criteria: string[];
  timeout_seconds: number;
}

export interface MissionResult {
  mission_id: string;
  status: 'success' | 'failure' | 'timeout' | 'partial';
  autonomous: boolean;
  tool_calls: number;
  duration_ms: number;
  attempts: number;
  self_healing_loops: number;
  files_modified: string[];
  tests_passed: boolean;
  error?: string;
}

export interface BenchmarkResult {
  total_missions: number;
  successful: number;
  failed: number;
  timeout: number;
  partial: number;
  autonomous_rate: number;
  avg_duration_ms: number;
  avg_tool_calls: number;
  avg_self_healing_loops: number;
  by_difficulty: Record<string, { total: number; successful: number; rate: number }>;
  by_category: Record<string, { total: number; successful: number; rate: number }>;
}

export class GoldenMissionEvaluator {
  private scenarios: MissionScenario[] = [];
  private results: MissionResult[] = [];

  constructor() {
    this.loadDefaultScenarios();
  }

  private loadDefaultScenarios(): void {
    this.scenarios = [
      {
        id: 'bug-fix-001',
        name: 'Fix Null Pointer Exception',
        description: 'Fix a null pointer exception in user authentication module',
        difficulty: 'easy',
        category: 'bug_fix',
        context: {
          repository: 'test-repo',
          branch: 'main',
          files: ['src/auth/login.ts'],
          test_command: 'npm test',
        },
        requirements: ['Identify root cause', 'Write fix', 'Add test case'],
        success_criteria: ['All tests pass', 'No null pointer errors'],
        timeout_seconds: 300,
      },
      {
        id: 'feature-001',
        name: 'Implement Rate Limiting',
        description: 'Add rate limiting to API endpoints',
        difficulty: 'medium',
        category: 'feature',
        context: {
          repository: 'test-repo',
          branch: 'main',
          files: ['src/api/middleware.ts'],
          test_command: 'npm test',
        },
        requirements: ['Implement sliding window', 'Add Redis integration', 'Write tests'],
        success_criteria: ['Rate limiting works', 'Tests pass', 'No performance degradation'],
        timeout_seconds: 600,
      },
      {
        id: 'security-001',
        name: 'Fix SQL Injection Vulnerability',
        description: 'Fix SQL injection vulnerability in user search',
        difficulty: 'hard',
        category: 'security',
        context: {
          repository: 'test-repo',
          branch: 'main',
          files: ['src/db/users.ts'],
          test_command: 'npm test',
        },
        requirements: ['Identify injection point', 'Implement parameterized queries', 'Add security tests'],
        success_criteria: ['No SQL injection possible', 'All tests pass', 'Security scan clean'],
        timeout_seconds: 600,
      },
      {
        id: 'optimization-001',
        name: 'Optimize Database Queries',
        description: 'Optimize slow database queries in product listing',
        difficulty: 'expert',
        category: 'optimization',
        context: {
          repository: 'test-repo',
          branch: 'main',
          files: ['src/db/products.ts'],
          test_command: 'npm test',
        },
        requirements: ['Profile queries', 'Add indexes', 'Implement caching'],
        success_criteria: ['Query time reduced by 50%', 'All tests pass', 'No N+1 queries'],
        timeout_seconds: 900,
      },
    ];
  }

  addScenario(scenario: MissionScenario): void {
    this.scenarios.push(scenario);
  }

  getScenario(id: string): MissionScenario | undefined {
    return this.scenarios.find(s => s.id === id);
  }

  getAllScenarios(): MissionScenario[] {
    return [...this.scenarios];
  }

  getScenariosByDifficulty(difficulty: MissionScenario['difficulty']): MissionScenario[] {
    return this.scenarios.filter(s => s.difficulty === difficulty);
  }

  getScenariosByCategory(category: MissionScenario['category']): MissionScenario[] {
    return this.scenarios.filter(s => s.category === category);
  }

  async evaluateMission(
    scenario: MissionScenario,
    agentFn: (context: MissionScenario['context']) => Promise<string>
  ): Promise<MissionResult> {
    const startTime = Date.now();
    const toolCalls = 0;
    const attempts = 0;
    const selfHealingLoops = 0;
    const filesModified: string[] = [];

    try {
      const result = await agentFn(scenario.context);
      const durationMs = Date.now() - startTime;

      const missionResult: MissionResult = {
        mission_id: scenario.id,
        status: 'success',
        autonomous: true,
        tool_calls: toolCalls,
        duration_ms: durationMs,
        attempts,
        self_healing_loops: selfHealingLoops,
        files_modified: filesModified,
        tests_passed: true,
      };

      this.results.push(missionResult);
      return missionResult;
    } catch (error) {
      const durationMs = Date.now() - startTime;

      const missionResult: MissionResult = {
        mission_id: scenario.id,
        status: 'failure',
        autonomous: false,
        tool_calls: toolCalls,
        duration_ms: durationMs,
        attempts,
        self_healing_loops: selfHealingLoops,
        files_modified: filesModified,
        tests_passed: false,
        error: error instanceof Error ? error.message : String(error),
      };

      this.results.push(missionResult);
      return missionResult;
    }
  }

  getBenchmarkResult(): BenchmarkResult {
    const total = this.results.length;
    const successful = this.results.filter(r => r.status === 'success').length;
    const failed = this.results.filter(r => r.status === 'failure').length;
    const timeout = this.results.filter(r => r.status === 'timeout').length;
    const partial = this.results.filter(r => r.status === 'partial').length;

    const byDiff = this.groupByDifficulty();
    const byCat = this.groupByCategory();

    return {
      total_missions: total,
      successful,
      failed,
      timeout,
      partial,
      autonomous_rate: total > 0 ? successful / total : 0,
      avg_duration_ms: this.avgDuration(),
      avg_tool_calls: this.avgToolCalls(),
      avg_self_healing_loops: this.avgSelfHealingLoops(),
      by_difficulty: byDiff,
      by_category: byCat,
    };
  }

  private groupByDifficulty(): Record<string, { total: number; successful: number; rate: number }> {
    const result: Record<string, { total: number; successful: number; rate: number }> = {};

    for (const scenario of this.scenarios) {
      if (!result[scenario.difficulty]) {
        result[scenario.difficulty] = { total: 0, successful: 0, rate: 0 };
      }
      result[scenario.difficulty].total++;
    }

    for (const r of this.results) {
      const scenario = this.scenarios.find(s => s.id === r.mission_id);
      if (scenario && r.status === 'success') {
        result[scenario.difficulty].successful++;
      }
    }

    for (const key in result) {
      const { total, successful } = result[key];
      result[key].rate = total > 0 ? successful / total : 0;
    }

    return result;
  }

  private groupByCategory(): Record<string, { total: number; successful: number; rate: number }> {
    const result: Record<string, { total: number; successful: number; rate: number }> = {};

    for (const scenario of this.scenarios) {
      if (!result[scenario.category]) {
        result[scenario.category] = { total: 0, successful: 0, rate: 0 };
      }
      result[scenario.category].total++;
    }

    for (const r of this.results) {
      const scenario = this.scenarios.find(s => s.id === r.mission_id);
      if (scenario && r.status === 'success') {
        result[scenario.category].successful++;
      }
    }

    for (const key in result) {
      const { total, successful } = result[key];
      result[key].rate = total > 0 ? successful / total : 0;
    }

    return result;
  }

  private avgDuration(): number {
    if (this.results.length === 0) return 0;
    return this.results.reduce((sum, r) => sum + r.duration_ms, 0) / this.results.length;
  }

  private avgToolCalls(): number {
    if (this.results.length === 0) return 0;
    return this.results.reduce((sum, r) => sum + r.tool_calls, 0) / this.results.length;
  }

  private avgSelfHealingLoops(): number {
    if (this.results.length === 0) return 0;
    return this.results.reduce((sum, r) => sum + r.self_healing_loops, 0) / this.results.length;
  }

  getResults(): MissionResult[] {
    return [...this.results];
  }

  clearResults(): void {
    this.results = [];
  }
}
