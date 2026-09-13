export type MemoryTier = 'working' | 'session' | 'task' | 'project' | 'longterm' | 'episodic' | 'semantic' | 'procedural';

export interface MemoryItem {
  id: string;
  tier: MemoryTier;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  confidence: number;
  source: string;
  createdAt: string;
  lastAccessedAt: string;
  accessCount: number;
  tags: string[];
  missionId?: string;
  taskId?: string;
}

export interface MemoryQuery {
  text?: string;
  tier?: MemoryTier;
  tags?: string[];
  missionId?: string;
  minImportance?: number;
  limit?: number;
}

export interface MemoryStats {
  total: number;
  byTier: Record<MemoryTier, number>;
  averageImportance: number;
  averageConfidence: number;
}
