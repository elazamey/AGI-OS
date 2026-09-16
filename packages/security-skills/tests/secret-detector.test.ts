import { describe, it, expect } from 'vitest';
import { SecretDetector } from '../src/secret-detector.js';

describe('SecretDetector', () => {
  const detector = new SecretDetector();

  it('detects API key', () => {
    const result = detector.scan('api_key="sk-12345678901234567890"');
    expect(result.passed).toBe(false);
    expect(result.threats.length).toBeGreaterThan(0);
  });

  it('detects private key', () => {
    const result = detector.scan('-----BEGIN RSA PRIVATE KEY-----');
    expect(result.passed).toBe(false);
  });

  it('detects GitHub token', () => {
    const result = detector.scan('ghp_abcdefghijklmnopqrstuvwxyz123456');
    expect(result.passed).toBe(false);
  });

  it('passes clean content', () => {
    const result = detector.scan('This is clean text with no secrets.');
    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
  });

  it('scans multiple files', () => {
    const result = detector.scanMultiple([
      { path: 'a.txt', content: 'clean' },
      { path: 'b.txt', content: 'api_key="secret1234567890123456"' },
    ]);
    expect(result.threats.length).toBeGreaterThan(0);
  });

  it('generates unique ids', () => {
    const r1 = detector.scan('api_key="sk-12345678901234567890"');
    const r2 = detector.scan('api_key="sk-12345678901234567890"');
    expect(r1.id).not.toBe(r2.id);
  });
});
