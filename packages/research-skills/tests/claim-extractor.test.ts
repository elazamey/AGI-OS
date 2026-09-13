import { describe, it, expect } from 'vitest';
import { ClaimExtractor } from '../src/claim-extractor.js';

describe('ClaimExtractor', () => {
  const extractor = new ClaimExtractor();

  it('extracts claims', () => {
    const claims = extractor.extract('This is a long enough sentence that should be extracted as a claim from the text.', 's1');
    expect(claims.length).toBeGreaterThan(0);
    expect(claims[0].text).toBeDefined();
  });

  it('cross-verifies', () => {
    const claims = [{ id: 'c1', text: 'test', evidence: [{ sourceId: 's1', text: 'test', relevance: 0.8, supports: true }], confidence: 0.5, sources: ['s1'] }];
    const verified = extractor.crossVerify(claims);
    expect(verified[0].confidence).toBe(1);
  });

  it('detects contradictions', () => {
    const claims = [
      { id: 'c1', text: 'AI is not useful', evidence: [], confidence: 0.9, sources: [] },
      { id: 'c2', text: 'AI is useful', evidence: [], confidence: 0.9, sources: [] },
    ];
    const contradictions = extractor.detectContradictions(claims);
    expect(contradictions.length).toBeGreaterThan(0);
  });
});
