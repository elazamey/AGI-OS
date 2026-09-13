import { describe, it, expect, beforeEach } from 'vitest';
import { Cli } from '../src/index.js';

describe('Cli', () => {
  let cli: Cli;

  beforeEach(() => {
    cli = new Cli({
      dataDir: '.agi-os-test',
      llmConfig: {
        maxSpend: 0,
        defaultProvider: 'ollama',
      },
    });
  });

  it('should create with default config', () => {
    const defaultCli = new Cli();
    expect(defaultCli).toBeDefined();
  });

  it('should create with custom config', () => {
    expect(cli).toBeDefined();
    expect(cli.getLlmGateway()).toBeDefined();
    expect(cli.getMissionRuntime()).toBeDefined();
  });

  it('should show help for unknown command', async () => {
    const result = await cli.execute(['unknown']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command');
  });

  it('should show help when no arguments', async () => {
    const result = await cli.execute([]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command');
  });
});

describe('Cli commands', () => {
  let cli: Cli;

  beforeEach(() => {
    cli = new Cli({
      dataDir: '.agi-os-test',
    });
  });

  it('should execute init command', async () => {
    const result = await cli.execute(['init']);
    expect(result.success).toBe(true);
    expect(result.command).toBe('init');
    expect(result.data).toBeDefined();
  });

  it('should execute status command', async () => {
    const result = await cli.execute(['status']);
    expect(result.success).toBe(true);
    expect(result.command).toBe('status');
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.costGuard).toBeDefined();
    expect(data.costGuard.enforced).toBe(true);
    expect(data.llm).toBeDefined();
  });

  it('should execute mission command', async () => {
    const result = await cli.execute(['mission', 'Test mission prompt']);
    expect(result.success).toBe(true);
    expect(result.command).toBe('mission');
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.missionId).toBeDefined();
    expect(data.prompt).toBe('Test mission prompt');
  });

  it('should fail mission command without prompt', async () => {
    const result = await cli.execute(['mission']);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Please provide a mission prompt');
  });

  it('should execute help command', async () => {
    const result = await cli.execute(['help']);
    expect(result.success).toBe(true);
    expect(result.command).toBe('help');
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.commands).toBeDefined();
    expect(data.commands.length).toBeGreaterThan(0);
  });
});
