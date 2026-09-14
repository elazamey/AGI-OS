import { describe, it, expect, beforeEach } from 'vitest';
import { AgentCLI } from '../src/index.js';

describe('AgentCLI', () => {
  let cli: AgentCLI;

  beforeEach(() => {
    cli = new AgentCLI({
      registryOwner: 'elazamey',
      registryRepo: 'skills-registry',
    });
  });

  it('should create CLI', () => {
    expect(cli).toBeDefined();
  });

  it('should get UI', () => {
    const ui = cli.getUI();
    expect(ui).toBeDefined();
  });

  it('should get registry', () => {
    const registry = cli.getRegistry();
    expect(registry).toBeDefined();
  });

  it('should get capability manager', () => {
    const manager = cli.getCapabilityManager();
    expect(manager).toBeDefined();
  });

  it('should process input via UI', async () => {
    const ui = cli.getUI();
    const response = await ui.processInput('Hello');
    expect(response.role).toBe('assistant');
  });
});
