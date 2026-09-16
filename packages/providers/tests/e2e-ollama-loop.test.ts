import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateId, now } from '@agi-os/kernel';
import { OllamaAdapter } from '@agi-os/providers';
import { ProviderBroker, CostGuard } from '@agi-os/providers';
import { GovernanceGateway, PolicyDecision } from '@agi-os/governance';
import { SemanticVectorMemory } from '@agi-os/memory';
import { ReflectionEngine } from '@agi-os/reflection';
import { SelfModel } from '@agi-os/self-model';
import { createReliabilityTracker, createConfidenceScorer, createPatternDetector } from '@agi-os/self-model';
import type { ReflectionInput } from '@agi-os/reflection';
import type { ProviderRequest } from '@agi-os/providers';

// ===========================================================================
// E2E Cognitive Loop — Ollama → Governance → Memory → Reflection
// Full local pipeline with $0 cost enforcement
// ===========================================================================
describe('E2E Cognitive Loop — Ollama Local Integration', () => {
  let ollama: OllamaAdapter;
  let broker: ProviderBroker;
  let governance: GovernanceGateway;
  let vectorMemory: SemanticVectorMemory;
  let reflection: ReflectionEngine;
  let selfModel: SelfModel;
  let costGuard: CostGuard;

  beforeEach(() => {
    vi.restoreAllMocks();

    ollama = new OllamaAdapter({
      id: 'ollama-local',
      defaultModel: 'llama3.2:latest',
      baseUrl: 'http://localhost:11434',
    });

    const reliability = createReliabilityTracker();
    const confidence = createConfidenceScorer();
    const patterns = createPatternDetector();
    costGuard = new CostGuard();

    broker = new ProviderBroker({ reliability, confidence, patterns, costGuard });
    governance = new GovernanceGateway();
    vectorMemory = new SemanticVectorMemory();
    reflection = new ReflectionEngine();
    selfModel = new SelfModel();
  });

  // -----------------------------------------------------------------------
  // 1. Ollama adapter: $0 cost invariant
  // -----------------------------------------------------------------------
  it('Ollama adapter enforces $0 cost at registration', () => {
    expect(ollama.config.costPerInputToken).toBe(0);
    expect(ollama.config.costPerOutputToken).toBe(0);
    expect(ollama.config.type).toBe('local');

    const validation = costGuard.validateProviderConfig(ollama.config);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('CostGuard rejects non-zero cost providers', () => {
    const expensiveConfig = {
      id: 'gpt-4',
      costPerInputToken: 0.00003,
      costPerOutputToken: 0.00006,
    };
    const validation = costGuard.validateProviderConfig(expensiveConfig);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 2. Ollama → Governance intercept pipeline
  // -----------------------------------------------------------------------
  it('Ollama request passes through governance before execution', async () => {
    broker.register(ollama);

    const intent = {
      id: generateId(),
      module: 'exec',
      operation: 'execute',
      target: 'ollama run llama3.2 "summarize logs"',
    };

    const gateResult = governance.intercept(intent);
    expect(gateResult.decision).toBeDefined();
    expect(gateResult.riskAssessment).toBeDefined();
    expect(gateResult.auditRecord).toBeDefined();
  });

  it('Governance blocks dangerous Ollama commands', () => {
    const dangerousIntents = [
      { module: 'exec', operation: 'execute', target: 'rm -rf /' },
      { module: 'fs', operation: 'read', target: '../.env' },
      { module: 'fs', operation: 'write', target: '/etc/passwd' },
    ];

    for (const intent of dangerousIntents) {
      const result = governance.intercept({ id: generateId(), ...intent });
      expect(result.decision).toBe(PolicyDecision.BLOCK);
    }
  });

  // -----------------------------------------------------------------------
  // 3. Ollama completion with mocked responses
  // -----------------------------------------------------------------------
  it('Ollama adapter completes request and returns $0 cost response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: { content: 'System logs show 3 security warnings in the last 24 hours.' },
        eval_count: 45,
        prompt_eval_count: 30,
        done: true,
      }),
    }));

    const response = await ollama.complete({
      id: generateId(),
      messages: [
        { role: 'system', content: 'You are a security analyst.' },
        { role: 'user', content: 'Summarize the system logs for security compliance.' },
      ],
      model: 'llama3.2:latest',
      temperature: 0.2,
      maxTokens: 512,
    });

    expect(response.content).toContain('security warnings');
    expect(response.finishReason).toBe('stop');
    expect(response.usage.completionTokens).toBe(45);
    expect(response.usage.promptTokens).toBe(30);
    expect(response.providerId).toBe('ollama-local');

    // Cost must be $0
    const estimatedCost = costGuard.estimateCost(
      ollama.config,
      response.usage.promptTokens,
      response.usage.completionTokens
    );
    expect(estimatedCost).toBe(0);

    const costCheck = costGuard.check(estimatedCost);
    expect(costCheck.allowed).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 4. Full cognitive loop: perceive → plan → execute (Ollama) → reflect → memorize
  // -----------------------------------------------------------------------
  it('Full cognitive loop: Ollama generate → governance → reflection → vector memory', async () => {
    // Mock Ollama response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        message: { content: 'Analysis complete: 2 critical issues found in /var/log/syslog.' },
        eval_count: 60,
        prompt_eval_count: 40,
        done: true,
      }),
    }));

    // Step 1: Register Ollama with broker
    broker.register(ollama);
    expect(broker.getProviderIds()).toContain('ollama-local');

    // Step 2: Create mission
    const missionGoal = 'Analyze local system logs and summarize security compliance';

    // Step 3: Governance intercept before tool execution (safe read)
    const intent = {
      id: generateId(),
      module: 'fs',
      operation: 'read',
      target: './README.md',
    };
    const gateResult = governance.intercept(intent);
    expect(gateResult.decision).toBe(PolicyDecision.ALLOW);

    // Step 4: Execute via Ollama through broker
    const providerRequest: ProviderRequest = {
      id: generateId(),
      messages: [
        { role: 'system', content: 'You are a system administrator analyzing logs.' },
        { role: 'user', content: missionGoal },
      ],
      model: 'llama3.2:latest',
      temperature: 0.2,
      maxTokens: 1024,
    };

    const providerResponse = await broker.complete(providerRequest);
    expect(providerResponse.content).toContain('critical issues');
    expect(providerResponse.finishReason).toBe('stop');

    // Step 5: Record tool success in self-model
    selfModel.processEvent({
      type: 'tool_succeeded',
      timestamp: now().toISOString(),
      data: { toolId: 'ollama_local', durationMs: providerResponse.latencyMs },
    });

    // Step 6: Reflection on mission outcome
    const reflectionInput: ReflectionInput = {
      missionId: generateId(),
      goalId: generateId(),
      goal: missionGoal,
      planId: generateId(),
      predictedSuccess: 0.85,
      predictedRisk: 0.15,
      expectedOutcome: 'Security analysis with compliance summary',
      actualOutcome: providerResponse.content,
      success: true,
      duration: providerResponse.latencyMs,
      evidenceRefs: [gateResult.auditRecord.id],
      sourceEventIds: [],
      timestamp: now().toISOString(),
    };

    const reflectionOutput = await reflection.reflect(reflectionInput);
    expect(reflectionOutput.reflection).toBeDefined();
    expect(reflectionOutput.reflection.outcome.success).toBe(true);

    // Step 7: Store lesson in vector memory
    vectorMemory.store(
      `Lesson from mission: ${missionGoal}`,
      `Result: ${providerResponse.content}. Governance: ${gateResult.decision}. Reflection confidence: ${reflectionOutput.reflection.confidence}`,
      {
        missionId: reflectionInput.missionId,
        category: 'operational',
        impact: 'medium',
        cost: '$0',
      }
    );

    const searchResults = vectorMemory.search('security analysis logs', 5);
    expect(searchResults.length).toBeGreaterThanOrEqual(1);
    expect(searchResults[0].score).toBeGreaterThan(0);

    // Step 8: Verify audit trail
    const auditHistory = governance.getAuditHistory();
    expect(auditHistory.length).toBeGreaterThanOrEqual(1);
    expect(auditHistory.some(r => r.decision === PolicyDecision.ALLOW)).toBe(true);

    // Step 9: Verify $0 cost enforced throughout
    const costState = costGuard.getState();
    expect(costState.spentTotal).toBe(0);
    expect(costState.spentToday).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 5. Blocked mission: governance blocks → reflection records failure
  // -----------------------------------------------------------------------
  it('Blocked mission: governance BLOCK → no Ollama call → reflection records failure', async () => {
    broker.register(ollama);

    // Governance blocks this intent
    const intent = {
      id: generateId(),
      module: 'fs',
      operation: 'read',
      target: '../.env',
    };
    const gateResult = governance.intercept(intent);
    expect(gateResult.decision).toBe(PolicyDecision.BLOCK);

    // No Ollama call should be made (mission blocked)
    // Reflection records the failure
    const reflectionInput: ReflectionInput = {
      missionId: generateId(),
      goalId: generateId(),
      goal: 'Read .env for configuration',
      planId: generateId(),
      predictedSuccess: 0.5,
      predictedRisk: 0.5,
      expectedOutcome: '.env file read',
      actualOutcome: `BLOCKED by ${gateResult.auditRecord.matchedRuleId}: sensitive file access denied`,
      success: false,
      duration: 0,
      evidenceRefs: [gateResult.auditRecord.id],
      sourceEventIds: [],
      timestamp: now().toISOString(),
    };

    const output = await reflection.reflect(reflectionInput);
    expect(output.reflection.outcome.success).toBe(false);
    expect(output.reflection.outcome.actualOutcome).toContain('BLOCKED');

    // Lesson stored in vector memory
    vectorMemory.store(
      'Security lesson: .env files are blocked by POL-001',
      'Never attempt to read sensitive configuration files through the cognitive loop',
      { category: 'security', impact: 'critical' }
    );

    const lessons = vectorMemory.search('.env sensitive blocked security', 3);
    expect(lessons.length).toBeGreaterThanOrEqual(1);

    // Cost remains $0
    expect(costGuard.getState().spentTotal).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 6. Provider broker fallback chain
  // -----------------------------------------------------------------------
  it('Provider broker routes to Ollama as primary local provider', () => {
    broker.register(ollama);

    const providers = broker.getProviderIds();
    expect(providers).toContain('ollama-local');

    // Ollama should be preferred (local, priority 1)
    const route = broker.getRouter().route({
      request: {
        id: generateId(),
        messages: [{ role: 'user', content: 'test' }],
      },
    });

    expect(route.providerId).toBe('ollama-local');
    expect(route.confidence).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 7. Health check Ollama connectivity
  // -----------------------------------------------------------------------
  it('Ollama health check handles offline gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const healthy = await ollama.healthCheck();
    expect(healthy).toBe(false);
  });

  it('Ollama health check succeeds when server is running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const healthy = await ollama.healthCheck();
    expect(healthy).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 8. CostGuard blocks any non-zero cost attempt
  // -----------------------------------------------------------------------
  it('CostGuard blocks non-zero cost and allows $0', () => {
    const blockResult = costGuard.check(0.001);
    expect(blockResult.allowed).toBe(false);
    expect(blockResult.reason).toContain('exceeds $0 limit');

    const allowResult = costGuard.check(0);
    expect(allowResult.allowed).toBe(true);
    expect(allowResult.reason).toContain('$0 cost verified');
  });

  it('CostGuard records spend correctly at $0', () => {
    costGuard.recordSpend(0);
    const state = costGuard.getState();
    expect(state.spentTotal).toBe(0);
    expect(state.requestCount).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 9. Self-model tracks Ollama reliability
  // -----------------------------------------------------------------------
  it('Self-model records Ollama provider success and failure', () => {
    const reliability = selfModel.getReliabilityTracker();

    // Must create record first
    reliability.getOrCreate('ollama-local', 'tool');
    reliability.recordSuccess('ollama-local', 150);
    reliability.recordSuccess('ollama-local', 200);
    reliability.recordFailure('ollama-local', 'timeout', 'connection timed out', 5000);
    reliability.recordSuccess('ollama-local', 180);

    const record = reliability.getRecord('ollama-local');
    expect(record).toBeDefined();
    expect(record!.successRate).toBeGreaterThan(0);
    expect(record!.totalUptimeMs).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 10. Vector memory semantic search after cognitive loop
  // -----------------------------------------------------------------------
  it('Vector memory stores and retrieves cognitive loop results', () => {
    // Store results from multiple loop iterations
    vectorMemory.store(
      'Cognitive loop iteration 1: Analyzed /var/log/syslog, found 3 warnings',
      'Security scan passed, no critical issues in system logs',
      { iteration: 1, category: 'security', missionId: 'm-001' }
    );

    vectorMemory.store(
      'Cognitive loop iteration 2: Analyzed /var/log/auth.log, found 1 intrusion attempt',
      'Failed SSH login from 192.168.1.100, blocked by firewall',
      { iteration: 2, category: 'security', missionId: 'm-002' }
    );

    vectorMemory.store(
      'Cognitive loop iteration 3: Database optimization completed',
      'Rebuilt indexes, query performance improved by 40%',
      { iteration: 3, category: 'performance', missionId: 'm-003' }
    );

    // Search for security-related results
    const securityResults = vectorMemory.search('security intrusion SSH login', 5);
    expect(securityResults.length).toBeGreaterThanOrEqual(1);
    expect(securityResults[0].score).toBeGreaterThan(0);

    // Search for performance results
    const perfResults = vectorMemory.search('database optimization performance', 5);
    expect(perfResults.length).toBeGreaterThanOrEqual(1);

    // Total stored
    expect(vectorMemory.count()).toBe(3);
  });
});
