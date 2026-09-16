// ============================================================================
// AGI OS - Kernel
// Atomic Kernel - Event-driven foundation for AGI OS
// ============================================================================

// Types
export type {
  Provenance,
  Entity,
  EntityType,
  Event,
  EventType,
  State,
  StateRevision,
  Evidence,
  Result,
  ErrorInfo,
  Decision,
  DecisionType,
  DecisionOption,
  Capability,
  RiskLevel,
  Permission,
  Policy,
  PolicyRule,
  Metric,
  KernelConfig
} from './types.js';

export { DEFAULT_KERNEL_CONFIG } from './types.js';

// Utilities
export {
  generateId,
  generateShortId,
  hash,
  hashString,
  hashObject,
  deepClone,
  deepMerge,
  nowISO,
  now,
  sleep,
  retry,
  debounce,
  throttle,
  assert,
  assertNotNull,
  timeout,
  withTimeout
} from './utils.js';

// Entity
export {
  createEntity,
  updateEntity,
  getEntityLineage,
  areEntitiesRelated,
  serializeEntity,
  deserializeEntity,
  validateEntity,
  InMemoryEntityStore
} from './entity.js';

export type { EntityStore, EntityFilter } from './entity.js';

// Event
export {
  createEvent,
  matchesFilter,
  EventBus,
  InMemoryEventStore,
  replayEvents,
  createEventStream,
  serializeEvent,
  deserializeEvent,
  validateEvent
} from './event.js';

export type { EventHandler, EventFilter, EventStore } from './event.js';

// State
export {
  createInitialState,
  createStateRevision,
  applyStateChange,
  StateManager,
  validateState,
  serializeState,
  deserializeState,
  diffStates
} from './state.js';

// Evidence
export {
  createCommandEvidence,
  createToolEvidence,
  createObservationEvidence,
  EvidenceVerifier,
  InMemoryEvidenceStore,
  serializeEvidence,
  deserializeEvidence,
  validateEvidence
} from './evidence.js';

export type {
  VerificationCheck,
  EvidenceVerificationReport,
  EvidenceStore,
  EvidenceFilter
} from './evidence.js';

// Decision
export {
  createDecision,
  createDecisionOption,
  DecisionAnalyzer,
  InMemoryDecisionStore,
  serializeDecision,
  deserializeDecision,
  validateDecision
} from './decision.js';

export type {
  DecisionScore,
  DecisionComparison,
  DecisionValidation,
  DecisionStore,
  DecisionFilter
} from './decision.js';

// ============================================================================
// Kernel - Main orchestrator
// ============================================================================

import type { Entity, Event, State, Evidence, Decision, KernelConfig } from './types.js';
import { DEFAULT_KERNEL_CONFIG } from './types.js';
import { createEntity, InMemoryEntityStore } from './entity.js';
import { createEvent, EventBus, InMemoryEventStore } from './event.js';
import { StateManager } from './state.js';
import { InMemoryEvidenceStore, EvidenceVerifier } from './evidence.js';
import { InMemoryDecisionStore, DecisionAnalyzer } from './decision.js';

/**
 * Kernel - The core of the AGI OS
 * Orchestrates entities, events, state, evidence, and decisions
 */
export class Kernel {
  private config: KernelConfig;
  private eventBus: EventBus;
  private entityStore: InMemoryEntityStore;
  private eventStore: InMemoryEventStore;
  private stateManager: StateManager;
  private evidenceStore: InMemoryEvidenceStore;
  private decisionStore: InMemoryDecisionStore;
  private evidenceVerifier: EvidenceVerifier;
  private decisionAnalyzer: DecisionAnalyzer;

  constructor(config: Partial<KernelConfig> = {}) {
    this.config = { ...DEFAULT_KERNEL_CONFIG, ...config };
    this.eventBus = new EventBus();
    this.entityStore = new InMemoryEntityStore();
    this.eventStore = new InMemoryEventStore();
    this.stateManager = new StateManager({
      projectId: this.config.projectId,
      ownerId: this.config.ownerId
    });
    this.evidenceStore = new InMemoryEvidenceStore();
    this.decisionStore = new InMemoryDecisionStore();
    this.evidenceVerifier = new EvidenceVerifier();
    this.decisionAnalyzer = new DecisionAnalyzer();
  }

  /**
   * Get the event bus
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Get the entity store
   */
  getEntityStore(): InMemoryEntityStore {
    return this.entityStore;
  }

  /**
   * Get the event store
   */
  getEventStore(): InMemoryEventStore {
    return this.eventStore;
  }

  /**
   * Get the state manager
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Get the evidence store
   */
  getEvidenceStore(): InMemoryEvidenceStore {
    return this.evidenceStore;
  }

  /**
   * Get the decision store
   */
  getDecisionStore(): InMemoryDecisionStore {
    return this.decisionStore;
  }

  /**
   * Get the evidence verifier
   */
  getEvidenceVerifier(): EvidenceVerifier {
    return this.evidenceVerifier;
  }

  /**
   * Get the decision analyzer
   */
  getDecisionAnalyzer(): DecisionAnalyzer {
    return this.decisionAnalyzer;
  }

  /**
   * Get the config
   */
  getConfig(): KernelConfig {
    return { ...this.config };
  }

  /**
   * Create an entity and emit event
   */
  async createEntity(
    type: Entity['type'],
    source: string,
    metadata: Record<string, unknown> = {},
    parentId?: string
  ): Promise<Entity> {
    const entity = createEntity(
      type,
      this.config.ownerId,
      this.config.projectId,
      source,
      metadata,
      parentId
    );

    await this.entityStore.save(entity);

    const event = createEvent(
      `${type}.created` as Event['type'],
      entity.id,
      this.stateManager.getCurrentRevision(),
      { entity }
    );

    await this.eventStore.append(event);
    await this.eventBus.emit(event);

    return entity;
  }

  /**
   * Record an event
   */
  async recordEvent(
    type: Event['type'],
    entityId: string,
    data: Record<string, unknown> = {},
    evidence?: Evidence
  ): Promise<Event> {
    const event = createEvent(
      type,
      entityId,
      this.stateManager.getCurrentRevision(),
      data,
      evidence
    );

    await this.eventStore.append(event);
    await this.eventBus.emit(event);

    return event;
  }

  /**
   * Record evidence
   */
  async recordEvidence(evidence: Evidence): Promise<void> {
    await this.evidenceStore.save(evidence);
    
    const event = createEvent(
      'evidence.captured',
      evidence.id,
      this.stateManager.getCurrentRevision(),
      { evidence }
    );

    await this.eventStore.append(event);
    await this.eventBus.emit(event);
  }

  /**
   * Record a decision
   */
  async recordDecision(decision: Decision): Promise<void> {
    await this.decisionStore.save(decision);
    
    const event = createEvent(
      'decision.made',
      decision.id,
      this.stateManager.getCurrentRevision(),
      { decision }
    );

    await this.eventStore.append(event);
    await this.eventBus.emit(event);
  }

  /**
   * Get current state
   */
  getCurrentState(): State {
    return this.stateManager.getCurrentState();
  }

  /**
   * Get state revision count
   */
  getStateRevisionCount(): number {
    return this.stateManager.revisionCount();
  }

  /**
   * Get event count
   */
  async getEventCount(): Promise<number> {
    return this.eventStore.count();
  }

  /**
   * Get entity count
   */
  async getEntityCount(): Promise<number> {
    return this.entityStore.count();
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.entityStore.clear();
    this.eventStore.clear();
    this.evidenceStore.clear();
    this.decisionStore.clear();
    this.stateManager.clearHistory();
    this.eventBus.clear();
  }
}

/**
 * Create a kernel instance
 */
export function createKernel(config: Partial<KernelConfig> = {}): Kernel {
  return new Kernel(config);
}
