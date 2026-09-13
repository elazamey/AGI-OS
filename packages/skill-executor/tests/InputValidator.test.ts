import { describe, it, expect } from 'vitest';
import { InputValidator } from '../src/InputValidator.js';

describe('InputValidator', () => {
  const validator = new InputValidator();

  it('should pass valid input', async () => {
    await expect(validator.validate({ path: '/test' })).resolves.toBeUndefined();
  });

  it('should throw on null input', async () => {
    await expect(validator.validate(null as any)).rejects.toThrow('Input must be a valid object');
  });

  it('should throw on missing required field', async () => {
    await expect(
      validator.validate({}, { required: ['path'] })
    ).rejects.toThrow('Missing required input field: path');
  });

  it('should pass when required fields present', async () => {
    await expect(
      validator.validate({ path: '/test' }, { required: ['path'] })
    ).resolves.toBeUndefined();
  });
});
