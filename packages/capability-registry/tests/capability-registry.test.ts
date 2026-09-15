import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityRegistry } from '../src/CapabilityRegistry';
import { PolicyGate, ExecutionContext } from '../src/PolicyGate';
import { HealthMonitor } from '../src/HealthMonitor';
import { MCPManifestLoader } from '../src/MCPManifestLoader';
import { CapabilityScanner } from '../src/CapabilityScanner';
import type { RepositoryCapability, MCPManifest } from '../src/types';

const CAP_123GIT: RepositoryCapability = {
  id: '123git-devops',
  repoName: '123git',
  type: 'mcp_service',
  category: 'devops',
  endpoint: 'http://localhost:5001/mcp',
  providedSkills: ['git_commit', 'create_pull_request', 'git_rollback'],
  healthCheckUrl: 'http://localhost:5001/health',
  policyRequirements: { requiresApproval: true, riskLevel: 'MEDIUM' },
  status: 'HEALTHY',
};

const CAP_CANYOU: RepositoryCapability = {
  id: 'canyou-governance',
  repoName: 'canyou',
  type: 'http_api',
  category: 'governance',
  endpoint: 'http://localhost:5002/api',
  providedSkills: ['policy_override', 'deny_request'],
  policyRequirements: { requiresApproval: true, riskLevel: 'CRITICAL' },
  status: 'HEALTHY',
};

const CAP_MIND_CORE: RepositoryCapability = {
  id: 'mind-core-cognition',
  repoName: 'mind-core',
  type: 'package',
  category: 'cognition',
  providedSkills: ['reason', 'plan', 'mcts_search'],
  policyRequirements: { requiresApproval: false, riskLevel: 'LOW' },
  status: 'HEALTHY',
};

const CAP_CELIA_MEMORY: RepositoryCapability = {
  id: 'celia-memory',
  repoName: 'celia-agent-system',
  type: 'mcp_service',
  category: 'memory',
  endpoint: 'http://localhost:5003/mcp',
  providedSkills: ['store_memory', 'retrieve_context', 'vector_search'],
  healthCheckUrl: 'http://localhost:5003/health',
  policyRequirements: { requiresApproval: false, riskLevel: 'LOW' },
  status: 'HEALTHY',
};

const CAP_CONNECTOR: RepositoryCapability = {
  id: 'connector-external',
  repoName: 'connector',
  type: 'http_api',
  category: 'connector',
  endpoint: 'http://localhost:5004/api',
  providedSkills: ['sync_external', 'webhook_receive'],
  policyRequirements: { requiresApproval: true, riskLevel: 'MEDIUM' },
  status: 'UNKNOWN',
};

const SAMPLE_MANIFEST: MCPManifest = {
  name: '123git-mcp',
  version: '1.0.0',
  description: 'Git operations MCP server',
  tools: [
    { name: 'git_commit', description: 'Create a git commit', inputSchema: { message: 'string' } },
    { name: 'create_pull_request', description: 'Open a PR', inputSchema: { title: 'string', branch: 'string' } },
    { name: 'git_rollback', description: 'Rollback to commit', inputSchema: { commitHash: 'string' } },
  ],
  endpoint: 'http://localhost:5001/mcp',
};

// ═══════════════════════════════════════════════════════
// CapabilityRegistry
// ═══════════════════════════════════════════════════════

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => { registry = new CapabilityRegistry(); });

  it('should register and discover capabilities', () => {
    registry.registerCapability(CAP_123GIT);
    registry.registerCapability(CAP_CANYOU);

    expect(registry.getCapabilityCount()).toBe(2);
    expect(registry.getCapability('123git-devops')?.repoName).toBe('123git');
    expect(registry.getCapability('canyou-governance')?.category).toBe('governance');
  });

  it('should query by category', () => {
    registry.registerCapability(CAP_123GIT);
    registry.registerCapability(CAP_MIND_CORE);
    registry.registerCapability(CAP_CELIA_MEMORY);

    const devops = registry.getCapabilitiesByCategory('devops');
    expect(devops).toHaveLength(1);
    expect(devops[0].repoName).toBe('123git');

    const cognition = registry.getCapabilitiesByCategory('cognition');
    expect(cognition).toHaveLength(1);
    expect(cognition[0].repoName).toBe('mind-core');
  });

  it('should find provider for a skill', () => {
    registry.registerCapability(CAP_123GIT);
    registry.registerCapability(CAP_MIND_CORE);

    const prProvider = registry.findProviderForSkill('create_pull_request');
    expect(prProvider?.id).toBe('123git-devops');

    const planProvider = registry.findProviderForSkill('plan');
    expect(planProvider?.id).toBe('mind-core-cognition');
  });

  it('should find multiple providers for skills', () => {
    registry.registerCapability(CAP_123GIT);
    registry.registerCapability(CAP_CELIA_MEMORY);

    const providers = registry.findProvidersForSkills(['git_commit', 'vector_search', 'store_memory']);
    expect(providers).toHaveLength(2);
  });

  it('should unregister capabilities', () => {
    registry.registerCapability(CAP_123GIT);
    registry.registerCapability(CAP_CANYOU);

    expect(registry.unregisterCapability('123git-devops')).toBe(true);
    expect(registry.getCapabilityCount()).toBe(1);
    expect(registry.findProviderForSkill('git_commit')).toBeUndefined();
  });

  it('should return false for unregistering non-existent capability', () => {
    expect(registry.unregisterCapability('nonexistent')).toBe(false);
  });

  it('should update capability status', () => {
    registry.registerCapability(CAP_123GIT);
    registry.updateStatus('123git-devops', 'DOWN');
    expect(registry.getCapability('123git-devops')?.status).toBe('DOWN');
  });

  it('should return category breakdown', () => {
    registry.registerCapability(CAP_123GIT);
    registry.registerCapability(CAP_MIND_CORE);
    registry.registerCapability(CAP_CELIA_MEMORY);
    registry.registerCapability(CAP_CONNECTOR);

    const breakdown = registry.getCategoryBreakdown();
    expect(breakdown.devops).toBe(1);
    expect(breakdown.cognition).toBe(1);
    expect(breakdown.memory).toBe(1);
    expect(breakdown.connector).toBe(1);
  });

  it('should track skill count', () => {
    registry.registerCapability(CAP_123GIT);
    registry.registerCapability(CAP_MIND_CORE);
    expect(registry.getSkillCount()).toBe(6);
  });

  it('should query by type', () => {
    registry.registerCapability(CAP_123GIT);
    registry.registerCapability(CAP_MIND_CORE);
    registry.registerCapability(CAP_CANYOU);

    const mcp = registry.getCapabilitiesByType('mcp_service');
    expect(mcp).toHaveLength(1);
    const pkgs = registry.getCapabilitiesByType('package');
    expect(pkgs).toHaveLength(1);
  });

  it('should return healthy capabilities only', () => {
    registry.registerCapability(CAP_123GIT);
    registry.registerCapability(CAP_CONNECTOR);
    const healthy = registry.getHealthyCapabilities();
    expect(healthy).toHaveLength(1);
    expect(healthy[0].id).toBe('123git-devops');
  });
});

// ═══════════════════════════════════════════════════════
// PolicyGate
// ═══════════════════════════════════════════════════════

describe('PolicyGate', () => {
  let policyGate: PolicyGate;

  beforeEach(() => { policyGate = new PolicyGate(); });

  it('should block CRITICAL without approval', () => {
    const decision = policyGate.evaluate(CAP_CANYOU, { userApproved: false });
    expect(decision.allowed).toBe(false);
    expect(decision.riskLevel).toBe('CRITICAL');
  });

  it('should allow CRITICAL with approval', () => {
    const decision = policyGate.evaluate(CAP_CANYOU, { userApproved: true });
    expect(decision.allowed).toBe(true);
  });

  it('should allow LOW without approval', () => {
    const decision = policyGate.evaluate(CAP_MIND_CORE, { userApproved: false });
    expect(decision.allowed).toBe(true);
  });

  it('should block MEDIUM without approval (requiresApproval=true)', () => {
    const decision = policyGate.evaluate(CAP_123GIT, { userApproved: false });
    expect(decision.allowed).toBe(false);
    expect(decision.requiresApproval).toBe(true);
  });

  it('should allow MEDIUM with approval', () => {
    const decision = policyGate.evaluate(CAP_123GIT, { userApproved: true });
    expect(decision.allowed).toBe(true);
  });

  it('should block DOWN capabilities', () => {
    const downCap = { ...CAP_123GIT, status: 'DOWN' as const };
    const decision = policyGate.evaluate(downCap, { userApproved: true });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('DOWN');
  });

  it('should support risk override', () => {
    const decision = policyGate.evaluate(CAP_MIND_CORE, { userApproved: false, riskOverride: 'CRITICAL' });
    expect(decision.allowed).toBe(false);
    expect(decision.riskLevel).toBe('CRITICAL');
  });

  it('should bulk evaluate', () => {
    const results = policyGate.bulkEvaluate([CAP_123GIT, CAP_CANYOU, CAP_MIND_CORE], { userApproved: false });
    expect(results).toHaveLength(3);
    expect(results[0].allowed).toBe(false);
    expect(results[1].allowed).toBe(false);
    expect(results[2].allowed).toBe(true);
  });

  it('should track approval log', () => {
    policyGate.evaluate(CAP_123GIT, { userApproved: false });
    policyGate.evaluate(CAP_MIND_CORE, { userApproved: false });
    expect(policyGate.getApprovalCount()).toBe(2);
  });

  it('should calculate approval rate', () => {
    policyGate.evaluate(CAP_CANYOU, { userApproved: true });
    policyGate.evaluate(CAP_123GIT, { userApproved: false });
    expect(policyGate.getApprovalRate()).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════
// HealthMonitor
// ═══════════════════════════════════════════════════════

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;

  beforeEach(() => { monitor = new HealthMonitor({ retriesBeforeDown: 3 }); });

  it('should simulate healthy status', () => {
    const result = monitor.simulateHealth(CAP_123GIT, 'HEALTHY', 50);
    expect(result.status).toBe('HEALTHY');
    expect(result.latencyMs).toBe(50);
  });

  it('should simulate degraded status', () => {
    const result = monitor.simulateHealth(CAP_123GIT, 'DEGRADED', 2000);
    expect(result.status).toBe('DEGRADED');
  });

  it('should simulate down status', () => {
    const result = monitor.simulateHealth(CAP_123GIT, 'DOWN');
    expect(result.status).toBe('DOWN');
  });

  it('should track health history', () => {
    monitor.simulateHealth(CAP_123GIT, 'HEALTHY');
    monitor.simulateHealth(CAP_123GIT, 'DEGRADED');

    const history = monitor.getHealthHistory('123git-devops');
    expect(history).toHaveLength(2);
    expect(history[0].status).toBe('HEALTHY');
    expect(history[1].status).toBe('DEGRADED');
  });

  it('should return last health check', () => {
    monitor.simulateHealth(CAP_123GIT, 'HEALTHY');
    monitor.simulateHealth(CAP_123GIT, 'DEGRADED');

    const last = monitor.getLastHealthCheck('123git-devops');
    expect(last?.status).toBe('DEGRADED');
  });

  it('should return undefined for unknown capability', () => {
    expect(monitor.getLastHealthCheck('nonexistent')).toBeUndefined();
    expect(monitor.getHealthHistory('nonexistent')).toHaveLength(0);
  });

  it('should find unhealthy capabilities', () => {
    const caps = [CAP_123GIT, CAP_CANYOU];
    monitor.simulateHealth(CAP_123GIT, 'DOWN');
    monitor.simulateHealth(CAP_CANYOU, 'HEALTHY');

    const unhealthy = monitor.getUnhealthyCapabilities(caps);
    expect(unhealthy).toHaveLength(1);
    expect(unhealthy[0].id).toBe('123git-devops');
  });

  it('should handle capabilities without endpoints', async () => {
    const noEndpoint = { ...CAP_MIND_CORE, endpoint: undefined, healthCheckUrl: undefined };
    const result = await monitor.checkHealth(noEndpoint);
    expect(result.status).toBe('UNKNOWN');
  });

  it('should check all health in batch', async () => {
    const caps = [CAP_123GIT, CAP_MIND_CORE];
    const results = await monitor.checkAllHealth(caps);
    expect(results).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════
// MCPManifestLoader
// ═══════════════════════════════════════════════════════

describe('MCPManifestLoader', () => {
  let loader: MCPManifestLoader;

  beforeEach(() => { loader = new MCPManifestLoader(); });

  it('should load manifest', () => {
    loader.loadManifest('123git-devops', SAMPLE_MANIFEST);
    expect(loader.getManifestCount()).toBe(1);
    expect(loader.getManifest('123git-devops')?.name).toBe('123git-mcp');
  });

  it('should load from JSON string', () => {
    const json = JSON.stringify(SAMPLE_MANIFEST);
    expect(loader.loadFromJSON('123git-devops', json)).toBe(true);
    expect(loader.getManifestCount()).toBe(1);
  });

  it('should reject invalid JSON', () => {
    expect(loader.loadFromJSON('123git-devops', '{invalid}')).toBe(false);
    expect(loader.loadFromJSON('123git-devops', '{"name":"x"}')).toBe(false);
  });

  it('should get tools for capability', () => {
    loader.loadManifest('123git-devops', SAMPLE_MANIFEST);
    const tools = loader.getToolsForCapability('123git-devops');
    expect(tools).toHaveLength(3);
    expect(tools[0].name).toBe('git_commit');
  });

  it('should find tool by name', () => {
    loader.loadManifest('123git-devops', SAMPLE_MANIFEST);
    const result = loader.findToolByName('create_pull_request');
    expect(result?.capabilityId).toBe('123git-devops');
    expect(result?.tool.description).toContain('PR');
  });

  it('should return undefined for unknown tool', () => {
    expect(loader.findToolByName('nonexistent')).toBeUndefined();
  });

  it('should convert to capability', () => {
    loader.loadManifest('123git-devops', SAMPLE_MANIFEST);
    const cap = loader.convertToCapability('123git-devops', '123git', 'devops');
    expect(cap).toBeDefined();
    expect(cap?.providedSkills).toHaveLength(3);
    expect(cap?.type).toBe('mcp_service');
  });

  it('should return undefined for unknown manifest conversion', () => {
    expect(loader.convertToCapability('nonexistent', 'x', 'devops')).toBeUndefined();
  });

  it('should count total tools', () => {
    loader.loadManifest('123git-devops', SAMPLE_MANIFEST);
    expect(loader.getTotalToolCount()).toBe(3);
  });

  it('should get all manifests', () => {
    loader.loadManifest('123git-devops', SAMPLE_MANIFEST);
    loader.loadManifest('canyou', { ...SAMPLE_MANIFEST, name: 'canyou-mcp' });
    expect(loader.getAllManifests()).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════
// CapabilityScanner
// ═══════════════════════════════════════════════════════

describe('CapabilityScanner', () => {
  let registry: CapabilityRegistry;
  let scanner: CapabilityScanner;

  beforeEach(() => {
    registry = new CapabilityRegistry();
    scanner = new CapabilityScanner(registry);
  });

  it('should scan and register repos', () => {
    const repos = [
      { name: '123git', category: 'devops' as const, skills: ['git_commit', 'create_pr'], riskLevel: 'MEDIUM' as const, type: 'mcp_service' as const },
      { name: 'mind-core', category: 'cognition' as const, skills: ['reason', 'plan'], riskLevel: 'LOW' as const, type: 'package' as const },
    ];

    const registered = scanner.scanAndRegister(repos);
    expect(registered).toHaveLength(2);
    expect(registry.getCapabilityCount()).toBe(2);
    expect(registry.getCapability('123git-auto')?.repoName).toBe('123git');
  });

  it('should infer risk from category', () => {
    scanner.scanAndRegister([
      { name: 'canyou', category: 'governance', skills: ['policy'], riskLevel: 'LOW', type: 'http_api' },
      { name: '123git', category: 'devops', skills: ['git'], riskLevel: 'LOW', type: 'mcp_service' },
      { name: 'mind-core', category: 'cognition', skills: ['reason'], riskLevel: 'LOW', type: 'package' },
    ]);

    const gov = registry.getCapability('canyou-auto');
    expect(gov?.policyRequirements.riskLevel).toBe('HIGH');
  });

  it('should scan from manifests', () => {
    const manifests = [
      { id: '123git-devops', repoName: '123git', category: 'devops' as const, skills: ['git_commit'], endpoint: 'http://localhost:5001/mcp' },
    ];

    const caps = scanner.scanFromManifest(manifests);
    expect(caps).toHaveLength(1);
    expect(caps[0].type).toBe('mcp_service');
  });

  it('should track scanned repos', () => {
    scanner.scanAndRegister([
      { name: '123git', category: 'devops', skills: ['git_commit'], riskLevel: 'MEDIUM', type: 'mcp_service' },
    ]);

    expect(scanner.getScannedRepos()).toHaveLength(1);
    expect(scanner.getScannedRepos()[0].name).toBe('123git');
  });
});

// ═══════════════════════════════════════════════════════
// Integration: Full Mission Flow
// ═══════════════════════════════════════════════════════

describe('Integration: Full Mission Flow', () => {
  it('should register, evaluate policy, check health, then decide', () => {
    const registry = new CapabilityRegistry();
    const policyGate = new PolicyGate();
    const monitor = new HealthMonitor();
    const scanner = new CapabilityScanner(registry);

    scanner.scanAndRegister([
      { name: '123git', category: 'devops', skills: ['git_commit', 'create_pr'], riskLevel: 'MEDIUM', type: 'mcp_service', endpoint: 'http://localhost:5001/mcp' },
      { name: 'mind-core', category: 'cognition', skills: ['reason', 'plan'], riskLevel: 'LOW', type: 'package' },
      { name: 'canyou', category: 'governance', skills: ['policy_override'], riskLevel: 'CRITICAL', type: 'http_api', endpoint: 'http://localhost:5002/api' },
    ]);

    // Health checks
    monitor.simulateHealth(registry.getCapability('123git-auto')!, 'HEALTHY');
    monitor.simulateHealth(registry.getCapability('mind-core-auto')!, 'HEALTHY');
    monitor.simulateHealth(registry.getCapability('canyou-auto')!, 'HEALTHY');

    // Policy checks
    const devops = registry.findProviderForSkill('git_commit')!;
    const cognition = registry.findProviderForSkill('reason')!;
    const governance = registry.findProviderForSkill('policy_override')!;

    expect(policyGate.evaluateExecutionPermission(devops, { userApproved: false })).toBe(false);
    expect(policyGate.evaluateExecutionPermission(cognition, { userApproved: false })).toBe(true);
    expect(policyGate.evaluateExecutionPermission(governance, { userApproved: false })).toBe(false);
    expect(policyGate.evaluateExecutionPermission(governance, { userApproved: true })).toBe(true);

    expect(registry.getCapabilityCount()).toBe(3);
    expect(monitor.getHealthHistory('123git-auto')).toHaveLength(1);
  });
});
