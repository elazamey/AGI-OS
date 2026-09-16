import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubWebhookHandler, GitHubCapabilityMatrix } from '../src/index.js';

describe('GitHubWebhookHandler', () => {
  let handler: GitHubWebhookHandler;

  beforeEach(() => {
    handler = new GitHubWebhookHandler('test-secret');
  });

  it('should create with secret', () => {
    expect(handler).toBeDefined();
  });

  it('should verify valid signature', () => {
    const payload = '{"action":"opened"}';
    const hmac = createHmac('sha256', 'test-secret');
    const signature = `sha256=${hmac.update(payload).digest('hex')}`;

    expect(handler.verifySignature(payload, signature)).toBe(true);
  });

  it('should reject invalid signature', () => {
    const payload = '{"action":"opened"}';
    expect(handler.verifySignature(payload, 'sha256=invalid')).toBe(false);
  });

  it('should reject missing signature', () => {
    expect(handler.verifySignature('{}', null)).toBe(false);
  });

  it('should handle issues.opened event', () => {
    const result = handler.handleEvent('issues', {
      action: 'opened',
      repository: { full_name: 'test/repo' },
      sender: { login: 'user' },
      issue: { number: 1, title: 'Test Issue', body: 'Test body' },
    });

    expect(result.missionTriggered).toBe(true);
    expect(result.targetId).toBe(1);
    expect(result.targetType).toBe('issue');
  });

  it('should handle pull_request.review_requested event', () => {
    const result = handler.handleEvent('pull_request', {
      action: 'review_requested',
      repository: { full_name: 'test/repo' },
      sender: { login: 'user' },
      pull_request: { number: 10, head: { ref: 'feature', sha: 'abc123' }, title: 'Test PR' },
    });

    expect(result.missionTriggered).toBe(true);
    expect(result.targetId).toBe(10);
    expect(result.targetType).toBe('pull_request');
  });

  it('should handle pull_request.opened event', () => {
    const result = handler.handleEvent('pull_request', {
      action: 'opened',
      repository: { full_name: 'test/repo' },
      sender: { login: 'user' },
      pull_request: { number: 5, head: { ref: 'feature', sha: 'abc123' }, title: 'New PR' },
    });

    expect(result.missionTriggered).toBe(true);
    expect(result.targetId).toBe(5);
  });

  it('should handle push event', () => {
    const result = handler.handleEvent('push', {
      action: 'push',
      repository: { full_name: 'test/repo' },
      sender: { login: 'user' },
      push: { ref: 'refs/heads/main', commits: [{ id: 'abc123', message: 'Test commit' }] },
    });

    expect(result.missionTriggered).toBe(true);
    expect(result.targetType).toBe('push');
  });

  it('should not trigger mission for unsupported event', () => {
    const result = handler.handleEvent('release', {
      action: 'published',
      repository: { full_name: 'test/repo' },
      sender: { login: 'user' },
    });

    expect(result.missionTriggered).toBe(false);
  });

  it('should return supported events', () => {
    const events = handler.getSupportedEvents();
    expect(events).toContain('issues');
    expect(events).toContain('pull_request');
    expect(events).toContain('push');
  });

  it('should return supported actions', () => {
    const actions = handler.getSupportedActions();
    expect(actions.issues).toContain('opened');
    expect(actions.pull_request).toContain('review_requested');
  });
});

describe('GitHubCapabilityMatrix', () => {
  let matrix: GitHubCapabilityMatrix;

  beforeEach(() => {
    matrix = new GitHubCapabilityMatrix();
  });

  it('should create with default capabilities', () => {
    expect(matrix).toBeDefined();
    const capabilities = matrix.getCapabilities();
    expect(capabilities.length).toBeGreaterThan(0);
  });

  it('should check repo.read is ALLOW', () => {
    expect(matrix.isAllowed('repo.read')).toBe(true);
    expect(matrix.requiresApproval('repo.read')).toBe(false);
    expect(matrix.isDenied('repo.read')).toBe(false);
  });

  it('should check repo.write requires approval', () => {
    expect(matrix.requiresApproval('repo.write')).toBe(true);
    expect(matrix.isAllowed('repo.write')).toBe(false);
  });

  it('should check pr.merge is DENY', () => {
    expect(matrix.isDenied('pr.merge')).toBe(true);
    expect(matrix.isAllowed('pr.merge')).toBe(false);
    expect(matrix.requiresApproval('pr.merge')).toBe(false);
  });

  it('should get capability by name', () => {
    const cap = matrix.checkCapability('issue.create');
    expect(cap).toBeDefined();
    expect(cap?.name).toBe('issue.create');
    expect(cap?.level).toBe('ALLOW');
  });

  it('should return null for unknown capability', () => {
    const cap = matrix.checkCapability('unknown');
    expect(cap).toBeNull();
  });

  it('should get capabilities by level', () => {
    const allowed = matrix.getCapabilitiesByLevel('ALLOW');
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.every(c => c.level === 'ALLOW')).toBe(true);

    const ask = matrix.getCapabilitiesByLevel('ASK');
    expect(ask.length).toBeGreaterThan(0);
    expect(ask.every(c => c.level === 'ASK')).toBe(true);

    const denied = matrix.getCapabilitiesByLevel('DENY');
    expect(denied.length).toBeGreaterThan(0);
    expect(denied.every(c => c.level === 'DENY')).toBe(true);
  });

  it('should update capability level', () => {
    matrix.setCapabilityLevel('repo.read', 'ASK');
    expect(matrix.requiresApproval('repo.read')).toBe(true);
  });
});
