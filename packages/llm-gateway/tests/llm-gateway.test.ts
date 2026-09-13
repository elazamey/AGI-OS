import { describe, it, expect, beforeEach } from 'vitest';
import { LLMGateway, CostGuard } from '../src/index.js';

describe('LLMGateway', () => {
  let gateway: LLMGateway;

  beforeEach(() => {
    gateway = new LLMGateway({
      maxSpend: 0,
      defaultProvider: 'ollama',
      ollamaUrl: 'http://127.0.0.1:11434',
      ollamaModel: 'llama3.2:3b',
    });
  });

  it('should create with default config', () => {
    const defaultGateway = new LLMGateway();
    expect(defaultGateway).toBeDefined();
    expect(defaultGateway.getDefaultProvider()).toBe('ollama');
  });

  it('should create with custom config', () => {
    expect(gateway).toBeDefined();
    expect(gateway.getMaxSpend()).toBe(0);
    expect(gateway.getRemainingBudget()).toBe(0);
  });

  it('should block non-ollama providers when MAX_SPEND is 0', async () => {
    await expect(
      gateway.generate({
        prompt: 'test',
        forcedProvider: 'gemini',
      })
    ).rejects.toThrow('Security Violation');
  });

  it('should block groq when MAX_SPEND is 0', async () => {
    await expect(
      gateway.generate({
        prompt: 'test',
        forcedProvider: 'groq',
      })
    ).rejects.toThrow('Security Violation');
  });

  it('should block unsupported provider with cost guard', async () => {
    await expect(
      gateway.generate({
        prompt: 'test',
        forcedProvider: 'openai-compatible' as any,
      })
    ).rejects.toThrow('Security Violation');
  });

  it('should track total cost', () => {
    expect(gateway.getTotalCost()).toBe(0);
  });
});

describe('LLMGateway with budget', () => {
  it('should allow requests within budget', () => {
    const gateway = new LLMGateway({ maxSpend: 100 });
    expect(gateway.getRemainingBudget()).toBe(100);
  });
});

describe('CostGuard', () => {
  let costGuard: CostGuard;

  beforeEach(() => {
    costGuard = new CostGuard({
      maxSpend: 100,
      alertThreshold: 0.8,
      hardLimit: true,
    });
  });

  it('should create with config', () => {
    expect(costGuard).toBeDefined();
  });

  it('should check budget within limits', () => {
    expect(costGuard.checkBudget('ollama', 50)).toBe(true);
  });

  it('should reject when over budget', () => {
    expect(costGuard.checkBudget('ollama', 150)).toBe(false);
  });

  it('should record usage', () => {
    costGuard.recordUsage({
      requestId: 'req-1',
      provider: 'ollama',
      model: 'llama3.2:3b',
      cost: 0,
      timestamp: Date.now(),
    });

    expect(costGuard.getTotalCost()).toBe(0);
    expect(costGuard.getRecords()).toHaveLength(1);
  });

  it('should track total cost', () => {
    costGuard.recordUsage({
      requestId: 'req-1',
      provider: 'gemini',
      model: 'gemini-pro',
      cost: 10,
      timestamp: Date.now(),
    });

    costGuard.recordUsage({
      requestId: 'req-2',
      provider: 'groq',
      model: 'llama3-70b',
      cost: 5,
      timestamp: Date.now(),
    });

    expect(costGuard.getTotalCost()).toBe(15);
    expect(costGuard.getRemainingBudget()).toBe(85);
  });

  it('should detect over budget', () => {
    costGuard.recordUsage({
      requestId: 'req-1',
      provider: 'gemini',
      model: 'gemini-pro',
      cost: 110,
      timestamp: Date.now(),
    });

    expect(costGuard.isOverBudget()).toBe(true);
  });

  it('should detect near threshold', () => {
    costGuard.recordUsage({
      requestId: 'req-1',
      provider: 'gemini',
      model: 'gemini-pro',
      cost: 85,
      timestamp: Date.now(),
    });

    expect(costGuard.isNearThreshold()).toBe(true);
  });

  it('should filter records by provider', () => {
    costGuard.recordUsage({
      requestId: 'req-1',
      provider: 'ollama',
      model: 'llama3.2:3b',
      cost: 0,
      timestamp: Date.now(),
    });

    costGuard.recordUsage({
      requestId: 'req-2',
      provider: 'gemini',
      model: 'gemini-pro',
      cost: 10,
      timestamp: Date.now(),
    });

    expect(costGuard.getRecordsByProvider('ollama')).toHaveLength(1);
    expect(costGuard.getRecordsByProvider('gemini')).toHaveLength(1);
    expect(costGuard.getRecordsByProvider('groq')).toHaveLength(0);
  });

  it('should reset records', () => {
    costGuard.recordUsage({
      requestId: 'req-1',
      provider: 'gemini',
      model: 'gemini-pro',
      cost: 10,
      timestamp: Date.now(),
    });

    costGuard.reset();
    expect(costGuard.getTotalCost()).toBe(0);
    expect(costGuard.getRecords()).toHaveLength(0);
  });
});
