import { describe, it, expect } from 'vitest';
import { ArabicTestRunner } from '../src/arabic-test-runner.js';
import { MultilingualConsistencyTester } from '../src/multilingual-consistency.js';
import { UnicodeTester } from '../src/unicode-tester.js';
import { LocalizationTester } from '../src/localization-tester.js';

describe('ArabicEval', () => {
  describe('ArabicTestRunner', () => {
    it('should detect Arabic text', () => {
      const runner = new ArabicTestRunner();
      expect(runner.detectLanguage('مرحبا بالعالم')).toBe('arabic');
    });

    it('should detect English text', () => {
      const runner = new ArabicTestRunner();
      expect(runner.detectLanguage('Hello world')).toBe('english');
    });

    it('should detect mixed text', () => {
      const runner = new ArabicTestRunner();
      expect(runner.detectLanguage('مرحبا Hello')).toBe('mixed');
    });

    it('should identify RTL text', () => {
      const runner = new ArabicTestRunner();
      expect(runner.isRTL('مرحبا بالعالم')).toBe(true);
    });

    it('should identify LTR text', () => {
      const runner = new ArabicTestRunner();
      expect(runner.isRTL('Hello world')).toBe(false);
    });

    it('should run test case and pass for correct language', () => {
      const runner = new ArabicTestRunner();
      const result = runner.runTestCase({ input: 'مرحبا', expectedLanguage: 'arabic' });
      expect(result.passed).toBe(true);
      expect(result.expectedLanguage).toBe('arabic');
    });

    it('should run test case and fail for wrong language', () => {
      const runner = new ArabicTestRunner();
      const result = runner.runTestCase({ input: 'Hello', expectedLanguage: 'arabic' });
      expect(result.passed).toBe(false);
    });
  });

  describe('MultilingualConsistencyTester', () => {
    it('should detect consistent results', () => {
      const tester = new MultilingualConsistencyTester();
      const result = tester.compareResults('result is correct', 'result is correct', 'task1');
      expect(result.consistent).toBe(true);
      expect(result.similarity).toBe(1);
    });

    it('should detect inconsistent results', () => {
      const tester = new MultilingualConsistencyTester();
      const result = tester.compareResults('abc def', 'xyz uvw', 'task1');
      expect(result.consistent).toBe(false);
      expect(result.similarity).toBe(0);
    });

    it('should check batch consistency', () => {
      const tester = new MultilingualConsistencyTester();
      expect(tester.isConsistent(['same', 'same', 'same'])).toBe(true);
    });

  });

  describe('UnicodeTester', () => {
    it('should preserve text through encode/decode', () => {
      const tester = new UnicodeTester();
      const result = tester.testEncoding('مرحبا بالعالم');
      expect(result.preserved).toBe(true);
      expect(result.length).toBe(13);
    });

    it('should handle mixed content', () => {
      const tester = new UnicodeTester();
      const result = tester.testMixedContent('عربي', 'english', '★');
      expect(result.valid).toBe(true);
      expect(result.combined).toContain('عربي');
    });

    it('should detect emoji in text', () => {
      const tester = new UnicodeTester();
      expect(tester.testEmoji('Hello 🌍')).toBe(true);
      expect(tester.testEmoji('No emoji here')).toBe(false);
    });
  });

  describe('LocalizationTester', () => {
    it('should detect RTL layout', () => {
      const tester = new LocalizationTester();
      const result = tester.testRTLLayout('مرحبا بالعالم');
      expect(result.isRTL).toBe(true);
      expect(result.hasArabic).toBe(true);
    });

    it('should validate Arabic filenames', () => {
      const tester = new LocalizationTester();
      const result = tester.testArabicFilenames(['ملف.txt', 'test.ts']);
      expect(result.allValid).toBe(true);
      expect(result.invalidFiles.length).toBe(0);
    });

  });
});
