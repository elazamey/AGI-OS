import { describe, it, expect } from 'vitest';
import { BuildVerifier } from '../src/build-verifier.js';

describe('BuildVerifier', () => {
  const verifier = new BuildVerifier();

  it('verifies successful build', () => {
    const result = verifier.verify('npm run build', 'Build complete', 0);
    expect(result.success).toBe(true);
  });

  it('detects build errors', () => {
    const result = verifier.verify('npm run build', 'Error: syntax error', 1);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBe(1);
  });

  it('detects warnings', () => {
    const result = verifier.verify('npm run build', 'Warning: deprecated', 0);
    expect(result.warnings.length).toBe(1);
  });
});
