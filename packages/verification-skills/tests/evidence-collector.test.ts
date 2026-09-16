import { describe, it, expect, beforeEach } from 'vitest';
import { EvidenceCollector } from '../src/evidence-collector.js';
import type { EvidenceItem } from '../src/types.js';

describe('EvidenceCollector', () => {
  let collector: EvidenceCollector;

  beforeEach(() => {
    collector = new EvidenceCollector();
  });

  it('collects evidence', () => {
    const items: EvidenceItem[] = [
      { type: 'test_passed', description: 'test', value: true, verified: true },
    ];
    const bundle = collector.collect('m1', 't1', items);
    expect(bundle.items.length).toBe(1);
    expect(bundle.overallConfidence).toBe(1);
  });

  it('adds evidence to bundle', () => {
    const bundle = collector.collect('m1', 't1', []);
    collector.addEvidence(bundle.id, {
      type: 'file_exists',
      description: 'file',
      value: true,
      verified: true,
    });
    expect(collector.getBundle(bundle.id)?.items.length).toBe(1);
  });

  it('gets bundles for mission', () => {
    collector.collect('m1', 't1', []);
    collector.collect('m1', 't2', []);
    collector.collect('m2', 't3', []);
    expect(collector.getBundlesForMission('m1').length).toBe(2);
  });

  it('returns confidence level', () => {
    const bundle = collector.collect('m1', 't1', [
      { type: 'test_passed', description: 't1', value: true, verified: true },
      { type: 'test_passed', description: 't2', value: true, verified: true },
    ]);
    expect(collector.getConfidenceLevel(bundle)).toBe('HIGH');
  });

  it('clears', () => {
    collector.collect('m1', 't1', []);
    collector.clear();
    expect(collector.getBundlesForMission('m1').length).toBe(0);
  });
});
