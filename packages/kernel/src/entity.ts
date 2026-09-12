// ============================================================================
// AGI OS - Entity System
// Base unit of the system with lifecycle management
// ============================================================================

import { generateId, now, deepClone } from './utils.js';
import type { Entity, EntityType } from './types.js';

/**
 * Create a new entity
 */
export function createEntity(
  type: EntityType,
  ownerId: string,
  projectId: string,
  source: string,
  metadata: Record<string, unknown> = {},
  parentId?: string
): Entity {
  const timestamp = now();
  const id = generateId();

  return {
    id,
    type,
    ownerId,
    projectId,
    source,
    createdAt: timestamp,
    updatedAt: timestamp,
    parentId,
    provenance: {
      source,
      version: '0.1.0',
      timestamp,
      parentId,
      metadata: {
        ...metadata,
        createdBy: 'kernel'
      }
    },
    metadata: deepClone(metadata)
  };
}

/**
 * Update an entity's metadata
 */
export function updateEntity(
  entity: Entity,
  updates: Partial<Pick<Entity, 'metadata' | 'parentId'>>
): Entity {
  const updated = deepClone(entity);
  
  if (updates.metadata) {
    updated.metadata = {
      ...updated.metadata,
      ...updates.metadata
    };
  }
  
  if (updates.parentId !== undefined) {
    updated.parentId = updates.parentId;
  }
  
  updated.updatedAt = now();
  
  return updated;
}

/**
 * Get entity lineage (parent chain)
 */
export function getEntityLineage(
  entity: Entity,
  getEntity: (id: string) => Entity | null
): Entity[] {
  const lineage: Entity[] = [entity];
  let current = entity;
  
  while (current.parentId) {
    const parent = getEntity(current.parentId);
    if (!parent) break;
    lineage.push(parent);
    current = parent;
  }
  
  return lineage;
}

/**
 * Check if two entities are related
 */
export function areEntitiesRelated(
  entity1: Entity,
  entity2: Entity,
  getEntity: (id: string) => Entity | null
): boolean {
  // Check direct parent relationship
  if (entity1.parentId === entity2.id) return true;
  if (entity2.parentId === entity1.id) return true;
  
  // Check shared project (entities in same project are considered related)
  if (entity1.projectId === entity2.projectId) return true;
  
  // Check lineage
  const lineage1 = getEntityLineage(entity1, getEntity);
  const lineage2 = getEntityLineage(entity2, getEntity);
  
  return lineage1.some((e1) => lineage2.some((e2) => e1.id === e2.id));
}

/**
 * Serialize entity to JSON
 */
export function serializeEntity(entity: Entity): string {
  return JSON.stringify(entity, null, 2);
}

/**
 * Deserialize entity from JSON
 */
export function deserializeEntity(json: string): Entity {
  const data = JSON.parse(json);
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    provenance: {
      ...data.provenance,
      timestamp: new Date(data.provenance.timestamp)
    }
  };
}

/**
 * Validate entity structure
 */
export function validateEntity(entity: unknown): entity is Entity {
  if (typeof entity !== 'object' || entity === null) {
    return false;
  }
  
  const e = entity as Record<string, unknown>;
  
  return (
    typeof e.id === 'string' &&
    typeof e.type === 'string' &&
    typeof e.ownerId === 'string' &&
    typeof e.projectId === 'string' &&
    typeof e.source === 'string' &&
    e.createdAt instanceof Date &&
    e.updatedAt instanceof Date &&
    typeof e.provenance === 'object' &&
    e.provenance !== null &&
    typeof (e.provenance as Record<string, unknown>).source === 'string'
  );
}

/**
 * Entity store interface
 */
export interface EntityStore {
  save(entity: Entity): Promise<void>;
  get(id: string): Promise<Entity | null>;
  list(filter?: EntityFilter): Promise<Entity[]>;
  delete(id: string): Promise<boolean>;
  count(filter?: EntityFilter): Promise<number>;
}

export interface EntityFilter {
  type?: EntityType;
  ownerId?: string;
  projectId?: string;
  source?: string;
  parentId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * In-memory entity store (for testing)
 */
export class InMemoryEntityStore implements EntityStore {
  private entities: Map<string, Entity> = new Map();

  async save(entity: Entity): Promise<void> {
    this.entities.set(entity.id, deepClone(entity));
  }

  async get(id: string): Promise<Entity | null> {
    const entity = this.entities.get(id);
    return entity ? deepClone(entity) : null;
  }

  async list(filter?: EntityFilter): Promise<Entity[]> {
    let entities = Array.from(this.entities.values());
    
    if (filter) {
      if (filter.type) {
        entities = entities.filter((e) => e.type === filter.type);
      }
      if (filter.ownerId) {
        entities = entities.filter((e) => e.ownerId === filter.ownerId);
      }
      if (filter.projectId) {
        entities = entities.filter((e) => e.projectId === filter.projectId);
      }
      if (filter.source) {
        entities = entities.filter((e) => e.source === filter.source);
      }
      if (filter.parentId) {
        entities = entities.filter((e) => e.parentId === filter.parentId);
      }
      if (filter.createdAfter) {
        entities = entities.filter(
          (e) => e.createdAt >= filter.createdAfter!
        );
      }
      if (filter.createdBefore) {
        entities = entities.filter(
          (e) => e.createdAt <= filter.createdBefore!
        );
      }
    }
    
    return entities.map(deepClone);
  }

  async delete(id: string): Promise<boolean> {
    return this.entities.delete(id);
  }

  async count(filter?: EntityFilter): Promise<number> {
    if (!filter) {
      return this.entities.size;
    }
    const entities = await this.list(filter);
    return entities.length;
  }

  clear(): void {
    this.entities.clear();
  }
}
