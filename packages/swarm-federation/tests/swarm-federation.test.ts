import { describe, it, expect, beforeEach } from 'vitest';
import { SwarmFederation } from '../src/index.js';

describe('SwarmFederation', () => {
  let swarm: SwarmFederation;

  beforeEach(() => {
    swarm = new SwarmFederation('local-agent');
  });

  it('should create swarm with local node', () => {
    expect(swarm).toBeDefined();
    expect(swarm.getLocalNodeId()).toBe('local-agent');
  });

  it('should register and retrieve nodes', () => {
    swarm.registerNode({
      id: 'agent-1', name: 'Worker 1', address: 'http://localhost:3001',
      capabilities: ['code-gen', 'testing'], status: 'online', load: 0.3, last_seen: Date.now(),
    });
    expect(swarm.getNodeCount()).toBe(1);
    expect(swarm.getNode('agent-1')).not.toBeNull();
  });

  it('should find online nodes', () => {
    swarm.registerNode({ id: 'a1', name: 'A1', address: '', capabilities: [], status: 'online', load: 0, last_seen: Date.now() });
    swarm.registerNode({ id: 'a2', name: 'A2', address: '', capabilities: [], status: 'offline', load: 0, last_seen: Date.now() });
    expect(swarm.getOnlineNodes().length).toBe(1);
  });

  it('should find nodes by capability', () => {
    swarm.registerNode({ id: 'a1', name: 'A1', address: '', capabilities: ['testing'], status: 'online', load: 0, last_seen: Date.now() });
    swarm.registerNode({ id: 'a2', name: 'A2', address: '', capabilities: ['code-gen'], status: 'online', load: 0, last_seen: Date.now() });
    expect(swarm.getNodesWithCapability('testing').length).toBe(1);
  });

  it('should find best node by load', () => {
    swarm.registerNode({ id: 'a1', name: 'A1', address: '', capabilities: ['testing'], status: 'online', load: 0.8, last_seen: Date.now() });
    swarm.registerNode({ id: 'a2', name: 'A2', address: '', capabilities: ['testing'], status: 'online', load: 0.2, last_seen: Date.now() });
    const best = swarm.findBestNode('testing');
    expect(best!.id).toBe('a2');
  });

  it('should send and receive messages', () => {
    const msg = swarm.sendMessage({
      from: 'local-agent', to: 'agent-1', type: 'heartbeat', payload: {}, ttl: 60,
    });
    expect(msg.id).toBeDefined();
    expect(swarm.getMessagesForNode('agent-1').length).toBe(1);
  });

  it('should broadcast messages', () => {
    swarm.sendMessage({ from: 'local-agent', to: 'broadcast', type: 'heartbeat', payload: {}, ttl: 60 });
    expect(swarm.getMessagesForNode('any-node').length).toBe(1);
  });

  it('should assign and complete tasks', () => {
    const assignment = swarm.assignTask('task-1', 'agent-1');
    expect(assignment.status).toBe('pending');
    expect(swarm.completeTask('task-1', { output: 'done' })).toBe(true);
    expect(swarm.getTaskAssignment('task-1')!.status).toBe('completed');
  });

  it('should remove nodes', () => {
    swarm.registerNode({ id: 'a1', name: 'A1', address: '', capabilities: [], status: 'online', load: 0, last_seen: Date.now() });
    expect(swarm.removeNode('a1')).toBe(true);
    expect(swarm.getNodeCount()).toBe(0);
  });
});
