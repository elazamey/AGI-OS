import { generateId, now } from '@agi-os/kernel';
import type { Artifact, ArtifactVersion } from './types.js';

export class ArtifactManager {
  private artifacts: Map<string, Artifact> = new Map();
  private versions: Map<string, ArtifactVersion[]> = new Map();

  create(params: {
    missionId: string;
    name: string;
    type: Artifact['type'];
    content: string;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  }): Artifact {
    const id = generateId();
    const sha256 = this.hash(params.content);
    const artifact: Artifact = {
      id,
      missionId: params.missionId,
      name: params.name,
      type: params.type,
      content: params.content,
      version: 1,
      sha256,
      createdBy: params.createdBy || 'agent',
      createdAt: now().toISOString(),
      metadata: params.metadata || {},
    };
    this.artifacts.set(id, artifact);
    this.versions.set(id, [{ version: 1, sha256, createdAt: now().toISOString(), changeDescription: 'Initial creation' }]);
    return artifact;
  }

  update(id: string, content: string, changeDescription: string): Artifact | undefined {
    const artifact = this.artifacts.get(id);
    if (!artifact) return undefined;
    artifact.content = content;
    artifact.sha256 = this.hash(content);
    artifact.version++;
    const vers = this.versions.get(id) || [];
    vers.push({ version: artifact.version, sha256: artifact.sha256, createdAt: now().toISOString(), changeDescription });
    this.versions.set(id, vers);
    return artifact;
  }

  get(id: string): Artifact | undefined { return this.artifacts.get(id); }

  getByMission(missionId: string): Artifact[] {
    return Array.from(this.artifacts.values()).filter(a => a.missionId === missionId);
  }

  getVersions(id: string): ArtifactVersion[] { return this.versions.get(id) || []; }

  validate(id: string): { valid: boolean; currentHash: string; expectedHash: string } {
    const artifact = this.artifacts.get(id);
    if (!artifact) return { valid: false, currentHash: '', expectedHash: '' };
    const currentHash = this.hash(artifact.content);
    return { valid: currentHash === artifact.sha256, currentHash, expectedHash: artifact.sha256 };
  }

  rollback(id: string, targetVersion: number): Artifact | undefined {
    const artifact = this.artifacts.get(id);
    const vers = this.versions.get(id);
    if (!artifact || !vers) return undefined;
    const target = vers.find(v => v.version === targetVersion);
    if (!target) return undefined;
    artifact.version = targetVersion;
    artifact.sha256 = target.sha256;
    return artifact;
  }

  delete(id: string): boolean {
    this.versions.delete(id);
    return this.artifacts.delete(id);
  }

  count(): number { return this.artifacts.size; }

  private hash(data: string): string {
    let h = 0;
    for (let i = 0; i < data.length; i++) { h = ((h << 5) - h + data.charCodeAt(i)) | 0; }
    return `sha256:${Math.abs(h).toString(16).padStart(8, '0')}`;
  }
}
