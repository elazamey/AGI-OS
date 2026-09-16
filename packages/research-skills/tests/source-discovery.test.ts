import { describe, it, expect } from 'vitest';
import { SourceDiscovery } from '../src/source-discovery.js';

describe('SourceDiscovery', () => {
  const discovery = new SourceDiscovery();

  it('discovers sources', () => {
    const sources = discovery.discover('AI agents');
    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].url).toBeDefined();
  });

  it('ranks sources', () => {
    const sources = discovery.discover('test');
    const ranked = discovery.rankSources(sources);
    expect(ranked[0].quality).toBeGreaterThanOrEqual(ranked[ranked.length - 1].quality);
  });

  it('deduplicates', () => {
    const sources = discovery.discover('test');
    const deduped = discovery.deduplicate(sources);
    expect(deduped.length).toBeLessThanOrEqual(sources.length);
  });
});
