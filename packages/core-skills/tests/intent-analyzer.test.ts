import { describe, it, expect } from 'vitest';
import { IntentAnalyzer } from '../src/intent-analyzer.js';

describe('IntentAnalyzer', () => {
  const analyzer = new IntentAnalyzer();

  it('analyzes simple intent', () => {
    const result = analyzer.analyze('ابحث عن أفضل خيار');
    expect(result.goals.length).toBeGreaterThan(0);
    expect(result.suggestedSkills).toContain('research');
  });

  it('extracts constraints', () => {
    const result = analyzer.analyze('يجب أن يكون بدون أخطاء');
    expect(result.constraints.length).toBeGreaterThan(0);
  });

  it('assesses risk', () => {
    const result = analyzer.analyze('هدف واحد');
    expect(result.riskAssessment).toBeDefined();
  });

  it('suggests coding skill', () => {
    const result = analyzer.analyze('اكتب كود');
    expect(result.suggestedSkills).toContain('coding');
  });

  it('suggests browser skill', () => {
    const result = analyzer.analyze('افتح الموقع');
    expect(result.suggestedSkills).toContain('browser');
  });
});
