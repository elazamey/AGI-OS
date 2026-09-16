import { describe, it, expect, beforeEach } from 'vitest';
import { BugAutoFixMission, WebResearchMission, CostGuardMission } from '../src/index.js';

describe('BugAutoFixMission', () => {
  let mission: BugAutoFixMission;

  beforeEach(() => {
    mission = new BugAutoFixMission({
      issueNumber: 1,
      issueTitle: 'Fix undefined return in buggy function',
      issueBody: 'The function crashes when called with null input',
      repository: 'test/repo',
    });
  });

  it('should create mission with config', () => {
    expect(mission).toBeDefined();
    expect(mission.getConfig().name).toBe('Bug Auto-Fix');
  });

  it('should execute mission successfully', async () => {
    const result = await mission.execute();
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(5);
    expect(result.evidence).toHaveLength(5);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should have all required steps', async () => {
    const result = await mission.execute();
    const stepIds = result.steps.map(s => s.stepId);
    expect(stepIds).toContain('analyze');
    expect(stepIds).toContain('locate');
    expect(stepIds).toContain('fix');
    expect(stepIds).toContain('verify');
    expect(stepIds).toContain('create-pr');
  });

  it('should generate evidence for each step', async () => {
    const result = await mission.execute();
    const evidenceTypes = result.evidence.map(e => e.type);
    expect(evidenceTypes).toContain('issue-analysis');
    expect(evidenceTypes).toContain('code-location');
    expect(evidenceTypes).toContain('code-fix');
    expect(evidenceTypes).toContain('fix-verification');
    expect(evidenceTypes).toContain('pr-creation');
  });
});

describe('WebResearchMission', () => {
  let mission: WebResearchMission;

  beforeEach(() => {
    mission = new WebResearchMission({
      url: 'https://example.com',
      query: 'AI research',
    });
  });

  it('should create mission with config', () => {
    expect(mission).toBeDefined();
    expect(mission.getConfig().name).toBe('Web Research & Summarize');
  });

  it('should execute mission successfully', async () => {
    const result = await mission.execute();
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(5);
    expect(result.evidence).toHaveLength(5);
  });

  it('should have all required steps', async () => {
    const result = await mission.execute();
    const stepIds = result.steps.map(s => s.stepId);
    expect(stepIds).toContain('navigate');
    expect(stepIds).toContain('extract');
    expect(stepIds).toContain('analyze');
    expect(stepIds).toContain('summarize');
    expect(stepIds).toContain('save');
  });

  it('should generate evidence for each step', async () => {
    const result = await mission.execute();
    const evidenceTypes = result.evidence.map(e => e.type);
    expect(evidenceTypes).toContain('page-navigation');
    expect(evidenceTypes).toContain('content-extraction');
    expect(evidenceTypes).toContain('content-analysis');
    expect(evidenceTypes).toContain('content-summary');
    expect(evidenceTypes).toContain('results-saved');
  });
});

describe('CostGuardMission', () => {
  let mission: CostGuardMission;

  beforeEach(() => {
    mission = new CostGuardMission({
      maxSpend: 0,
      provider: 'gemini',
    });
  });

  it('should create mission with config', () => {
    expect(mission).toBeDefined();
    expect(mission.getConfig().name).toBe('Cost Guard Enforcement');
  });

  it('should execute mission successfully', async () => {
    const result = await mission.execute();
    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(5);
    expect(result.evidence).toHaveLength(5);
  });

  it('should have all required steps', async () => {
    const result = await mission.execute();
    const stepIds = result.steps.map(s => s.stepId);
    expect(stepIds).toContain('init');
    expect(stepIds).toContain('test-ollama');
    expect(stepIds).toContain('test-blocked');
    expect(stepIds).toContain('verify-budget');
    expect(stepIds).toContain('generate-report');
  });

  it('should verify cost guard blocks cloud providers', async () => {
    const result = await mission.execute();
    const blockedStep = result.steps.find(s => s.stepId === 'test-blocked');
    expect(blockedStep?.success).toBe(true);
    expect((blockedStep?.data as any).blocked).toBe(true);
  });

  it('should verify budget is within limits', async () => {
    const result = await mission.execute();
    const budgetStep = result.steps.find(s => s.stepId === 'verify-budget');
    expect(budgetStep?.success).toBe(true);
    expect((budgetStep?.data as any).withinBudget).toBe(true);
  });

  it('should generate cost guard report', async () => {
    const result = await mission.execute();
    const reportStep = result.steps.find(s => s.stepId === 'generate-report');
    expect(reportStep?.success).toBe(true);
    expect((reportStep?.data as any).costGuardStatus).toBe('ENFORCED');
  });
});
