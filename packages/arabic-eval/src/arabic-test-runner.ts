import { generateId } from '@agi-os/kernel';
import type { ArabicTestCase } from './types.js';

export class ArabicTestRunner {
  runTestCase(testCase: { input: string; expectedLanguage: string }): ArabicTestCase {
    const detected = this.detectLanguage(testCase.input);
    return {
      id: generateId(),
      input: testCase.input,
      expectedLanguage: testCase.expectedLanguage,
      passed: detected === testCase.expectedLanguage,
    };
  }

  detectLanguage(text: string): 'arabic' | 'english' | 'mixed' | 'other' {
    if (!text) return 'other';

    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
    const englishRegex = /[a-zA-Z]/g;

    const arabicMatches = text.match(arabicRegex) || [];
    const englishMatches = text.match(englishRegex) || [];

    const hasArabic = arabicMatches.length > 0;
    const hasEnglish = englishMatches.length > 0;

    if (hasArabic && hasEnglish) return 'mixed';
    if (hasArabic) return 'arabic';
    if (hasEnglish) return 'english';
    return 'other';
  }

  isRTL(text: string): boolean {
    const rtlChars = text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
    if (!rtlChars) return false;

    const ltrChars = text.match(/[a-zA-Z0-9]/g);
    const rtlCount = rtlChars.length;
    const ltrCount = ltrChars ? ltrChars.length : 0;

    return rtlCount > ltrCount;
  }
}
