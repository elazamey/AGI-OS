import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEntity,
  updateEntity,
  getEntityLineage,
  areEntitiesRelated,
  serializeEntity,
  deserializeEntity,
  validateEntity,
  InMemoryEntityStore
} from '../src/entity.js';
import type { Entity } from '../src/types.js';

describe('Entity', () => {
  let store: InMemoryEntityStore;

  beforeEach(() => {
    store = new InMemoryEntityStore();
  });

  describe('createEntity', () => {
    it('should create an entity with required fields', () => {
      const entity = createEntity(
        'goal',
        'user-1',
        'project-1',
        'test',
        { name: 'Test Goal' }
      );

      expect(entity).toBeDefined();
      expect(entity.id).toBeDefined();
      expect(entity.type).toBe('goal');
      expect(entity.ownerId).toBe('user-1');
      expect(entity.projectId).toBe('project-1');
      expect(entity.source).toBe('test');
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
      expect(entity.metadata).toEqual({ name: 'Test Goal' });
      expect(entity.provenance).toBeDefined();
      expect(entity.provenance.source).toBe('test');
    });

    it('should create entity with parent', () => {
      const parent = createEntity('mission', 'user-1', 'project-1', 'test');
      const child = createEntity('task', 'user-1', 'project-1', 'test', {}, parent.id);

      expect(child.parentId).toBe(parent.id);
    });

    it('should create entity with empty metadata', () => {
      const entity = createEntity('goal', 'user-1', 'project-1', 'test');
      expect(entity.metadata).toEqual({});
    });
  });

  describe('updateEntity', () => {
    it('should update entity metadata', () => {
      const entity = createEntity('goal', 'user-1', 'project-1', 'test', { name: 'Old' });
      const updated = updateEntity(entity, { metadata: { name: 'New' } });

      expect(updated.metadata.name).toBe('New');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(entity.updatedAt.getTime());
    });

    it('should merge metadata', () => {
      const entity = createEntity('goal', 'user-1', 'project-1', 'test', { a: 1, b: 2 });
      const updated = updateEntity(entity, { metadata: { b: 3, c: 4 } });

      expect(updated.metadata).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should update parentId', () => {
      const entity = createEntity('task', 'user-1', 'project-1', 'test');
      const updated = updateEntity(entity, { parentId: 'new-parent' });

      expect(updated.parentId).toBe('new-parent');
    });

    it('should not mutate original entity', () => {
      const entity = createEntity('goal', 'user-1', 'project-1', 'test', { name: 'Old' });
      updateEntity(entity, { metadata: { name: 'New' } });

      expect(entity.metadata.name).toBe('Old');
    });
  });

  describe('getEntityLineage', () => {
    it('should return lineage of entities', () => {
      const grandparent = createEntity('mission', 'user-1', 'project-1', 'test');
      const parent = createEntity('task', 'user-1', 'project-1', 'test', {}, grandparent.id);
      const child = createEntity('task', 'user-1', 'project-1', 'test', {}, parent.id);

      const getEntity = (id: string) => {
        const entities = [grandparent, parent, child];
        return entities.find((e) => e.id === id) || null;
      };

      const lineage = getEntityLineage(child, getEntity);
      expect(lineage).toHaveLength(3);
      expect(lineage[0].id).toBe(child.id);
      expect(lineage[1].id).toBe(parent.id);
      expect(lineage[2].id).toBe(grandparent.id);
    });

    it('should return single entity if no parent', () => {
      const entity = createEntity('goal', 'user-1', 'project-1', 'test');
      const getEntity = () => null;

      const lineage = getEntityLineage(entity, getEntity);
      expect(lineage).toHaveLength(1);
    });
  });

  describe('areEntitiesRelated', () => {
    it('should detect parent-child relationship', () => {
      const parent = createEntity('mission', 'user-1', 'project-1', 'test');
      const child = createEntity('task', 'user-1', 'project-1', 'test', {}, parent.id);

      const getEntity = (id: string) => {
        if (id === parent.id) return parent;
        return null;
      };

      expect(areEntitiesRelated(child, parent, getEntity)).toBe(true);
    });

    it('should detect same project', () => {
      const entity1 = createEntity('goal', 'user-1', 'project-1', 'test');
      const entity2 = createEntity('task', 'user-1', 'project-1', 'test');

      const getEntity = () => null;

      expect(areEntitiesRelated(entity1, entity2, getEntity)).toBe(true);
    });

    it('should return false for unrelated entities', () => {
      const entity1 = createEntity('goal', 'user-1', 'project-1', 'test');
      const entity2 = createEntity('task', 'user-1', 'project-2', 'test');

      const getEntity = () => null;

      expect(areEntitiesRelated(entity1, entity2, getEntity)).toBe(false);
    });
  });

  describe('serialize/deserialize', () => {
    it('should roundtrip entity', () => {
      const entity = createEntity('goal', 'user-1', 'project-1', 'test', { name: 'Test' });
      const json = serializeEntity(entity);
      const deserialized = deserializeEntity(json);

      expect(deserialized.id).toBe(entity.id);
      expect(deserialized.type).toBe(entity.type);
      expect(deserialized.createdAt.getTime()).toBe(entity.createdAt.getTime());
    });
  });

  describe('validateEntity', () => {
    it('should validate correct entity', () => {
      const entity = createEntity('goal', 'user-1', 'project-1', 'test');
      expect(validateEntity(entity)).toBe(true);
    });

    it('should reject invalid entity', () => {
      expect(validateEntity(null)).toBe(false);
      expect(validateEntity({})).toBe(false);
      expect(validateEntity({ id: '123' })).toBe(false);
    });
  });

  describe('InMemoryEntityStore', () => {
    it('should save and retrieve entity', async () => {
      const entity = createEntity('goal', 'user-1', 'project-1', 'test');
      await store.save(entity);

      const retrieved = await store.get(entity.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(entity.id);
    });

    it('should return null for non-existent entity', async () => {
      const retrieved = await store.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should list entities with filter', async () => {
      await store.save(createEntity('goal', 'user-1', 'project-1', 'test'));
      await store.save(createEntity('task', 'user-1', 'project-1', 'test'));
      await store.save(createEntity('goal', 'user-1', 'project-1', 'test'));

      const goals = await store.list({ type: 'goal' });
      expect(goals).toHaveLength(2);

      const tasks = await store.list({ type: 'task' });
      expect(tasks).toHaveLength(1);
    });

    it('should delete entity', async () => {
      const entity = createEntity('goal', 'user-1', 'project-1', 'test');
      await store.save(entity);

      const deleted = await store.delete(entity.id);
      expect(deleted).toBe(true);

      const retrieved = await store.get(entity.id);
      expect(retrieved).toBeNull();
    });

    it('should count entities', async () => {
      await store.save(createEntity('goal', 'user-1', 'project-1', 'test'));
      await store.save(createEntity('task', 'user-1', 'project-1', 'test'));

      expect(await store.count()).toBe(2);
      expect(await store.count({ type: 'goal' })).toBe(1);
    });

    it('should not return mutated data', async () => {
      const entity = createEntity('goal', 'user-1', 'project-1', 'test', { name: 'Original' });
      await store.save(entity);

      const retrieved = await store.get(entity.id);
      retrieved!.metadata.name = 'Modified';

      const retrieved2 = await store.get(entity.id);
      expect(retrieved2!.metadata.name).toBe('Original');
    });
  });
});
