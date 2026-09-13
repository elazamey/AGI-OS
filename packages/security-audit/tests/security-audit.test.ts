import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityAuditor, InputSanitizer, PermissionGuard } from '../src/index.js';

describe('SecurityAuditor', () => {
  describe('inspectPayload', () => {
    it('should pass clean payloads', () => {
      const result = SecurityAuditor.inspectPayload('read file /home/user/document.txt');
      expect(result.passed).toBe(true);
      expect(result.threatLevel).toBe('LOW');
    });

    it('should block rm -rf /', () => {
      const result = SecurityAuditor.inspectPayload('rm -rf /');
      expect(result.passed).toBe(false);
      expect(result.threatLevel).toBe('CRITICAL');
      expect(result.details).toContain('Blocked');
    });

    it('should block eval()', () => {
      const result = SecurityAuditor.inspectPayload('eval("malicious code")');
      expect(result.passed).toBe(false);
      require('child_process');
    });

    it('should block child_process', () => {
      const result = SecurityAuditor.inspectPayload('require("child_process")');
      expect(result.passed).toBe(false);
      expect(result.threatLevel).toBe('CRITICAL');
    });

    it('should block process.exit', () => {
      const result = SecurityAuditor.inspectPayload('process.exit(1)');
      expect(result.passed).toBe(false);
      expect(result.threatLevel).toBe('CRITICAL');
    });

    it('should block exec()', () => {
      const result = SecurityAuditor.inspectPayload('exec("ls -la")');
      expect(result.passed).toBe(false);
      expect(result.threatLevel).toBe('CRITICAL');
    });

    it('should block path traversal', () => {
      const result = SecurityAuditor.inspectPayload('../../etc/passwd');
      expect(result.passed).toBe(false);
      expect(result.threatLevel).toBe('CRITICAL');
    });

    it('should block SQL injection', () => {
      const result = SecurityAuditor.inspectPayload('UNION SELECT * FROM users');
      expect(result.passed).toBe(false);
      expect(result.threatLevel).toBe('CRITICAL');
    });

    it('should block script injection', () => {
      const result = SecurityAuditor.inspectPayload('<script>alert("xss")</script>');
      expect(result.passed).toBe(false);
      expect(result.threatLevel).toBe('CRITICAL');
    });

    it('should block javascript protocol', () => {
      const result = SecurityAuditor.inspectPayload('javascript:alert(1)');
      expect(result.passed).toBe(false);
      expect(result.threatLevel).toBe('CRITICAL');
    });
  });

  describe('auditEnvironment', () => {
    it('should pass compliant environment', () => {
      const result = SecurityAuditor.auditEnvironment({
        MAX_SPEND: '0',
        STRICT_MODE: 'true',
      });
      expect(result.passed).toBe(true);
      expect(result.threatLevel).toBe('LOW');
    });

    it('should warn on MAX_SPEND > 0 with STRICT_MODE', () => {
      const result = SecurityAuditor.auditEnvironment({
        MAX_SPEND: '10',
        STRICT_MODE: 'true',
      });
      expect(result.passed).toBe(false);
      expect(result.threatLevel).toBe('MEDIUM');
    });

    it('should flag ALLOW_ROOT=true', () => {
      const result = SecurityAuditor.auditEnvironment({
        ALLOW_ROOT: 'true',
      });
      expect(result.passed).toBe(false);
      expect(result.threatLevel).toBe('HIGH');
    });

    it('should flag DISABLE_AUTH=true', () => {
      const result = SecurityAuditor.auditEnvironment({
        DISABLE_AUTH: 'true',
      });
      expect(result.passed).toBe(false);
      expect(result.threatLevel).toBe('CRITICAL');
    });
  });

  describe('runFullAudit', () => {
    it('should pass clean payloads and env', () => {
      const report = SecurityAuditor.runFullAudit(
        ['read file', 'list directory'],
        { MAX_SPEND: '0' }
      );
      expect(report.overallPassed).toBe(true);
      expect(report.overallThreatLevel).toBe('LOW');
      expect(report.checks.length).toBe(3);
    });

    it('should fail on dangerous payloads', () => {
      const report = SecurityAuditor.runFullAudit(
        ['rm -rf /'],
        { MAX_SPEND: '0' }
      );
      expect(report.overallPassed).toBe(false);
      expect(report.overallThreatLevel).toBe('CRITICAL');
    });

    it('should fail on bad environment', () => {
      const report = SecurityAuditor.runFullAudit(
        ['read file'],
        { DISABLE_AUTH: 'true' }
      );
      expect(report.overallPassed).toBe(false);
      expect(report.overallThreatLevel).toBe('CRITICAL');
    });

    it('should include timestamp', () => {
      const report = SecurityAuditor.runFullAudit([], {});
      expect(report.timestamp).toBeGreaterThan(0);
    });
  });
});

describe('InputSanitizer', () => {
  describe('sanitize', () => {
    it('should pass clean input', () => {
      const result = InputSanitizer.sanitize('Hello World');
      expect(result.wasModified).toBe(false);
      expect(result.sanitized).toBe('Hello World');
      expect(result.removedPatterns.length).toBe(0);
    });

    it('should remove script tags', () => {
      const result = InputSanitizer.sanitize('<script>alert("xss")</script>');
      expect(result.wasModified).toBe(true);
      expect(result.sanitized).not.toContain('<script>');
      expect(result.removedPatterns).toContain('Script tags');
    });

    it('should escape single quotes', () => {
      const result = InputSanitizer.sanitize("O'Brien");
      expect(result.wasModified).toBe(true);
      expect(result.sanitized).toBe("O''Brien");
    });

    it('should remove HTML comments', () => {
      const result = InputSanitizer.sanitize('Hello <!-- secret --> World');
      expect(result.wasModified).toBe(true);
      expect(result.sanitized).toBe('Hello  World');
    });

    it('should remove event handlers', () => {
      const result = InputSanitizer.sanitize('onclick="malicious()"');
      expect(result.wasModified).toBe(true);
    });
  });

  describe('sanitizePath', () => {
    it('should pass clean path', () => {
      const result = InputSanitizer.sanitizePath('/home/user/file.txt');
      expect(result.wasModified).toBe(false);
      expect(result.sanitized).toBe('/home/user/file.txt');
    });

    it('should remove path traversal', () => {
      const result = InputSanitizer.sanitizePath('../../etc/passwd');
      expect(result.wasModified).toBe(true);
      expect(result.sanitized).not.toContain('..');
    });

    it('should remove null bytes', () => {
      const result = InputSanitizer.sanitizePath('/home/user/file\0.txt');
      expect(result.wasModified).toBe(true);
      expect(result.sanitized).not.toContain('\0');
    });
  });

  describe('sanitizeSql', () => {
    it('should pass clean input', () => {
      const result = InputSanitizer.sanitizeSql('SELECT * FROM users WHERE id = 1');
      expect(result.wasModified).toBe(false);
    });

    it('should remove SQL keywords', () => {
      const result = InputSanitizer.sanitizeSql('DROP TABLE users');
      expect(result.wasModified).toBe(true);
      expect(result.sanitized).not.toContain('DROP');
    });

    it('should remove UNION SELECT', () => {
      const result = InputSanitizer.sanitizeSql('1 UNION SELECT * FROM passwords');
      expect(result.wasModified).toBe(true);
      expect(result.sanitized).not.toContain('UNION');
    });
  });

  describe('isSafe', () => {
    it('should return true for clean input', () => {
      expect(InputSanitizer.isSafe('Hello World')).toBe(true);
    });

    it('should return false for malicious input', () => {
      expect(InputSanitizer.isSafe('<script>alert(1)</script>')).toBe(false);
    });
  });
});

describe('PermissionGuard', () => {
  let guard: PermissionGuard;

  beforeEach(() => {
    guard = new PermissionGuard([
      { resource: 'file:read', level: 'READ' },
      { resource: 'file:write', level: 'WRITE' },
      { resource: 'file:exec', level: 'EXECUTE' },
      { resource: 'admin:panel', level: 'ADMIN' },
      { resource: 'secret:data', level: 'DENY' },
    ]);
  });

  it('should check permissions correctly', () => {
    expect(guard.check('file:read', 'READ').allowed).toBe(true);
    expect(guard.check('file:read', 'WRITE').allowed).toBe(false);
    expect(guard.check('file:write', 'WRITE').allowed).toBe(true);
    expect(guard.check('file:write', 'ADMIN').allowed).toBe(false);
    expect(guard.check('admin:panel', 'ADMIN').allowed).toBe(true);
    expect(guard.check('secret:data', 'READ').allowed).toBe(false);
  });

  it('should check canRead', () => {
    expect(guard.canRead('file:read')).toBe(true);
    expect(guard.canRead('secret:data')).toBe(false);
  });

  it('should check canWrite', () => {
    expect(guard.canWrite('file:write')).toBe(true);
    expect(guard.canWrite('file:read')).toBe(false);
  });

  it('should check canExecute', () => {
    expect(guard.canExecute('file:exec')).toBe(true);
    expect(guard.canExecute('file:read')).toBe(false);
  });

  it('should check isAdmin', () => {
    expect(guard.isAdmin('admin:panel')).toBe(true);
    expect(guard.isAdmin('file:read')).toBe(false);
  });

  it('should add and remove permissions', () => {
    guard.addPermission('new:resource', 'READ');
    expect(guard.canRead('new:resource')).toBe(true);

    guard.removePermission('new:resource');
    expect(guard.canRead('new:resource')).toBe(false);
  });

  it('should keep audit log', () => {
    guard.check('file:read', 'READ');
    guard.check('file:read', 'WRITE');

    const log = guard.getAuditLog();
    expect(log.length).toBe(2);
    expect(log[0].allowed).toBe(true);
    expect(log[1].allowed).toBe(false);
  });

  it('should clear audit log', () => {
    guard.check('file:read', 'READ');
    guard.clearAuditLog();
    expect(guard.getAuditLog().length).toBe(0);
  });

  it('should get permission for resource', () => {
    expect(guard.getPermission('file:read')).toBe('READ');
    expect(guard.getPermission('unknown')).toBeUndefined();
  });

  it('should get all permissions', () => {
    const all = guard.getAllPermissions();
    expect(all.size).toBe(5);
    expect(all.get('file:read')).toBe('READ');
  });
});
