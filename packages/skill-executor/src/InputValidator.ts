export class InputValidator {
  async validate(input: Record<string, unknown>, schema?: Record<string, unknown>): Promise<void> {
    if (!input || typeof input !== 'object') {
      throw new Error('Input must be a valid object');
    }

    if (schema && schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field as string in input)) {
          throw new Error(`Missing required input field: ${field}`);
        }
      }
    }
  }
}
