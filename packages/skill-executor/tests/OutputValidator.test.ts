import { describe, it, expect } from 'vitest';
import { OutputValidator } from '../src/OutputValidator.js';

describe('OutputValidator', () => {
  const validator = new OutputValidator();

  it('should pass valid output', async () => {
    await expect(validator.validate({ content: 'test' })).resolves.toBeUndefined();
  });

  it('should throw on undefined output', async () => {
    await expect(validator.validate(undefined)).rejects.toThrow('undefined output');
  });

  it('should pass on null output', async () => {
    await expect(validator.validate(null)).resolves.toBeUndefined();
  });
});
