import { generateId, now } from '@agi-os/kernel';
import type { SBOMEntry } from './types.js';

export class SBOMGenerator {
  private entries: Map<string, SBOMEntry> = new Map();

  scanPackage(pkgJson: { name: string; version: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }, depth: number = 0): SBOMEntry[] {
    const results: SBOMEntry[] = [];
    const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
    
    for (const [name, version] of Object.entries(deps)) {
      if (!this.entries.has(name)) {
        const entry: SBOMEntry = { name, version, license: 'unknown', depth };
        this.entries.set(name, entry);
        results.push(entry);
      }
    }
    return results;
  }

  addEntry(entry: SBOMEntry): void {
    this.entries.set(entry.name, entry);
  }

  getEntries(): SBOMEntry[] {
    return Array.from(this.entries.values());
  }

  getEntry(name: string): SBOMEntry | undefined {
    return this.entries.get(name);
  }

  getByLicense(license: string): SBOMEntry[] {
    return this.getEntries().filter(e => e.license === license);
  }

  getStats(): { total: number; unique: number; byDepth: Record<number, number> } {
    const entries = this.getEntries();
    const byDepth: Record<number, number> = {};
    for (const e of entries) {
      byDepth[e.depth] = (byDepth[e.depth] || 0) + 1;
    }
    return { total: entries.length, unique: entries.length, byDepth };
  }
}
