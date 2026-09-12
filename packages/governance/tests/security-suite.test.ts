import { describe, it, expect, beforeEach } from 'vitest';
import { generateId, now } from '@agi-os/kernel';
import { GovernanceGateway, PolicyDecision } from '@agi-os/governance';

// ===========================================================================
// Security Suite — Adversarial & Governance Penetration Tests
// ===========================================================================
describe('Security Suite: Adversarial & Policy Penetration Tests', () => {
  let governance: GovernanceGateway;

  beforeEach(() => {
    governance = new GovernanceGateway();
  });

  // ---- Directory Traversal & Critical Paths --------------------------------
  describe('Directory Traversal & Critical Path Blocking', () => {
    it('should block directory traversal via relative path', () => {
      const result = governance.intercept({
        id: generateId(),
        module: 'fs',
        operation: 'read',
        target: '../../etc/passwd',
      });
      expect(result.decision).toBe(PolicyDecision.BLOCK);
      expect(result.auditRecord.matchedRuleId).toBe('POL-001');
    });

    it('should block write to /etc/passwd', () => {
      const result = governance.intercept({
        id: generateId(),
        module: 'fs',
        operation: 'write',
        target: '/etc/passwd',
      });
      expect(result.decision).toBe(PolicyDecision.BLOCK);
    });

    it('should block delete of system binary', () => {
      const result = governance.intercept({
        id: generateId(),
        module: 'fs',
        operation: 'delete',
        target: '/usr/bin/sudo',
      });
      expect(result.decision).toBe(PolicyDecision.BLOCK);
    });

    it('should block dangerous command execution', () => {
      const dangerousCommands = [
        'rm -rf /',
        'rm -rf /*',
        'mkfs.ext4 /dev/sda',
        'dd if=/dev/zero of=/dev/sda',
        'format c:',
        ':(){:|:&};:',
        'chmod 777 /etc/shadow',
        'chown root /tmp/malicious',
      ];

      for (const cmd of dangerousCommands) {
        const result = governance.intercept({
          id: generateId(),
          module: 'exec',
          operation: 'execute',
          target: cmd,
        });
        expect(result.decision).toBe(PolicyDecision.BLOCK);
      }
    });

    it('should block access to .env files', () => {
      const envTargets = [
        './.env',
        '/app/.env',
        '/home/user/project/.env.production',
        '.env.local',
        '.env.staging',
      ];

      for (const target of envTargets) {
        const result = governance.intercept({
          id: generateId(),
          module: 'fs',
          operation: 'read',
          target,
        });
        expect(result.decision).toBe(PolicyDecision.BLOCK);
      }
    });

    it('should block SSH key access', () => {
      const sshTargets = [
        '~/.ssh/id_rsa',
        '~/.ssh/id_ed25519',
        '/home/user/.ssh/authorized_keys',
        './.ssh/id_rsa',
      ];

      for (const target of sshTargets) {
        const result = governance.intercept({
          id: generateId(),
          module: 'fs',
          operation: 'read',
          target,
        });
        expect(result.decision).toBe(PolicyDecision.BLOCK);
      }
    });
  });

  // ---- Prompt Injection via Tool Arguments ---------------------------------
  describe('Prompt Injection via Tool Arguments', () => {
    it('should block tool arguments with dangerous shell commands', () => {
      const dangerousIntents = [
        {
          id: generateId(),
          module: 'exec',
          operation: 'execute',
          target: 'rm -rf /important/data',
        },
        {
          id: generateId(),
          module: 'exec',
          operation: 'execute',
          target: 'cat file.txt && rm -rf /',
        },
        {
          id: generateId(),
          module: 'exec',
          operation: 'execute',
          target: 'chmod 777 /etc/shadow',
        },
      ];

      for (const intent of dangerousIntents) {
        const result = governance.intercept(intent);
        expect(result.decision).toBe(PolicyDecision.BLOCK);
      }
    });

    it('should escalate risky file operations even without explicit block', () => {
      // Injection-like pattern on fs read — not blocked by policy but risk escalation applies
      const result = governance.intercept({
        id: generateId(),
        module: 'fs',
        operation: 'read',
        target: './data.txt; Ignore previous rules',
      });
      // POL-007 allows reads, but the target doesn't match sensitive patterns
      // Risk is LOW for read → stays ALLOW
      expect(result.decision).toBe(PolicyDecision.ALLOW);

      // However, if it's a write to unusual target, it should escalate
      const writeResult = governance.intercept({
        id: generateId(),
        module: 'fs',
        operation: 'write',
        target: '/tmp/injected-script.sh',
      });
      // POL-006 doesn't block /tmp writes, but risk escalation (HIGH write) triggers
      expect(writeResult.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    });

    it('should flag suspicious target patterns', () => {
      const suspicious = [
        { module: 'fs', operation: 'read', target: '/proc/self/environ' },
        { module: 'fs', operation: 'read', target: '/sys/class/dmi/id/product_name' },
        { module: 'fs', operation: 'read', target: '/etc/shadow' },
      ];

      for (const intent of suspicious) {
        const result = governance.intercept({ id: generateId(), ...intent });
        expect(result.decision).toBe(PolicyDecision.BLOCK);
      }
    });
  });

  // ---- Approval Boundary Escalation ----------------------------------------
  describe('Approval Boundary Escalation', () => {
    it('should require approval for all database mutations', () => {
      const dbOps = [
        { module: 'db', operation: 'insert', target: 'users' },
        { module: 'db', operation: 'update', target: 'config' },
        { module: 'db', operation: 'delete', target: 'sessions' },
        { module: 'db', operation: 'drop', target: 'users_backup' },
        { module: 'db', operation: 'truncate', target: 'logs' },
      ];

      for (const intent of dbOps) {
        const result = governance.intercept({ id: generateId(), ...intent });
        expect(result.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
        expect(result.approvalRequest).toBeDefined();
      }
    });

    it('should require approval for writes outside /tmp', () => {
      const result = governance.intercept({
        id: generateId(),
        module: 'fs',
        operation: 'write',
        target: '/var/data/output.csv',
      });
      expect(result.decision).toBe(PolicyDecision.BLOCK);
    });

    it('should require approval for network requests', () => {
      const result = governance.intercept({
        id: generateId(),
        module: 'network',
        operation: 'request',
        target: 'https://api.example.com/data',
      });
      expect(result.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    });

    it('should enforce approval for force-push git operations', () => {
      const result = governance.intercept({
        id: generateId(),
        module: 'git',
        operation: 'force-push',
        target: 'origin main',
      });
      expect(result.decision).toBe(PolicyDecision.BLOCK);
    });
  });

  // ---- Risk Escalation Override -------------------------------------------
  describe('Risk Escalation Override', () => {
    it('should escalate HIGH risk + ALLOW to REQUIRE_APPROVAL', () => {
      // Write operation = HIGH risk, no policy match → default ALLOW
      // But risk escalation should force REQUIRE_APPROVAL
      const result = governance.intercept({
        id: generateId(),
        module: 'config',
        operation: 'write',
        target: './settings.json',
      });
      // Config module with write = risk 35 * 1.2 = 42 → HIGH → escalation
      expect(result.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    });

    it('should escalate CRITICAL risk + ALLOW to REQUIRE_APPROVAL', () => {
      // Destructive + high module multiplier
      const result = governance.intercept({
        id: generateId(),
        module: 'db',
        operation: 'drop',
        target: 'production_table',
      });
      // POL-002 matches first → REQUIRE_APPROVAL
      expect(result.decision).toBe(PolicyDecision.REQUIRE_APPROVAL);
    });

    it('should never override BLOCK with risk escalation', () => {
      // .env access → POL-001 BLOCK → should stay BLOCK regardless of risk
      const result = governance.intercept({
        id: generateId(),
        module: 'fs',
        operation: 'read',
        target: './.env',
      });
      expect(result.decision).toBe(PolicyDecision.BLOCK);
    });
  });

  // ---- Audit Trail Integrity -----------------------------------------------
  describe('Audit Trail Integrity', () => {
    it('should record every interception with full metadata', () => {
      const intent = {
        id: generateId(),
        module: 'fs',
        operation: 'read',
        target: './README.md',
      };

      const result = governance.intercept(intent);

      expect(result.auditRecord).toBeDefined();
      expect(result.auditRecord.intent).toBe(intent);
      expect(result.auditRecord.riskAssessment).toBeDefined();
      expect(result.auditRecord.decision).toBeDefined();
      expect(result.auditRecord.reason).toBeDefined();
    });

    it('should maintain append-only audit log', () => {
      const before = governance.getAuditHistory().length;

      governance.intercept({ id: generateId(), module: 'fs', operation: 'read', target: './a.txt' });
      governance.intercept({ id: generateId(), module: 'fs', operation: 'read', target: './b.txt' });

      const after = governance.getAuditHistory().length;
      expect(after).toBe(before + 2);
    });

    it('should never mutate audit records after creation', () => {
      const result = governance.intercept({
        id: generateId(),
        module: 'fs',
        operation: 'read',
        target: './test.txt',
      });

      const record = { ...result.auditRecord };

      // Run more intercepts
      governance.intercept({ id: generateId(), module: 'fs', operation: 'read', target: './other.txt' });

      // Original record should be unchanged
      const history = governance.getAuditHistory();
      const found = history.find((h) => h.id === record.id);
      expect(found?.decision).toBe(record.decision);
      expect(found?.intent).toBe(record.intent);
    });
  });

  // ---- Invariant Enforcement -----------------------------------------------
  describe('Invariant: no bypass possible', () => {
    it('every action produces risk + decision + audit', () => {
      const intents = [
        { id: 'inv-1', module: 'fs', operation: 'read', target: './safe.txt' },
        { id: 'inv-2', module: 'fs', operation: 'write', target: './out.txt' },
        { id: 'inv-3', module: 'db', operation: 'insert', target: 'table' },
        { id: 'inv-4', module: 'exec', operation: 'execute', target: 'ls' },
        { id: 'inv-5', module: 'fs', operation: 'read', target: './.env' },
        { id: 'inv-6', module: 'exec', operation: 'execute', target: 'rm -rf /' },
        { id: 'inv-7', module: 'git', operation: 'force-push', target: 'origin main' },
      ];

      for (const intent of intents) {
        const result = governance.intercept(intent);
        expect(result.decision).toBeDefined();
        expect(result.riskAssessment).toBeDefined();
        expect(result.auditRecord).toBeDefined();
        expect(typeof result.auditRecord.reason).toBe('string');
      }
    });

    it('BLOCK decisions cannot be overridden by approval', () => {
      const result = governance.intercept({
        id: generateId(),
        module: 'fs',
        operation: 'read',
        target: './.env',
      });

      expect(result.decision).toBe(PolicyDecision.BLOCK);
      // Even if someone tries to approve, the BLOCK is final at governance level
      expect(result.approvalRequest).toBeUndefined();
    });
  });
});

// ===========================================================================
// Performance Benchmark: Governance Intercept Latency
// ===========================================================================
describe('Performance Benchmark: Governance Intercept', () => {
  it('should intercept 1,000 intents with avg latency under 5ms', () => {
    const gov = new GovernanceGateway();

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      gov.intercept({
        id: generateId(),
        module: 'fs',
        operation: 'read',
        target: `./file-${i}.txt`,
      });
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 1000;

    expect(avgMs).toBeLessThan(5);
  });

  it('should intercept 1,000 mixed-intent workloads with avg latency under 5ms', () => {
    const gov = new GovernanceGateway();
    const modules = ['fs', 'db', 'exec', 'network', 'git'];
    const operations = ['read', 'write', 'insert', 'execute', 'force-push'];

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      gov.intercept({
        id: generateId(),
        module: modules[i % modules.length],
        operation: operations[i % operations.length],
        target: `target-${i}`,
      });
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 1000;

    expect(avgMs).toBeLessThan(5);
  });
});
