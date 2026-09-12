import { createGovernanceGateway } from '@agi-os/governance';
import { createSelfModel } from '@agi-os/self-model';
import { createReflectionEngine } from '@agi-os/reflection';
import { createKernel } from '@agi-os/kernel';
import { createSemanticVectorMemory } from '@agi-os/memory';

let gateway: ReturnType<typeof createGovernanceGateway> | null = null;
let selfModel: ReturnType<typeof createSelfModel> | null = null;
let reflectionEngine: ReturnType<typeof createReflectionEngine> | null = null;
let kernelInstance: ReturnType<typeof createKernel> | null = null;
let vectorMemory: ReturnType<typeof createSemanticVectorMemory> | null = null;

export function getGovernance() {
  if (!gateway) gateway = createGovernanceGateway();
  return gateway!;
}

export function getSelfModel() {
  if (!selfModel) selfModel = createSelfModel();
  return selfModel!;
}

export function getReflection() {
  if (!reflectionEngine) reflectionEngine = createReflectionEngine();
  return reflectionEngine!;
}

export function getKernel() {
  if (!kernelInstance) kernelInstance = createKernel();
  return kernelInstance!;
}

export function getVectorMemory() {
  if (!vectorMemory) vectorMemory = createSemanticVectorMemory();
  return vectorMemory!;
}

export function seedDemoData() {
  const gov = getGovernance();
  const intents = [
    { module: 'fs', operation: 'read', target: './src/index.ts' },
    { module: 'fs', operation: 'write', target: './output/result.json' },
    { module: 'db', operation: 'insert', target: 'users' },
    { module: 'exec', operation: 'execute', target: 'rm -rf /' },
    { module: 'fs', operation: 'read', target: '../.env' },
    { module: 'network', operation: 'fetch', target: 'https://api.example.com' },
    { module: 'git', operation: 'force-push', target: 'origin main' },
    { module: 'fs', operation: 'write', target: '/etc/passwd' },
    { module: 'db', operation: 'drop', target: 'production_users' },
    { module: 'exec', operation: 'execute', target: 'chmod 777 /var/log' },
    { module: 'fs', operation: 'read', target: './config.json' },
    { module: 'network', operation: 'fetch', target: 'https://api.openai.com/v1/models' },
    { module: 'db', operation: 'read', target: 'audit_logs' },
    { module: 'fs', operation: 'write', target: './tests/output.json' },
    { module: 'exec', operation: 'execute', target: 'cat /etc/shadow' },
  ];
  for (const intent of intents) {
    gov.intercept({
      id: `intent-${Math.random().toString(36).slice(2, 10)}`,
      ...intent,
    });
  }

  const sm = getSelfModel();
  sm.getConfidenceScorer().record('filesystem', 0.85, 'mission-1');
  sm.getConfidenceScorer().record('database', 0.72, 'mission-2');
  sm.getConfidenceScorer().record('network', 0.65, 'mission-3');
  sm.getConfidenceScorer().record('execution', 0.91, 'mission-4');
  sm.getConfidenceScorer().record('git', 0.78, 'mission-5');
  sm.getConfidenceScorer().record('filesystem', 0.88, 'mission-6');
  sm.getConfidenceScorer().record('database', 0.69, 'mission-7');

  sm.getReliabilityTracker().recordSuccess('fs-tool', 12);
  sm.getReliabilityTracker().recordSuccess('fs-tool', 8);
  sm.getReliabilityTracker().recordFailure('fs-tool', 'ENOENT', 'file not found', 5);
  sm.getReliabilityTracker().recordSuccess('db-tool', 15);
  sm.getReliabilityTracker().recordSuccess('db-tool', 20);
  sm.getReliabilityTracker().recordSuccess('exec-tool', 30);
  sm.getReliabilityTracker().recordFailure('exec-tool', 'TIMEOUT', 'command timed out', 60);
  sm.getReliabilityTracker().recordFailure('exec-tool', 'EACCES', 'permission denied', 10);
  sm.getReliabilityTracker().recordSuccess('exec-tool', 25);
  sm.getReliabilityTracker().recordSuccess('network-tool', 45);
  sm.getReliabilityTracker().recordSuccess('network-tool', 50);

  const vm = getVectorMemory();
  vm.store('lesson-1', 'Always validate file paths before writing to prevent path traversal attacks', { category: 'security', impact: 'critical' });
  vm.store('lesson-2', 'Database operations should use parameterized queries to prevent SQL injection', { category: 'security', impact: 'high' });
  vm.store('lesson-3', 'Network requests should have timeout limits to prevent hanging', { category: 'reliability', impact: 'medium' });
  vm.store('lesson-4', 'Git force-push should require human approval in production', { category: 'process', impact: 'high' });
  vm.store('lesson-5', 'Sensitive files like .env and /etc/shadow must always be blocked', { category: 'security', impact: 'critical' });
  vm.store('lesson-6', 'Use exponential backoff for retry logic on transient failures', { category: 'reliability', impact: 'medium' });
  vm.store('lesson-7', 'Log all governance decisions for audit trail compliance', { category: 'compliance', impact: 'high' });
  vm.store('fact-1', 'CostGuard blocks any non-zero cost provider at registration time', { category: 'architecture', impact: 'critical' });
  vm.store('fact-2', 'EventLoop yields via setTimeout(r, 1) between iterations', { category: 'architecture', impact: 'low' });
  vm.store('fact-3', 'Governance intercept latency is under 5ms for all intent types', { category: 'performance', impact: 'medium' });
}

let seeded = false;
export function ensureSeeded() {
  if (!seeded) {
    seedDemoData();
    seeded = true;
  }
}
