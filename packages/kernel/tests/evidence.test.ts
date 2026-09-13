import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCommandEvidence,
  createToolEvidence,
  createObservationEvidence,
  EvidenceVerifier,
  InMemoryEvidenceStore,
  serializeEvidence,
  deserializeEvidence,
  validateEvidence
} from '../src/evidence.js';

describe('Evidence', () => {
  describe('createCommandEvidence', () => {
    it('should create command evidence', () => {
      const evidence = createCommandEvidence(
        'test.run',
        'pnpm',
        ['test'],
        0,
        'All tests passed',
        '',
        'R001',
        1500
      );

      expect(evidence).toBeDefined();
      expect(evidence.id).toBeDefined();
      expect(evidence.operation).toBe('test.run');
      expect(evidence.command).toBe('pnpm');
      expect(evidence.args).toEqual(['test']);
      expect(evidence.exitCode).toBe(0);
      expect(evidence.stdout).toBe('All tests passed');
      expect(evidence.stdoutHash).toBeDefined();
      expect(evidence.stateRevision).toBe('R001');
      expect(evidence.duration).toBe(1500);
    });

    it('should create evidence with stderr', () => {
      const evidence = createCommandEvidence(
        'test.run',
        'pnpm',
        ['test'],
        1,
        '',
        'Error: test failed',
        'R001',
        100
      );

      expect(evidence.exitCode).toBe(1);
      expect(evidence.stderr).toBe('Error: test failed');
      expect(evidence.stderrHash).toBeDefined();
    });
  });

  describe('createToolEvidence', () => {
    it('should create tool evidence for success', () => {
      const evidence = createToolEvidence(
        'filesystem.read',
        { path: '/test.txt' },
        'file content',
        true,
        'R001',
        50
      );

      expect(evidence.operation).toBe('tool.filesystem.read');
      expect(evidence.exitCode).toBe(0);
      expect(evidence.metadata).toEqual({
        toolId: 'filesystem.read',
        input: { path: '/test.txt' },
        success: true
      });
    });

    it('should create tool evidence for failure', () => {
      const evidence = createToolEvidence(
        'filesystem.read',
        { path: '/nonexistent.txt' },
        null,
        false,
        'R001',
        50,
        'File not found'
      );

      expect(evidence.exitCode).toBe(1);
      expect(evidence.stderr).toBe('File not found');
    });
  });

  describe('createObservationEvidence', () => {
    it('should create observation evidence', () => {
      const evidence = createObservationEvidence(
        'browser.screenshot',
        { url: 'https://example.com', format: 'png' },
        'R001'
      );

      expect(evidence.operation).toBe('observation.browser.screenshot');
      expect(evidence.metadata).toEqual({
        observationType: 'browser.screenshot',
        data: { url: 'https://example.com', format: 'png' }
      });
    });
  });

  describe('EvidenceVerifier', () => {
    let verifier: EvidenceVerifier;

    beforeEach(() => {
      verifier = new EvidenceVerifier();
    });

    it('should verify valid evidence', () => {
      const evidence = createCommandEvidence(
        'test.run',
        'pnpm',
        ['test'],
        0,
        'All tests passed',
        '',
        'R001',
        100
      );

      expect(verifier.verify(evidence)).toBe(true);
    });

    it('should verify stdout hash', () => {
      const evidence = createCommandEvidence(
        'test.run',
        'pnpm',
        ['test'],
        0,
        'All tests passed',
        '',
        'R001',
        100
      );

      // Tamper with stdout
      evidence.stdout = 'Tampered output';

      expect(verifier.verify(evidence)).toBe(false);
    });

    it('should verify command success', () => {
      const successEvidence = createCommandEvidence(
        'test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100
      );
      const failedEvidence = createCommandEvidence(
        'test.run', 'pnpm', ['test'], 1, '', 'Error', 'R001', 100
      );

      expect(verifier.verifyCommandSuccess(successEvidence)).toBe(true);
      expect(verifier.verifyCommandSuccess(failedEvidence)).toBe(false);
    });

    it('should verify tool execution', () => {
      const evidence = createToolEvidence(
        'filesystem.read',
        { path: '/test.txt' },
        'content',
        true,
        'R001',
        50
      );

      expect(verifier.verifyToolExecution(evidence, 'filesystem.read')).toBe(true);
      expect(verifier.verifyToolExecution(evidence, 'filesystem.write')).toBe(false);
    });

    it('should verify state revision', () => {
      const evidence = createCommandEvidence(
        'test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100
      );

      expect(verifier.verifyStateRevision(evidence, 'R001')).toBe(true);
      expect(verifier.verifyStateRevision(evidence, 'R002')).toBe(false);
    });

    it('should verify timestamp range', () => {
      const evidence = createCommandEvidence(
        'test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100
      );

      const past = new Date(Date.now() - 10000);
      const future = new Date(Date.now() + 10000);

      expect(verifier.verifyTimestampRange(evidence, past, future)).toBe(true);
      expect(verifier.verifyTimestampRange(evidence, future, future)).toBe(false);
    });

    it('should create verification report', () => {
      const evidence = createCommandEvidence(
        'test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100
      );

      const report = verifier.createReport(evidence);
      
      expect(report.evidenceId).toBe(evidence.id);
      expect(report.passed).toBe(true);
      expect(report.checks.length).toBeGreaterThan(0);
    });

    it('should create failing report for tampered evidence', () => {
      const evidence = createCommandEvidence(
        'test.run', 'pnpm', ['test'], 0, 'Original output', '', 'R001', 100
      );
      evidence.stdout = 'Tampered output';

      const report = verifier.createReport(evidence);
      
      expect(report.passed).toBe(false);
      const hashCheck = report.checks.find((c) => c.name === 'stdout_hash');
      expect(hashCheck?.passed).toBe(false);
    });
  });

  describe('InMemoryEvidenceStore', () => {
    let store: InMemoryEvidenceStore;

    beforeEach(() => {
      store = new InMemoryEvidenceStore();
    });

    it('should save and retrieve evidence', async () => {
      const evidence = createCommandEvidence(
        'test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100
      );
      await store.save(evidence);

      const retrieved = await store.get(evidence.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(evidence.id);
    });

    it('should return null for non-existent evidence', async () => {
      const retrieved = await store.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should list evidence with filter', async () => {
      await store.save(createCommandEvidence('test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100));
      await store.save(createToolEvidence('filesystem.read', {}, 'content', true, 'R001', 50));
      await store.save(createCommandEvidence('test.run', 'pnpm', ['test'], 1, '', 'Error', 'R001', 100));

      const testEvidence = await store.list({ operation: 'test.run' });
      expect(testEvidence).toHaveLength(2);

      const successful = await store.list({ success: true });
      expect(successful).toHaveLength(2);
    });

    it('should get evidence by operation', async () => {
      await store.save(createCommandEvidence('test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100));
      await store.save(createToolEvidence('filesystem.read', {}, 'content', true, 'R001', 50));

      const testEvidence = await store.getByOperation('test.run');
      expect(testEvidence).toHaveLength(1);
    });

    it('should get evidence by state revision', async () => {
      await store.save(createCommandEvidence('test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100));
      await store.save(createCommandEvidence('test.run', 'pnpm', ['test'], 0, 'OK', '', 'R002', 100));

      const r001Evidence = await store.getByStateRevision('R001');
      expect(r001Evidence).toHaveLength(1);
    });

    it('should get successful and failed evidence', async () => {
      await store.save(createCommandEvidence('test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100));
      await store.save(createCommandEvidence('test.run', 'pnpm', ['test'], 1, '', 'Error', 'R001', 100));

      const successful = await store.getSuccessful();
      expect(successful).toHaveLength(1);

      const failed = await store.getFailed();
      expect(failed).toHaveLength(1);
    });

    it('should count evidence', async () => {
      await store.save(createCommandEvidence('test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100));
      await store.save(createToolEvidence('filesystem.read', {}, 'content', true, 'R001', 50));

      expect(await store.count()).toBe(2);
      expect(await store.count({ operation: 'test.run' })).toBe(1);
    });

    it('should clear evidence', async () => {
      await store.save(createCommandEvidence('test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100));
      store.clear();

      expect(await store.count()).toBe(0);
    });
  });

  describe('validateEvidence', () => {
    it('should validate correct evidence', () => {
      const evidence = createCommandEvidence(
        'test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100
      );
      expect(validateEvidence(evidence)).toBe(true);
    });

    it('should reject invalid evidence', () => {
      expect(validateEvidence(null)).toBe(false);
      expect(validateEvidence({})).toBe(false);
      expect(validateEvidence({ id: '123' })).toBe(false);
    });
  });

  describe('serialize/deserialize', () => {
    it('should roundtrip evidence', () => {
      const evidence = createCommandEvidence(
        'test.run', 'pnpm', ['test'], 0, 'OK', '', 'R001', 100
      );
      const json = serializeEvidence(evidence);
      const deserialized = deserializeEvidence(json);

      expect(deserialized.id).toBe(evidence.id);
      expect(deserialized.timestamp.getTime()).toBe(evidence.timestamp.getTime());
    });
  });
});
