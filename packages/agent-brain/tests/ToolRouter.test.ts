import { describe, it, expect } from 'vitest';
import { ToolRouter } from '../src/ToolRouter.js';

describe('ToolRouter', () => {
  const router = new ToolRouter();

  it('should parse response', () => {
    const response = JSON.stringify({
      action: 'complete',
      reasoning: 'Task done',
      confidence: 1.0,
    });

    const decision = router.parseResponse(response);
    expect(decision.action).toBe('complete');
  });

  it('should validate valid decision', () => {
    const decision = { action: 'execute_skill' as const, skillId: 'fs.read', reasoning: 'test', confidence: 0.9 };
    expect(router.validateDecision(decision, ['fs.read', 'fs.write'])).toBe(true);
  });

  it('should reject invalid skill', () => {
    const decision = { action: 'execute_skill' as const, skillId: 'unknown', reasoning: 'test', confidence: 0.9 };
    expect(router.validateDecision(decision, ['fs.read'])).toBe(false);
  });

  it('should reject missing skillId', () => {
    const decision = { action: 'execute_skill' as const, reasoning: 'test', confidence: 0.9 };
    expect(router.validateDecision(decision, ['fs.read'])).toBe(false);
  });
});
