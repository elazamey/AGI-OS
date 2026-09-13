export class OutputValidator {
  async validate(output: unknown, schema?: Record<string, unknown>): Promise<void> {
    if (output === undefined) {
      throw new Error('Skill execution returned undefined output');
    }
  }
}
