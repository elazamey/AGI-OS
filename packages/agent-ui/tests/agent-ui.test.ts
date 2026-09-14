import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '@agi-os/skill-registry';
import { CapabilityFetcher, CapabilityManager } from '@agi-os/capability-marketplace';
import { AgentUI } from '../src/index.js';

describe('AgentUI', () => {
  let registry: SkillRegistry;
  let capabilityManager: CapabilityManager;
  let ui: AgentUI;

  beforeEach(() => {
    registry = new SkillRegistry();
    const fetcher = new CapabilityFetcher({
      owner: 'elazamey',
      repo: 'skills-registry',
    });
    capabilityManager = new CapabilityManager({ registry, fetcher });
    ui = new AgentUI(registry, capabilityManager);
  });

  it('should create UI', () => {
    expect(ui).toBeDefined();
  });

  it('should process user input', async () => {
    const response = await ui.processInput('Hello');
    expect(response.role).toBe('assistant');
    expect(response.content).toBeDefined();
    expect(ui.getMessages().length).toBe(2);
  });

  it('should clear history', async () => {
    await ui.processInput('Hello');
    ui.clearHistory();
    expect(ui.getMessages().length).toBe(0);
  });

  it('should get state', async () => {
    const state = ui.getState();
    expect(state.messages).toBeDefined();
    expect(state.loadedSkills).toBeDefined();
    expect(state.isProcessing).toBeDefined();
  });

  it('should get config', () => {
    const config = ui.getConfig();
    expect(config.title).toBe('AGI-OS Agent');
    expect(config.theme).toBe('dark');
  });

  it('should handle multiple messages', async () => {
    await ui.processInput('First message');
    await ui.processInput('Second message');
    await ui.processInput('Third message');
    expect(ui.getMessages().length).toBe(6);
  });
});
