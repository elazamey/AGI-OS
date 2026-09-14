export interface AgentNode {
  id: string;
  name: string;
  address: string;
  capabilities: string[];
  status: 'online' | 'offline' | 'busy';
  load: number;
  last_seen: number;
}

export interface SwarmMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  type: 'task_request' | 'task_result' | 'heartbeat' | 'capability_query' | 'capability_advertise';
  payload: Record<string, unknown>;
  timestamp: number;
  ttl: number;
}

export interface TaskAssignment {
  task_id: string;
  assigned_to: string;
  assigned_by: string;
  status: 'pending' | 'accepted' | 'running' | 'completed' | 'failed';
  result?: unknown;
}

export class SwarmFederation {
  private nodes: Map<string, AgentNode> = new Map();
  private messages: SwarmMessage[] = [];
  private taskAssignments: Map<string, TaskAssignment> = new Map();
  private localNodeId: string;

  constructor(localNodeId: string) {
    this.localNodeId = localNodeId;
  }

  registerNode(node: AgentNode): void {
    this.nodes.set(node.id, { ...node, last_seen: Date.now() });
  }

  removeNode(nodeId: string): boolean {
    return this.nodes.delete(nodeId);
  }

  getNode(nodeId: string): AgentNode | null {
    return this.nodes.get(nodeId) || null;
  }

  getOnlineNodes(): AgentNode[] {
    return Array.from(this.nodes.values()).filter(n => n.status === 'online');
  }

  getNodesWithCapability(capability: string): AgentNode[] {
    return this.getOnlineNodes().filter(n => n.capabilities.includes(capability));
  }

  findBestNode(capability: string): AgentNode | null {
    const candidates = this.getNodesWithCapability(capability);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, node) => node.load < best.load ? node : best);
  }

  sendMessage(message: Omit<SwarmMessage, 'id' | 'timestamp'>): SwarmMessage {
    const fullMessage: SwarmMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
    };
    this.messages.push(fullMessage);
    return fullMessage;
  }

  getMessagesForNode(nodeId: string): SwarmMessage[] {
    return this.messages.filter(m => m.to === nodeId || m.to === 'broadcast');
  }

  assignTask(taskId: string, targetNodeId: string): TaskAssignment {
    const assignment: TaskAssignment = {
      task_id: taskId,
      assigned_to: targetNodeId,
      assigned_by: this.localNodeId,
      status: 'pending',
    };
    this.taskAssignments.set(taskId, assignment);
    this.sendMessage({
      from: this.localNodeId,
      to: targetNodeId,
      type: 'task_request',
      payload: { task_id: taskId },
      ttl: 300,
    });
    return assignment;
  }

  completeTask(taskId: string, result: unknown): boolean {
    const assignment = this.taskAssignments.get(taskId);
    if (!assignment) return false;
    assignment.status = 'completed';
    assignment.result = result;
    return true;
  }

  getTaskAssignment(taskId: string): TaskAssignment | null {
    return this.taskAssignments.get(taskId) || null;
  }

  getAllTasks(): TaskAssignment[] {
    return Array.from(this.taskAssignments.values());
  }

  getLocalNodeId(): string { return this.localNodeId; }
  getNodeCount(): number { return this.nodes.size; }
  getMessageCount(): number { return this.messages.length; }
}
