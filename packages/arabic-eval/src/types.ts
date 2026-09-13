export interface ArabicTestCase {
  id: string;
  input: string;
  expectedLanguage: string;
  passed: boolean;
}

export interface MultilingualResult {
  consistent: boolean;
  arabicResult: string;
  englishResult: string;
  task: string;
  similarity: number;
}

export interface LocalizationResult {
  text: string;
  isRTL: boolean;
  hasArabic: boolean;
  hasDiacritics: boolean;
}
