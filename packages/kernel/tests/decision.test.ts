import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDecision,
  createDecisionOption,
  DecisionAnalyzer,
  InMemoryDecisionStore,
  serializeDecision,
  deserializeDecision,
  validateDecision
} from '../src/decision.js';

describe('Decision', () => {
  describe('createDecision', () => {
    it('should create a decision with required fields', () => {
      const options = [
        createDecisionOption('Option A', 'Description A', 0.3, 0.8, 'Good outcome'),
        createDecisionOption('Option B', 'Description B', 0.6, 0.5, 'Risky outcome')
      ];

      const decision = createDecision(
        'tool_selection',
        'Which tool to use?',
        options,
        options[0].id,
        'Option A has lower risk',
        0.85,
        'R001'
      );

      expect(decision).toBeDefined();
      expect(decision.id).toBeDefined();
      expect(decision.type).toBe('tool_selection');
      expect(decision.context).toBe('Which tool to use?');
      expect(decision.options).toHaveLength(2);
      expect(decision.selected).toBe(options[0].id);
      expect(decision.reasoning).toBe('Option A has lower risk');
      expect(decision.confidence).toBe(0.85);
      expect(decision.stateRevision).toBe('R001');
    });

    it('should create decision with evidence', () => {
      const options = [createDecisionOption('A', 'Desc', 0.1, 0.9, 'Good')];
      const evidence = {
        id: 'ev-1',
        operation: 'test',
        timestamp: new Date(),
        stateRevision: 'R001'
      };

      const decision = createDecision(
        'tool_selection', 'Context', options, options[0].id, 'Reasoning', 0.9, 'R001', evidence
      );

      expect(decision.evidence).toBeDefined();
      expect(decision.evidence!.id).toBe('ev-1');
    });
  });

  describe('createDecisionOption', () => {
    it('should create a decision option', () => {
      const option = createDecisionOption(
        'Option A',
        'Description A',
        0.3,
        0.8,
        'Good outcome'
      );

      expect(option).toBeDefined();
      expect(option.id).toBeDefined();
      expect(option.label).toBe('Option A');
      expect(option.description).toBe('Description A');
      expect(option.risk).toBe(0.3);
      expect(option.confidence).toBe(0.8);
      expect(option.predictedOutcome).toBe('Good outcome');
    });
  });

  describe('DecisionAnalyzer', () => {
    let analyzer: DecisionAnalyzer;

    beforeEach(() => {
      analyzer = new DecisionAnalyzer();
    });

    it('should calculate decision score', () => {
      const options = [
        createDecisionOption('A', 'Low risk', 0.2, 0.9, 'Good'),
        createDecisionOption('B', 'High risk', 0.8, 0.5, 'Bad')
      ];

      const decision = createDecision(
        'tool_selection', 'Context', options, options[0].id, 'Good reasoning', 0.9, 'R001'
      );

      const score = analyzer.calculateScore(decision);
      
      expect(score.decisionId).toBe(decision.id);
      expect(score.score).toBeGreaterThan(0);
      expect(score.score).toBeLessThanOrEqual(1);
      expect(score.riskScore).toBe(0.2);
      expect(score.confidenceScore).toBe(0.9);
    });

    it('should compare two decisions', () => {
      const options1 = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      const options2 = [createDecisionOption('B', 'Bad', 0.8, 0.5, 'Bad')];

      const decision1 = createDecision(
        'tool_selection', 'Context', options1, options1[0].id, 'Good', 0.9, 'R001'
      );
      const decision2 = createDecision(
        'tool_selection', 'Context', options2, options2[0].id, 'Bad', 0.5, 'R001'
      );

      const comparison = analyzer.compareDecisions(decision1, decision2);
      
      expect(comparison.winner).toBe(decision1.id);
      expect(comparison.score1).toBeGreaterThan(comparison.score2);
    });

    it('should validate decision', () => {
      const options = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      const decision = createDecision(
        'tool_selection', 'Context', options, options[0].id, 'Reasoning', 0.9, 'R001'
      );

      const validation = analyzer.validate(decision);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid decision', () => {
      const options = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      const decision = createDecision(
        'tool_selection', 'Context', options, 'nonexistent', 'Reasoning', 0.9, 'R001'
      );

      const validation = analyzer.validate(decision);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should validate confidence range', () => {
      const options = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      const decision = createDecision(
        'tool_selection', 'Context', options, options[0].id, 'Reasoning', 1.5, 'R001'
      );

      const validation = analyzer.validate(decision);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Confidence must be between 0 and 1');
    });
  });

  describe('InMemoryDecisionStore', () => {
    let store: InMemoryDecisionStore;

    beforeEach(() => {
      store = new InMemoryDecisionStore();
    });

    it('should save and retrieve decision', async () => {
      const options = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      const decision = createDecision(
        'tool_selection', 'Context', options, options[0].id, 'Reasoning', 0.9, 'R001'
      );

      await store.save(decision);
      const retrieved = await store.get(decision.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(decision.id);
    });

    it('should return null for non-existent decision', async () => {
      const retrieved = await store.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should list decisions with filter', async () => {
      const options = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      
      await store.save(createDecision('tool_selection', 'C1', options, options[0].id, 'R1', 0.9, 'R001'));
      await store.save(createDecision('plan_selection', 'C2', options, options[0].id, 'R2', 0.8, 'R001'));
      await store.save(createDecision('tool_selection', 'C3', options, options[0].id, 'R3', 0.7, 'R002'));

      const toolDecisions = await store.list({ type: 'tool_selection' });
      expect(toolDecisions).toHaveLength(2);

      const r001Decisions = await store.list({ stateRevision: 'R001' });
      expect(r001Decisions).toHaveLength(2);
    });

    it('should get decisions by type', async () => {
      const options = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      
      await store.save(createDecision('tool_selection', 'C1', options, options[0].id, 'R1', 0.9, 'R001'));
      await store.save(createDecision('plan_selection', 'C2', options, options[0].id, 'R2', 0.8, 'R001'));

      const toolDecisions = await store.getByType('tool_selection');
      expect(toolDecisions).toHaveLength(1);
    });

    it('should get latest decision', async () => {
      const options = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      
      await store.save(createDecision('tool_selection', 'C1', options, options[0].id, 'R1', 0.9, 'R001'));
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await store.save(createDecision('plan_selection', 'C2', options, options[0].id, 'R2', 0.8, 'R001'));

      const latest = await store.getLatest();
      expect(latest).toBeDefined();
      expect(latest!.type).toBe('plan_selection');
    });

    it('should count decisions', async () => {
      const options = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      
      await store.save(createDecision('tool_selection', 'C1', options, options[0].id, 'R1', 0.9, 'R001'));
      await store.save(createDecision('plan_selection', 'C2', options, options[0].id, 'R2', 0.8, 'R001'));

      expect(await store.count()).toBe(2);
      expect(await store.count({ type: 'tool_selection' })).toBe(1);
    });

    it('should clear decisions', async () => {
      const options = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      await store.save(createDecision('tool_selection', 'C1', options, options[0].id, 'R1', 0.9, 'R001'));

      store.clear();
      expect(await store.count()).toBe(0);
    });
  });

  describe('validateDecision', () => {
    it('should validate correct decision', () => {
      const options = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      const decision = createDecision(
        'tool_selection', 'Context', options, options[0].id, 'Reasoning', 0.9, 'R001'
      );

      expect(validateDecision(decision)).toBe(true);
    });

    it('should reject invalid decision', () => {
      expect(validateDecision(null)).toBe(false);
      expect(validateDecision({})).toBe(false);
      expect(validateDecision({ id: '123' })).toBe(false);
    });
  });

  describe('serialize/deserialize', () => {
    it('should roundtrip decision', () => {
      const options = [createDecisionOption('A', 'Good', 0.2, 0.9, 'Good')];
      const decision = createDecision(
        'tool_selection', 'Context', options, options[0].id, 'Reasoning', 0.9, 'R001'
      );

      const json = serializeDecision(decision);
      const deserialized = deserializeDecision(json);

      expect(deserialized.id).toBe(decision.id);
      expect(deserialized.timestamp.getTime()).toBe(decision.timestamp.getTime());
    });
  });
});
