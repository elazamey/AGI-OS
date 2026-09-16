import { generateId, now } from '@agi-os/kernel';
import type { AgentMessage, MessageType } from './types.js';

export type ChannelHandler = (message: AgentMessage) => void;

export interface ChannelAuditRecord {
  id: string;
  messageId: string;
  from: string;
  to: string;
  type: MessageType;
  intercepted: boolean;
  timestamp: string;
}

export class EventChannel {
  private handlers: Map<string, ChannelHandler[]> = new Map();
  private broadcastHandlers: ChannelHandler[] = [];
  private messageLog: AgentMessage[] = [];
  private auditLog: ChannelAuditRecord[] = [];
  private governanceInterceptor?: (message: AgentMessage) => boolean;

  setGovernanceInterceptor(interceptor: (message: AgentMessage) => boolean): void {
    this.governanceInterceptor = interceptor;
  }

  send(message: AgentMessage): void {
    this.messageLog.push(message);

    const auditRecord: ChannelAuditRecord = {
      id: generateId(),
      messageId: message.id,
      from: message.from,
      to: message.to,
      type: message.type,
      intercepted: false,
      timestamp: now().toISOString(),
    };

    if (message.requiresGovernance && this.governanceInterceptor) {
      const allowed = this.governanceInterceptor(message);
      if (!allowed) {
        auditRecord.intercepted = true;
        this.auditLog.push(auditRecord);
        return;
      }
    }

    this.auditLog.push(auditRecord);

    if (message.to === 'broadcast') {
      for (const handler of this.broadcastHandlers) {
        handler(message);
      }
    } else {
      const handlers = this.handlers.get(message.to) ?? [];
      for (const handler of handlers) {
        handler(message);
      }
    }
  }

  subscribe(agentId: string, handler: ChannelHandler): void {
    const handlers = this.handlers.get(agentId) ?? [];
    handlers.push(handler);
    this.handlers.set(agentId, handlers);
  }

  subscribeBroadcast(handler: ChannelHandler): void {
    this.broadcastHandlers.push(handler);
  }

  unsubscribe(agentId: string): void {
    this.handlers.delete(agentId);
  }

  getMessages(): AgentMessage[] {
    return [...this.messageLog];
  }

  getMessagesFor(agentId: string): AgentMessage[] {
    return this.messageLog.filter(m => m.to === agentId || m.to === 'broadcast');
  }

  getMessagesFrom(agentId: string): AgentMessage[] {
    return this.messageLog.filter(m => m.from === agentId);
  }

  getAuditLog(): ChannelAuditRecord[] {
    return [...this.auditLog];
  }

  getInterceptedMessages(): ChannelAuditRecord[] {
    return this.auditLog.filter(r => r.intercepted);
  }

  messageCount(): number {
    return this.messageLog.length;
  }

  clear(): void {
    this.messageLog = [];
    this.auditLog = [];
    this.handlers.clear();
    this.broadcastHandlers = [];
  }
}
