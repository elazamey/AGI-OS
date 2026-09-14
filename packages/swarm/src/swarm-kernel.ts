import { generateId, now } from '@agi-os/kernel';
import { GovernanceGateway, PolicyDecision } from '@agi-os/governance';
import { AgentRegistry } from './agent-registry.js';
import { EventChannel } from './event-channel.js';
import { DelegationManager } from './delegation-manager.js';
import { AgentSupervisor } from './agent-supervisor.js';
import { SwarmFederation } from '@agi-os/swarm-federation';
import type { SwarmConfig, AgentRole, DelegationRequest, AgentMessage, SwarmState } from './types.js';

export interface SwarmMission {
  id: string;
  goal: string;
  decomposedTasks: DecomposedTask[];
  status: 'pending' | 'decomposing' | 'executing' | 'consolidating' | 'completed' | 'failed';
  assignedAgents: string[];
  results: SwarmResult[];
  createdAt: string;
  completedAt?: string;
}

export interface DecomposedTask {
  id: string;
  goal: string;
  requiredRole: AgentRole;
  requiredCapabilities: string[];
  priority: DelegationRequest['priority'];
  order: number;
}

export interface SwarmResult {
  delegationId: string;
  agentId: string;
  success: boolean;
  outcome: string;
  duration: number;
}

const DEFAULT_CONFIG: SwarmConfig = {
  maxAgents: 10,
  maxConcurrentDelegations: 5,
  delegationTimeoutMs: 30000,
  enableGovernanceIntercept: true,
  enableAuditLogging: true,
};

export class SwarmKernel {
  private registry: AgentRegistry;
  private channel: EventChannel;
  private delegationManager: DelegationManager;
  private supervisor: AgentSupervisor;
  private governance: GovernanceGateway;
  private config: SwarmConfig;
  private missions: Map<string, SwarmMission> = new Map();
  private taskDecomposer: TaskDecomposer;
  private federation: SwarmFederation;

  constructor(params?: {
    governance?: GovernanceGateway;
    config?: Partial<SwarmConfig>;
    taskDecomposer?: TaskDecomposer;
    federation?: SwarmFederation;
  }) {
    this.governance = params?.governance ?? new GovernanceGateway();
    this.config = { ...DEFAULT_CONFIG, ...params?.config };
    this.registry = new AgentRegistry();
    this.channel = new EventChannel();
    this.delegationManager = new DelegationManager();
    this.supervisor = new AgentSupervisor(this.config.delegationTimeoutMs);
    this.taskDecomposer = params?.taskDecomposer ?? new DefaultTaskDecomposer();
    this.federation = params?.federation ?? new SwarmFederation('local-node');

    if (this.config.enableGovernanceIntercept) {
      this.setupGovernanceIntercept();
    }
  }

  setupGovernanceIntercept(): void {
    this.channel.setGovernanceInterceptor((message: AgentMessage) => {
      const intent = {
        id: generateId(),
        module: 'exec',
        operation: 'execute',
        target: `swarm:message:${message.type}`,
        payload: message.payload,
      };
      const result = this.governance.intercept(intent);
      return result.decision === PolicyDecision.ALLOW;
    });
  }

  registerAgent(params: {
    role: AgentRole;
    name: string;
    description?: string;
    capabilities?: string[];
    trustLevel?: 'restricted' | 'standard' | 'privileged';
  }): ReturnType<AgentRegistry['register']> {
    if (this.registry.count() >= this.config.maxAgents) {
      throw new Error(`Maximum agent limit (${this.config.maxAgents}) reached`);
    }
    const agent = this.registry.register(params);
    this.supervisor.registerAgent(agent.id);

    this.federation.registerNode({
      id: agent.id,
      name: agent.name,
      address: `local-node:${agent.id}`,
      capabilities: params.capabilities ?? [],
      status: 'online',
      load: 0,
    });

    return agent;
  }

  unregisterAgent(agentId: string): boolean {
    this.supervisor.unregisterAgent(agentId);
    return this.registry.unregister(agentId);
  }

  decomposeMission(missionId: string, goal: string): SwarmMission {
    const tasks = this.taskDecomposer.decompose(goal);
    const mission: SwarmMission = {
      id: missionId,
      goal,
      decomposedTasks: tasks,
      status: 'decomposing',
      assignedAgents: [],
      results: [],
      createdAt: now().toISOString(),
    };
    this.missions.set(missionId, mission);
    return mission;
  }

  assignTask(missionId: string, taskId: string, agentId: string): DelegationRequest | undefined {
    const mission = this.missions.get(missionId);
    if (!mission) return undefined;

    const task = mission.decomposedTasks.find(t => t.id === taskId);
    if (!task) return undefined;

    const agent = this.registry.get(agentId);
    if (!agent) return undefined;

    if (agent.trustLevel === 'restricted') {
      const intent = {
        id: generateId(),
        module: 'exec',
        operation: 'execute',
        target: `swarm:assign:${task.goal}`,
      };
      const gate = this.governance.intercept(intent);
      if (gate.decision === PolicyDecision.BLOCK) return undefined;
    }

    const delegation = this.delegationManager.create({
      parentMissionId: missionId,
      goal: task.goal,
      assignedTo: agentId,
      assignedBy: 'swarm-kernel',
      priority: task.priority,
      constraints: { allowedModules: ['fs', 'exec', 'db'], requiresApproval: false },
    });

    this.delegationManager.accept(delegation.id);
    this.delegationManager.start(delegation.id);
    mission.assignedAgents.push(agentId);
    this.supervisor.taskStarted(agentId, delegation.id);

    this.channel.send({
      id: generateId(),
      from: 'swarm-kernel',
      to: agentId,
      type: 'task_delegation',
      payload: { delegation, task },
      requiresGovernance: false,
      timestamp: now().toISOString(),
    });

    this.federation.assignTask(taskId, agentId);

    return delegation;
  }

  reportResult(delegationId: string, result: Omit<SwarmResult, 'delegationId'>): void {
    const delegation = this.delegationManager.get(delegationId);
    if (!delegation) return;

    this.delegationManager.complete(delegationId);
    this.supervisor.taskCompleted(delegation.assignedTo, delegationId);

    const mission = this.missions.get(delegation.parentMissionId);
    if (mission) {
      mission.results.push({ ...result, delegationId });
      this.channel.send({
        id: generateId(),
        from: delegation.assignedTo,
        to: 'swarm-kernel',
        type: 'result',
        payload: result,
        requiresGovernance: false,
        timestamp: now().toISOString(),
      });

    this.federation.completeTask(delegation.id, result);
    }
  }

  consolidateMission(missionId: string): SwarmResult[] | undefined {
    const mission = this.missions.get(missionId);
    if (!mission) return undefined;

    mission.status = 'consolidating';
    const allDelegations = this.delegationManager.getByMission(missionId);
    const allComplete = allDelegations.every(d => d.status === 'completed' || d.status === 'failed');

    if (!allComplete) return undefined;

    mission.status = 'completed';
    mission.completedAt = now().toISOString();
    return mission.results;
  }

  getMission(missionId: string): SwarmMission | undefined {
    return this.missions.get(missionId);
  }

  getState(): SwarmState {
    return {
      activeAgents: this.registry.getAll().map(a => a.id),
      activeDelegations: this.delegationManager.getActive(),
      messageQueue: this.channel.getMessages().slice(-100),
      completedTasks: this.delegationManager.getByStatus('completed').map(d => d.id),
      failedTasks: this.delegationManager.getByStatus('failed').map(d => d.id),
    };
  }

  getRegistry(): AgentRegistry { return this.registry; }
  getChannel(): EventChannel { return this.channel; }
  getDelegationManager(): DelegationManager { return this.delegationManager; }
  getSupervisor(): AgentSupervisor { return this.supervisor; }
  getFederation(): SwarmFederation { return this.federation; }
}

export interface TaskDecomposer {
  decompose(goal: string): DecomposedTask[];
}

export class DefaultTaskDecomposer implements TaskDecomposer {
  decompose(goal: string): DecomposedTask[] {
    const tasks: DecomposedTask[] = [];
    const lowerGoal = goal.toLowerCase();

    if (lowerGoal.includes('research') || lowerGoal.includes('analyze') || lowerGoal.includes('investigate')) {
      tasks.push({
        id: generateId(),
        goal: `Research: ${goal}`,
        requiredRole: 'researcher',
        requiredCapabilities: ['research', 'analysis'],
        priority: 'high',
        order: 1,
      });
    }

    if (lowerGoal.includes('implement') || lowerGoal.includes('build') || lowerGoal.includes('create') || lowerGoal.includes('code')) {
      tasks.push({
        id: generateId(),
        goal: `Implement: ${goal}`,
        requiredRole: 'coder',
        requiredCapabilities: ['coding', 'implementation'],
        priority: 'high',
        order: 2,
      });
    }

    if (lowerGoal.includes('review') || lowerGoal.includes('audit') || lowerGoal.includes('verify')) {
      tasks.push({
        id: generateId(),
        goal: `Audit: ${goal}`,
        requiredRole: 'auditor',
        requiredCapabilities: ['review', 'audit'],
        priority: 'medium',
        order: 3,
      });
    }

    if (tasks.length === 0) {
      tasks.push({
        id: generateId(),
        goal: `Execute: ${goal}`,
        requiredRole: 'coder',
        requiredCapabilities: ['execution'],
        priority: 'medium',
        order: 1,
      });
    }

    return tasks;
  }
}
