// ============================================================================
// AGI OS - World State
// Current state of the world: entities, relationships, constraints, beliefs
// ============================================================================

import { generateId, now } from '@agi-os/kernel';
import type {
  WorldState,
  WorldEntity,
  WorldRelationship,
  WorldConstraint,
  WorldBelief,
  WorldObservation,
  WorldResource,
} from './types.js';

// ---------------------------------------------------------------------------
// World State Manager
// ---------------------------------------------------------------------------
export class WorldStateManager {
  private state: WorldState;

  constructor() {
    this.state = this.createEmptyState();
  }

  /**
   * Get current world state
   */
  getState(): WorldState {
    return this.cloneState(this.state);
  }

  /**
   * Add an entity
   */
  addEntity(entity: Omit<WorldEntity, 'id'>): WorldEntity {
    const full: WorldEntity = { ...entity, id: generateId() };
    this.state.entities.push(full);
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return full;
  }

  /**
   * Update entity state
   */
  updateEntity(entityId: string, newState: Record<string, unknown>): boolean {
    const entity = this.state.entities.find((e) => e.id === entityId);
    if (!entity) return false;
    entity.state = { ...entity.state, ...newState };
    entity.lastObservedAt = now().toISOString();
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return true;
  }

  /**
   * Remove entity
   */
  removeEntity(entityId: string): boolean {
    const idx = this.state.entities.findIndex((e) => e.id === entityId);
    if (idx < 0) return false;
    this.state.entities.splice(idx, 1);
    this.state.relationships = this.state.relationships.filter(
      (r) => r.sourceId !== entityId && r.targetId !== entityId
    );
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return true;
  }

  /**
   * Get entity by ID
   */
  getEntity(entityId: string): WorldEntity | undefined {
    return this.state.entities.find((e) => e.id === entityId);
  }

  /**
   * Get entities by type
   */
  getEntitiesByType(type: string): WorldEntity[] {
    return this.state.entities.filter((e) => e.type === type);
  }

  // -----------------------------------------------------------------------
  // Relationships
  // -----------------------------------------------------------------------
  addRelationship(rel: Omit<WorldRelationship, 'id'>): WorldRelationship {
    const full: WorldRelationship = { ...rel, id: generateId() };
    this.state.relationships.push(full);
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return full;
  }

  getRelationshipsForEntity(entityId: string): WorldRelationship[] {
    return this.state.relationships.filter(
      (r) => r.sourceId === entityId || r.targetId === entityId
    );
  }

  removeRelationship(relId: string): boolean {
    const idx = this.state.relationships.findIndex((r) => r.id === relId);
    if (idx < 0) return false;
    this.state.relationships.splice(idx, 1);
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return true;
  }

  // -----------------------------------------------------------------------
  // Constraints
  // -----------------------------------------------------------------------
  addConstraint(constraint: Omit<WorldConstraint, 'id'>): WorldConstraint {
    const full: WorldConstraint = { ...constraint, id: generateId() };
    this.state.constraints.push(full);
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return full;
  }

  getActiveConstraints(): WorldConstraint[] {
    return this.state.constraints.filter((c) => c.enabled);
  }

  removeConstraint(constraintId: string): boolean {
    const idx = this.state.constraints.findIndex((c) => c.id === constraintId);
    if (idx < 0) return false;
    this.state.constraints.splice(idx, 1);
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return true;
  }

  // -----------------------------------------------------------------------
  // Beliefs
  // -----------------------------------------------------------------------
  addBelief(belief: Omit<WorldBelief, 'id'>): WorldBelief {
    // Check for existing belief with same S-P-O
    const existing = this.state.beliefs.find(
      (b) =>
        b.subject === belief.subject &&
        b.predicate === belief.predicate &&
        b.object === belief.object
    );

    if (existing) {
      existing.confidence = Math.min(
        1.0,
        Math.max(existing.confidence, belief.confidence) + 0.05
      );
      existing.evidenceRefs.push(...belief.evidenceRefs);
      existing.lastUpdated = now().toISOString();
      this.state.revision++;
      this.state.timestamp = now().toISOString();
      return existing;
    }

    const full: WorldBelief = {
      ...belief,
      id: generateId(),
      lastUpdated: now().toISOString(),
    };
    this.state.beliefs.push(full);
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return full;
  }

  getBeliefsBySubject(subject: string): WorldBelief[] {
    return this.state.beliefs.filter((b) => b.subject === subject);
  }

  removeBelief(beliefId: string): boolean {
    const idx = this.state.beliefs.findIndex((b) => b.id === beliefId);
    if (idx < 0) return false;
    this.state.beliefs.splice(idx, 1);
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return true;
  }

  // -----------------------------------------------------------------------
  // Observations
  // -----------------------------------------------------------------------
  addObservation(obs: Omit<WorldObservation, 'id'>): WorldObservation {
    const full: WorldObservation = { ...obs, id: generateId() };
    this.state.observations.push(full);
    // Keep only last 100 observations
    if (this.state.observations.length > 100) {
      this.state.observations = this.state.observations.slice(-100);
    }
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return full;
  }

  getRecentObservations(limit: number = 10): WorldObservation[] {
    return this.state.observations.slice(-limit);
  }

  // -----------------------------------------------------------------------
  // Resources
  // -----------------------------------------------------------------------
  addResource(resource: Omit<WorldResource, 'id'>): WorldResource {
    const full: WorldResource = { ...resource, id: generateId() };
    this.state.resources.push(full);
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return full;
  }

  updateResourceUsage(resourceId: string, used: number): boolean {
    const resource = this.state.resources.find((r) => r.id === resourceId);
    if (!resource) return false;
    resource.used = used;
    resource.available = used < resource.capacity;
    this.state.revision++;
    this.state.timestamp = now().toISOString();
    return true;
  }

  getAvailableResources(): WorldResource[] {
    return this.state.resources.filter((r) => r.available);
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------
  getRevision(): number {
    return this.state.revision;
  }

  reset(): void {
    this.state = this.createEmptyState();
  }

  private createEmptyState(): WorldState {
    return {
      id: generateId(),
      revision: 0,
      entities: [],
      relationships: [],
      constraints: [],
      beliefs: [],
      observations: [],
      resources: [],
      timestamp: now().toISOString(),
    };
  }

  private cloneState(state: WorldState): WorldState {
    return JSON.parse(JSON.stringify(state));
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createWorldStateManager(): WorldStateManager {
  return new WorldStateManager();
}
