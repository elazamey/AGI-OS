import { describe, it, expect, beforeEach } from 'vitest';
import { EventChannel } from '../src/event-channel.js';
import type { AgentMessage } from '../src/types.js';
import { generateId } from '@agi-os/kernel';

describe('EventChannel', () => {
  let channel: EventChannel;
  beforeEach(() => { channel = new EventChannel(); });

  const msg = (overrides?: Partial<AgentMessage>): AgentMessage => ({
    id: generateId(), from: 'a1', to: 'a2', type: 'result',
    payload: {}, requiresGovernance: false, timestamp: new Date().toISOString(), ...overrides,
  });

  it('delivers to subscribed agent', () => {
    const received: AgentMessage[] = [];
    channel.subscribe('a2', m => received.push(m));
    channel.send(msg());
    expect(received.length).toBe(1);
  });

  it('does not deliver to unsubscribed', () => {
    const received: AgentMessage[] = [];
    channel.subscribe('a1', m => received.push(m));
    channel.send(msg({ to: 'a2' }));
    expect(received.length).toBe(0);
  });

  it('delivers broadcast', () => {
    const r1: AgentMessage[] = [];
    const r2: AgentMessage[] = [];
    channel.subscribeBroadcast(m => r1.push(m));
    channel.subscribeBroadcast(m => r2.push(m));
    channel.send(msg({ to: 'broadcast' }));
    expect(r1.length).toBe(1);
    expect(r2.length).toBe(1);
  });

  it('multiple handlers per agent', () => {
    let c = 0;
    channel.subscribe('a2', () => c++);
    channel.subscribe('a2', () => c++);
    channel.send(msg());
    expect(c).toBe(2);
  });

  it('governance blocks messages', () => {
    channel.setGovernanceInterceptor(() => false);
    const received: AgentMessage[] = [];
    channel.subscribe('a2', m => received.push(m));
    channel.send(msg({ requiresGovernance: true }));
    expect(received.length).toBe(0);
  });

  it('governance allows messages', () => {
    channel.setGovernanceInterceptor(() => true);
    const received: AgentMessage[] = [];
    channel.subscribe('a2', m => received.push(m));
    channel.send(msg({ requiresGovernance: true }));
    expect(received.length).toBe(1);
  });

  it('skips governance for non-governance messages', () => {
    let called = false;
    channel.setGovernanceInterceptor(() => { called = true; return false; });
    const received: AgentMessage[] = [];
    channel.subscribe('a2', m => received.push(m));
    channel.send(msg({ requiresGovernance: false }));
    expect(called).toBe(false);
    expect(received.length).toBe(1);
  });

  it('audit logs all messages', () => {
    channel.send(msg());
    channel.send(msg());
    expect(channel.getAuditLog().length).toBe(2);
  });

  it('audit logs intercepted', () => {
    channel.setGovernanceInterceptor(() => false);
    channel.send(msg({ requiresGovernance: true }));
    expect(channel.getInterceptedMessages().length).toBe(1);
  });

  it('tracks message count', () => {
    channel.send(msg());
    expect(channel.messageCount()).toBe(1);
  });

  it('gets messages for agent', () => {
    channel.send(msg({ to: 'a2' }));
    channel.send(msg({ to: 'a3' }));
    expect(channel.getMessagesFor('a2').length).toBe(1);
  });

  it('gets messages from agent', () => {
    channel.send(msg({ from: 'a1' }));
    channel.send(msg({ from: 'a2' }));
    expect(channel.getMessagesFrom('a1').length).toBe(1);
  });

  it('unsubscribes', () => {
    let c = 0;
    channel.subscribe('a2', () => c++);
    channel.send(msg());
    channel.unsubscribe('a2');
    channel.send(msg());
    expect(c).toBe(1);
  });

  it('clears', () => {
    channel.send(msg());
    channel.clear();
    expect(channel.messageCount()).toBe(0);
  });
});
