export interface Artifact {
  id: string;
  missionId: string;
  name: string;
  type: 'file' | 'report' | 'code' | 'dataset' | 'screenshot' | 'csv' | 'pdf' | 'html' | 'json' | 'markdown';
  content: string;
  version: number;
  sha256: string;
  createdBy: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface ArtifactVersion {
  version: number;
  sha256: string;
  createdAt: string;
  changeDescription: string;
}
