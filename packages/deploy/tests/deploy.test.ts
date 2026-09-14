import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const DEPLOY_DIR = join(__dirname, '..');

describe('@agi-os/deploy — Package Structure', () => {
  it('should have package.json', () => {
    expect(existsSync(join(DEPLOY_DIR, 'package.json'))).toBe(true);
  });

  it('should have docker-compose.yml', () => {
    expect(existsSync(join(DEPLOY_DIR, 'docker-compose.yml'))).toBe(true);
  });

  it('should have terraform config', () => {
    expect(existsSync(join(DEPLOY_DIR, 'terraform', 'main.tf'))).toBe(true);
    expect(existsSync(join(DEPLOY_DIR, 'terraform', 'variables.tf'))).toBe(true);
    expect(existsSync(join(DEPLOY_DIR, 'terraform', 'outputs.tf'))).toBe(true);
  });

  it('should have helm chart', () => {
    expect(existsSync(join(DEPLOY_DIR, 'helm', 'Chart.yaml'))).toBe(true);
    expect(existsSync(join(DEPLOY_DIR, 'helm', 'values.yaml'))).toBe(true);
    expect(existsSync(join(DEPLOY_DIR, 'helm', 'templates', 'deployment.yaml'))).toBe(true);
    expect(existsSync(join(DEPLOY_DIR, 'helm', 'templates', 'service.yaml'))).toBe(true);
    expect(existsSync(join(DEPLOY_DIR, 'helm', 'templates', 'ingress.yaml'))).toBe(true);
  });

  it('should have CLI entry point', () => {
    expect(existsSync(join(DEPLOY_DIR, 'src', 'cli.ts'))).toBe(true);
  });
});

describe('@agi-os/deploy — Docker Compose', () => {
  const compose = readFileSync(join(DEPLOY_DIR, 'docker-compose.yml'), 'utf-8');

  it('should define api-gateway service', () => {
    expect(compose).toContain('api-gateway:');
  });

  it('should expose port 7860', () => {
    expect(compose).toContain('7860:7860');
  });

  it('should include healthcheck', () => {
    expect(compose).toContain('healthcheck:');
  });

  it('should include redis service', () => {
    expect(compose).toContain('redis:');
  });

  it('should include nginx reverse proxy', () => {
    expect(compose).toContain('nginx:');
  });

  it('should define network', () => {
    expect(compose).toContain('agios-network');
  });
});

describe('@agi-os/deploy — Terraform', () => {
  const mainTf = readFileSync(join(DEPLOY_DIR, 'terraform', 'main.tf'), 'utf-8');

  it('should define AWS provider', () => {
    expect(mainTf).toContain('provider "aws"');
  });

  it('should define VPC', () => {
    expect(mainTf).toContain('resource "aws_vpc"');
  });

  it('should define ECS cluster', () => {
    expect(mainTf).toContain('resource "aws_ecs_cluster"');
  });

  it('should define Fargate task', () => {
    expect(mainTf).toContain('requires_compatibilities = ["FARGATE"]');
  });

  it('should define ALB', () => {
    expect(mainTf).toContain('resource "aws_lb"');
  });

  it('should expose port 7860', () => {
    expect(mainTf).toContain('containerPort = 7860');
  });
});

describe('@agi-os/deploy — Helm Chart', () => {
  const chart = readFileSync(join(DEPLOY_DIR, 'helm', 'Chart.yaml'), 'utf-8');
  const values = readFileSync(join(DEPLOY_DIR, 'helm', 'values.yaml'), 'utf-8');

  it('should have chart name agios', () => {
    expect(chart).toContain('name: agios');
  });

  it('should have appVersion', () => {
    expect(chart).toContain('appVersion:');
  });

  it('should define replica count', () => {
    expect(values).toContain('replicaCount:');
  });

  it('should define resource limits', () => {
    expect(values).toContain('resources:');
  });

  it('should enable autoscaling', () => {
    expect(values).toContain('autoscaling:');
  });
});
