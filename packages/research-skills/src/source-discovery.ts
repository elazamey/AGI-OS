import { generateId, now } from '@agi-os/kernel';
import type { ResearchSource } from './types.js';

export class SourceDiscovery {
  discover(query: string): ResearchSource[] {
    const domains = ['wikipedia.org', 'github.com', 'stackoverflow.com', 'arxiv.org', 'docs.python.org'];
    return domains.map((domain, i) => ({
      id: generateId(),
      url: `https://${domain}/search?q=${encodeURIComponent(query)}`,
      title: `Source ${i + 1} for: ${query}`,
      domain,
      quality: 0.5 + Math.random() * 0.5,
      retrievedAt: now().toISOString(),
    }));
  }

  rankSources(sources: ResearchSource[]): ResearchSource[] {
    return [...sources].sort((a, b) => b.quality - a.quality);
  }

  deduplicate(sources: ResearchSource[]): ResearchSource[] {
    const seen = new Set<string>();
    return sources.filter(s => {
      if (seen.has(s.domain)) return false;
      seen.add(s.domain);
      return true;
    });
  }
}
