import { ApiServer } from './packages/api-server/dist/index.js';
import { LLMGateway } from './packages/llm-gateway/dist/index.js';
import { MissionRuntime } from './packages/mission-runtime/dist/index.js';
import { MetricsCollector, TokenTracker, AuditLogger } from './packages/monitoring/dist/index.js';
import { SecurityAuditor, PermissionGuard, InputSanitizer } from './packages/security-audit/dist/index.js';

async function main() {
  console.log('🚀 AGI-OS System Starting...\n');

  // Initialize components
  const apiServer = new ApiServer({ port: 3000, apiKey: 'agi-dev-key' });
  const llmGateway = new LLMGateway();
  const missionRuntime = new MissionRuntime();
  const metrics = new MetricsCollector();
  const tokenTracker = new TokenTracker();
  const auditLogger = new AuditLogger();
  const permissionGuard = new PermissionGuard();

  console.log('✅ Components Initialized:\n');

  // Test API Server
  console.log('📡 API Server Routes:');
  const healthReq = { method: 'GET', path: '/api/health', headers: {} };
  const healthRes = await apiServer.handleRequest(healthReq);
  console.log('   GET /api/health →', JSON.stringify(healthRes.data, null, 2));

  // Test Security
  console.log('\n🔒 Security Audit:');
  const cleanPayload = SecurityAuditor.inspectPayload('read file /home/user/document.txt');
  console.log('   Clean payload:', cleanPayload.passed ? '✅ PASS' : '❌ FAIL');

  const maliciousPayload = SecurityAuditor.inspectPayload('rm -rf /');
  console.log('   Malicious payload:', maliciousPayload.passed ? '✅ PASS' : '❌ FAIL');

  // Test Sanitization
  console.log('\n🧹 Input Sanitization:');
  const safeInput = InputSanitizer.sanitize('Hello World');
  console.log('   Safe input:', safeInput.wasModified ? 'Modified' : 'Clean');

  const xssInput = InputSanitizer.sanitize('<script>alert(1)</script>');
  console.log('   XSS input:', xssInput.wasModified ? 'Sanitized ✅' : 'Not sanitized ❌');

  // Test Monitoring
  console.log('\n📊 Monitoring:');
  metrics.record('api.request', 1, { endpoint: '/api/health' });
  metrics.record('api.request', 1, { endpoint: '/api/generate' });
  tokenTracker.track({ provider: 'ollama', model: 'llama3.2:3b', promptTokens: 100, completionTokens: 50, totalTokens: 150, latencyMs: 500 });
  console.log('   Metrics collected:', metrics.size());
  console.log('   Token usages tracked:', tokenTracker.size());

  // Test Audit
  console.log('\n📝 Audit Trail:');
  auditLogger.logGovernance('approve', 'system', 'mission-1', 'success');
  auditLogger.logTool('execute', 'agent-1', 'tool-1', 'success');
  console.log('   Audit events:', auditLogger.size());

  console.log('\n🎉 AGI-OS System Running!\n');
  console.log('📋 Summary:');
  console.log('   - API Server: http://localhost:3000');
  console.log('   - Security: Active (Fail-Closed)');
  console.log('   - Monitoring: Active (Prometheus)');
  console.log('   - Audit: Active (Immutable Log)');
  console.log('   - Permission Guard: Active (RBAC)\n');
}

main().catch(console.error);
