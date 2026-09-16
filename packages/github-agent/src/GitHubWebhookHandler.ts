import { createHmac, timingSafeEqual } from 'node:crypto';
import { generateId } from '@agi-os/kernel';

export interface WebhookEvent {
  action: string;
  repository: { full_name: string };
  sender: { login: string };
  issue?: { number: number; title: string; body: string };
  pull_request?: { number: number; head: { ref: string; sha: string }; title: string };
  push?: { ref: string; commits: Array<{ id: string; message: string }> };
}

export interface WebhookResult {
  eventId: string;
  action: string;
  missionTriggered: boolean;
  targetId?: number;
  targetType?: string;
  timestamp: number;
}

export class GitHubWebhookHandler {
  private webhookSecret: string;

  constructor(webhookSecret: string) {
    this.webhookSecret = webhookSecret;
  }

  verifySignature(payloadBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;

    const hmac = createHmac('sha256', this.webhookSecret);
    const digest = `sha256=${hmac.update(payloadBody).digest('hex')}`;

    try {
      return timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
    } catch {
      return false;
    }
  }

  handleEvent(eventName: string, payload: WebhookEvent): WebhookResult {
    const eventId = generateId();
    const timestamp = Date.now();

    if (eventName === 'issues' && payload.action === 'opened') {
      return {
        eventId,
        action: payload.action,
        missionTriggered: true,
        targetId: payload.issue?.number,
        targetType: 'issue',
        timestamp,
      };
    }

    if (eventName === 'pull_request' && payload.action === 'review_requested') {
      return {
        eventId,
        action: payload.action,
        missionTriggered: true,
        targetId: payload.pull_request?.number,
        targetType: 'pull_request',
        timestamp,
      };
    }

    if (eventName === 'pull_request' && payload.action === 'opened') {
      return {
        eventId,
        action: payload.action,
        missionTriggered: true,
        targetId: payload.pull_request?.number,
        targetType: 'pull_request',
        timestamp,
      };
    }

    if (eventName === 'push') {
      return {
        eventId,
        action: 'push',
        missionTriggered: true,
        targetType: 'push',
        timestamp,
      };
    }

    return {
      eventId,
      action: payload.action,
      missionTriggered: false,
      timestamp,
    };
  }

  getSupportedEvents(): string[] {
    return ['issues', 'pull_request', 'push', 'release', 'workflow_run'];
  }

  getSupportedActions(): Record<string, string[]> {
    return {
      issues: ['opened', 'closed', 'reopened', 'labeled'],
      pull_request: ['opened', 'closed', 'review_requested', 'synchronize'],
      push: ['*'],
      release: ['published', 'created'],
      workflow_run: ['completed', 'requested'],
    };
  }
}
