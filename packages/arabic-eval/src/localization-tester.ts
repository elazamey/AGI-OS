import type { LocalizationResult } from './types.js';

export class LocalizationTester {
  testRTLLayout(text: string): LocalizationResult {
    const rtlChars = text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
    const diacritics = text.match(/[\u0610-\u061A\u064B-\u065F\u0670]/g);

    return {
      text,
      isRTL: rtlChars !== null && rtlChars.length > 0,
      hasArabic: rtlChars !== null && rtlChars.length > 0,
      hasDiacritics: diacritics !== null && diacritics.length > 0,
    };
  }

  testArabicFilenames(filenames: string[]): { allValid: boolean; invalidFiles: string[] } {
    const invalidFiles: string[] = [];

    for (const filename of filenames) {
      if (!this.isValidArabicFilename(filename)) {
        invalidFiles.push(filename);
      }
    }

    return {
      allValid: invalidFiles.length === 0,
      invalidFiles,
    };
  }

  private isValidArabicFilename(filename: string): boolean {
    if (!filename || filename.length === 0) return false;

    if (filename.includes('/') || filename.includes('\\')) return false;
    if (filename === '.' || filename === '..') return false;

    const invalidChars = /[<>:"|?*\x00-\x1F]/;
    if (invalidChars.test(filename)) return false;

    return true;
  }
}
