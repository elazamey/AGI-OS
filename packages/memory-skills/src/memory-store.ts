import { generateId, now } from '@agi-os/kernel';
import type { MemoryItem, MemoryTier } from './types.js';

export class MemoryStore {
  private items: Map<string, MemoryItem> = new Map();

  store(params: {
    tier: MemoryTier;
    content: string;
    metadata?: Record<string, unknown>;
    importance?: number;
    confidence?: number;
    source: string;
    tags?: string[];
    missionId?: string;
    taskId?: string;
  }): MemoryItem {
    const item: MemoryItem = {
      id: generateId(),
      tier: params.tier,
      content: params.content,
      metadata: params.metadata || {},
      importance: params.importance ?? 0.5,
      confidence: params.confidence ?? 0.8,
      source: params.source,
      createdAt: now().toISOString(),
      lastAccessedAt: now().toISOString(),
      accessCount: 0,
      tags: params.tags || [],
      missionId: params.missionId,
      taskId: params.taskId,
    };
    this.items.set(item.id, item);
    return item;
  }

  retrieve(id: string): MemoryItem | undefined {
    const item = this.items.get(id);
    if (item) {
      item.lastAccessedAt = now().toISOString();
      item.accessCount++;
    }
    return item;
  }

  query(params: { text?: string; tier?: MemoryTier; tags?: string[]; missionId?: string; minImportance?: number; limit?: number }): MemoryItem[] {
    let results = Array.from(this.items.values());

    if (params.tier) results = results.filter(i => i.tier === params.tier);
    if (params.missionId) results = results.filter(i => i.missionId === params.missionId);
    if (params.minImportance) results = results.filter(i => i.importance >= params.minImportance!);
    if (params.tags && params.tags.length > 0) {
      results = results.filter(i => params.tags!.some(t => i.tags.includes(t)));
    }
    if (params.text) {
      const lower = params.text.toLowerCase();
      results = results.filter(i => i.content.toLowerCase().includes(lower));
    }

    results.sort((a, b) => b.importance - a.importance);
    if (params.limit) results = results.slice(0, params.limit);
    return results;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }

  count(): number { return this.items.size; }

  getByTier(tier: MemoryTier): MemoryItem[] {
    return Array.from(this.items.values()).filter(i => i.tier === tier);
  }

  getStats(): { total: number; byTier: Record<string, number>; averageImportance: number } {
    const all = Array.from(this.items.values());
    const byTier: Record<string, number> = {};
    for (const item of all) {
      byTier[item.tier] = (byTier[item.tier] || 0) + 1;
    }
    return {
      total: all.length,
      byTier,
      averageImportance: all.length > 0 ? all.reduce((s, i) => s + i.importance, 0) / all.length : 0,
    };
  }

  clear(tier?: MemoryTier): void {
    if (tier) {
      for (const [id, item] of this.items) {
        if (item.tier === tier) this.items.delete(id);
      }
    } else {
      this.items.clear();
    }
  }
}
