import { describe, it, expect, beforeEach } from 'vitest';
import { ArtifactManager } from '../src/artifact-manager.js';

describe('ArtifactManager', () => {
  let mgr: ArtifactManager;
  beforeEach(() => { mgr = new ArtifactManager(); });

  it('creates artifact', () => {
    const artifact = mgr.create({ missionId: 'm1', name: 'report.md', type: 'markdown', content: '# Hello' });
    expect(artifact.id).toBeDefined();
    expect(artifact.version).toBe(1);
    expect(artifact.sha256).toContain('sha256:');
  });

  it('updates artifact', () => {
    const artifact = mgr.create({ missionId: 'm1', name: 'a.md', type: 'markdown', content: 'v1' });
    const updated = mgr.update(artifact.id, 'v2', 'Updated content');
    expect(updated?.version).toBe(2);
  });

  it('gets versions', () => {
    const artifact = mgr.create({ missionId: 'm1', name: 'a.md', type: 'markdown', content: 'v1' });
    mgr.update(artifact.id, 'v2', 'change');
    const versions = mgr.getVersions(artifact.id);
    expect(versions.length).toBe(2);
  });

  it('validates artifact', () => {
    const artifact = mgr.create({ missionId: 'm1', name: 'a.md', type: 'markdown', content: 'test' });
    const validation = mgr.validate(artifact.id);
    expect(validation.valid).toBe(true);
  });

  it('rolls back', () => {
    const artifact = mgr.create({ missionId: 'm1', name: 'a.md', type: 'markdown', content: 'v1' });
    mgr.update(artifact.id, 'v2', 'change');
    const rolled = mgr.rollback(artifact.id, 1);
    expect(rolled?.version).toBe(1);
  });

  it('gets by mission', () => {
    mgr.create({ missionId: 'm1', name: 'a.md', type: 'markdown', content: 'a' });
    mgr.create({ missionId: 'm1', name: 'b.md', type: 'markdown', content: 'b' });
    mgr.create({ missionId: 'm2', name: 'c.md', type: 'markdown', content: 'c' });
    expect(mgr.getByMission('m1').length).toBe(2);
  });

  it('deletes artifact', () => {
    const artifact = mgr.create({ missionId: 'm1', name: 'a.md', type: 'markdown', content: 'a' });
    expect(mgr.delete(artifact.id)).toBe(true);
    expect(mgr.count()).toBe(0);
  });
});
