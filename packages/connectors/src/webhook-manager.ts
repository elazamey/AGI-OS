import { generateId, now } from '@agi-os/kernel';
import type { WebhookPayload } from './types.js';

export interface WebhookSubscription {
  id: string;
  event: string;
  url: string;
  secret?: string;
  active: boolean;
  createdAt: string;
}

export class WebhookManager {
  private subscriptions: Map<string, WebhookSubscription> = new Map();
  private received: WebhookPayload[] = [];

  subscribe(event: string, url: string, secret?: string): WebhookSubscription {
    const sub: WebhookSubscription = { id: generateId(), event, url, secret, active: true, createdAt: now().toISOString() };
    this.subscriptions.set(sub.id, sub);
    return sub;
  }

  unsubscribe(id: string): boolean { return this.subscriptions.delete(id); }

  getSubscriptions(event?: string): WebhookSubscription[] {
    const all = Array.from(this.subscriptions.values());
    return event ? all.filter(s => s.event === event && s.active) : all;
  }

  receivePayload(payload: WebhookPayload): void {
    this.received.push(payload);
  }

  getReceived(event?: string): WebhookPayload[] {
    return event ? this.received.filter(p => p.event === event) : [...this.received];
  }

  verifySignature(payload: string, signature: string, secret: string): boolean {
    return signature === `sha256=${secret}`;
  }

  getStats(): { subscriptions: number; received: number; active: number } {
    return {
      subscriptions: this.subscriptions.size,
      received: this.received.length,
      active: Array.from(this.subscriptions.values()).filter(s => s.active).length,
    };
  }
}
