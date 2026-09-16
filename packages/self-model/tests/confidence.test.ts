import { describe, it, expect, beforeEach } from 'vitest';
import { ConfidenceScorer } from '../src/confidence.js';

describe('ConfidenceScorer', () => {
  let scorer: ConfidenceScorer;

  beforeEach(() => {
    scorer = new ConfidenceScorer();
  });

  it('should record confidence for a domain', () => {
    const dc = scorer.record('software', 0.8, 'm1');
    expect(dc.domain).toBe('software');
    expect(dc.score).toBe(0.8);
    expect(dc.sampleSize).toBe(1);
  });

  it('should compute exponential moving average', () => {
    scorer.record('software', 0.9, 'm1');
    scorer.record('software', 0.5, 'm2');
    const dc = scorer.getConfidence('software')!;
    // EMA: 0.9 * 0.7 + 0.5 * 0.3 = 0.63 + 0.15 = 0.78
    expect(dc.score).toBeCloseTo(0.78, 1);
  });

  it('should return 0 for unknown domain', () => {
    expect(scorer.getScore('unknown')).toBe(0);
  });

  it('should get ranked domains', () => {
    scorer.record('a', 0.3, 'm1');
    scorer.record('b', 0.9, 'm2');
    const ranked = scorer.getRankedDomains();
    expect(ranked[0].domain).toBe('b');
  });

  it('should get weakest domains', () => {
    scorer.record('a', 0.3, 'm1');
    scorer.record('b', 0.9, 'm2');
    expect(scorer.getWeakest(1)[0].domain).toBe('a');
  });

  it('should get strongest domains', () => {
    scorer.record('a', 0.3, 'm1');
    scorer.record('b', 0.9, 'm2');
    expect(scorer.getStrongest(1)[0].domain).toBe('b');
  });

  it('should compute overall confidence', () => {
    scorer.record('a', 0.6, 'm1');
    scorer.record('b', 0.8, 'm2');
    expect(scorer.getOverallConfidence()).toBeCloseTo(0.7);
  });

  it('should return 0 overall for empty', () => {
    expect(scorer.getOverallConfidence()).toBe(0);
  });

  it('should check threshold', () => {
    scorer.record('a', 0.7, 'm1');
    expect(scorer.meetsThreshold('a', 0.5)).toBe(true);
    expect(scorer.meetsThreshold('a', 0.9)).toBe(false);
  });

  it('should track history', () => {
    scorer.record('a', 0.5, 'm1');
    scorer.record('a', 0.7, 'm2');
    expect(scorer.getHistory('a')).toHaveLength(2);
  });

  it('should compute improving trend', () => {
    for (let i = 0; i < 6; i++) {
      scorer.record('a', 0.2 + i * 0.15, `m${i}`);
    }
    expect(scorer.getConfidence('a')!.trend).toBe('improving');
  });

  it('should compute declining trend', () => {
    for (let i = 0; i < 6; i++) {
      scorer.record('a', 0.9 - i * 0.15, `m${i}`);
    }
    expect(scorer.getConfidence('a')!.trend).toBe('declining');
  });

  it('should compute stable trend', () => {
    for (let i = 0; i < 6; i++) {
      scorer.record('a', 0.5 + (i % 2 === 0 ? 0.01 : -0.01), `m${i}`);
    }
    expect(scorer.getConfidence('a')!.trend).toBe('stable');
  });

  it('should get improving domains', () => {
    for (let i = 0; i < 6; i++) scorer.record('up', 0.2 + i * 0.2, `m${i}`);
    scorer.record('flat', 0.5, 'm1');
    expect(scorer.getImproving()).toHaveLength(1);
  });

  it('should get declining domains', () => {
    for (let i = 0; i < 6; i++) scorer.record('down', 0.9 - i * 0.2, `m${i}`);
    scorer.record('flat', 0.5, 'm1');
    expect(scorer.getDeclining()).toHaveLength(1);
  });

  it('should reset', () => {
    scorer.record('a', 0.5, 'm1');
    scorer.reset();
    expect(scorer.getDomains()).toHaveLength(0);
  });
});
