import { describe, it, expect } from 'vitest';
import { ReportGenerator } from '../src/report-generator.js';

describe('ReportGenerator', () => {
  const generator = new ReportGenerator();

  it('generates report', () => {
    const report = generator.generate({
      query: 'test query',
      claims: [{ id: 'c1', text: 'claim', evidence: [], confidence: 0.8, sources: [] }],
      sources: [{ id: 's1', url: 'http://test.com', title: 'Test', domain: 'test.com', quality: 0.9, retrievedAt: new Date().toISOString() }],
    });
    expect(report.query).toBe('test query');
    expect(report.claims.length).toBe(1);
  });

  it('formats markdown', () => {
    const report = generator.generate({ query: 'test', claims: [], sources: [] });
    const md = generator.formatMarkdown(report);
    expect(md).toContain('# Research');
  });

  it('calculates overall confidence', () => {
    const report = generator.generate({
      query: 'test',
      claims: [
        { id: 'c1', text: 'a', evidence: [], confidence: 0.8, sources: [] },
        { id: 'c2', text: 'b', evidence: [], confidence: 0.6, sources: [] },
      ],
      sources: [],
    });
    expect(report.overallConfidence).toBeCloseTo(0.7);
  });
});
