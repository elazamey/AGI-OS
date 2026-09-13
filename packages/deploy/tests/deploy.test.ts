import { describe, it, expect, beforeEach } from 'vitest';
import { DeploymentManager } from '../src/index.js';

describe('DeploymentManager', () => {
  let manager: DeploymentManager;

  beforeEach(() => {
    manager = new DeploymentManager({
      environment: 'production',
      replicas: 2,
      enableOllama: true,
    });
  });

  it('should create with config', () => {
    expect(manager).toBeDefined();
  });

  it('should deploy successfully', async () => {
    const result = await manager.deploy();
    expect(result.status).toBe('success');
    expect(result.components.length).toBeGreaterThan(0);
    expect(result.timestamp).toBeDefined();
  });

  it('should include AGI-OS API component', async () => {
    const result = await manager.deploy();
    const apiComponent = result.components.find(c => c.name === 'agi-os-api');
    expect(apiComponent).toBeDefined();
    expect(apiComponent?.status).toBe('running');
  });

  it('should include Ollama when enabled', async () => {
    const result = await manager.deploy();
    const ollamaComponent = result.components.find(c => c.name === 'ollama');
    expect(ollamaComponent).toBeDefined();
    expect(ollamaComponent?.status).toBe('running');
  });

  it('should not include PostgreSQL when disabled', async () => {
    const result = await manager.deploy();
    const postgresComponent = result.components.find(c => c.name === 'postgres');
    expect(postgresComponent).toBeUndefined();
  });

  it('should get status', async () => {
    const result = await manager.getStatus();
    expect(result.status).toBe('success');
    expect(result.components).toHaveLength(2);
  });

  it('should scale replicas', async () => {
    await manager.scale(5);
    const manifest = manager.getKubernetesManifest();
    expect(manifest).toContain('replicas: 5');
  });

  it('should generate Docker Compose config', () => {
    const config = manager.getDockerComposeConfig();
    expect(config).toContain('agi-os:latest');
    expect(config).toContain('ollama/ollama:latest');
    expect(config).toContain('3000:3000');
    expect(config).toContain('11434:11434');
  });

  it('should generate Kubernetes manifest', () => {
    const manifest = manager.getKubernetesManifest();
    expect(manifest).toContain('apiVersion: apps/v1');
    expect(manifest).toContain('kind: Deployment');
    expect(manifest).toContain('agi-os-api');
  });
});

describe('DeploymentManager with different configs', () => {
  it('should create development environment', async () => {
    const manager = new DeploymentManager({
      environment: 'development',
      replicas: 1,
      enableOllama: true,
      enablePostgres: true,
      enableRedis: true,
    });

    const result = await manager.deploy();
    expect(result.status).toBe('success');
    expect(result.components.length).toBe(4);
  });

  it('should create minimal environment', async () => {
    const manager = new DeploymentManager({
      environment: 'development',
      replicas: 1,
      enableOllama: false,
      enablePostgres: false,
      enableRedis: false,
    });

    const result = await manager.deploy();
    expect(result.status).toBe('success');
    expect(result.components.length).toBe(1);
  });
});
