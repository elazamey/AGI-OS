#!/usr/bin/env node
// ═══════════════════════════════════════════════════════
// AGI-OS Deploy CLI — One-command enterprise deployment
// ═══════════════════════════════════════════════════════

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const HELP = `
╔══════════════════════════════════════════════════════════╗
║  @agi-os/deploy — Enterprise Deployment CLI             ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Usage: agios-deploy <target> [options]                 ║
║                                                          ║
║  Targets:                                                ║
║    docker       Deploy via Docker Compose (local/prod)  ║
║    terraform    Deploy to AWS ECS via Terraform          ║
║    helm         Deploy to Kubernetes via Helm            ║
║    status       Show deployment status                   ║
║    down         Tear down the deployment                 ║
║                                                          ║
║  Options:                                                ║
║    --dry-run    Preview commands without executing       ║
║    --verbose    Show detailed output                     ║
║    --help       Show this help message                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`;

function log(msg: string) { console.log(`🚀 ${msg}`); }
function err(msg: string) { console.error(`❌ ${msg}`); }
function info(msg: string) { console.log(`ℹ️  ${msg}`); }

function run(cmd: string, cwd?: string) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd, env: { ...process.env } });
  } catch {
    err(`Command failed: ${cmd}`);
    process.exit(1);
  }
}

function dryRun(cmd: string, cwd?: string) {
  info(`[DRY RUN] ${cmd}`);
}

const args = process.argv.slice(2);
const target = args[0];
const dryRunMode = args.includes('--dry-run');

if (!target || target === '--help') {
  console.log(HELP);
  process.exit(0);
}

const deployDir = __dirname;

switch (target) {
  case 'docker': {
    log('Deploying AGI-OS via Docker Compose...');
    const cmd = 'docker-compose up -d --build';
    dryRunMode ? dryRun(cmd) : run(cmd, deployDir);
    log('Docker deployment complete!');
    info('Gateway: http://localhost:7860');
    info('Health:  http://localhost:7860/health');
    break;
  }

  case 'terraform': {
    log('Deploying AGI-OS to AWS ECS via Terraform...');
    const tfDir = join(deployDir, 'terraform');
    if (!existsSync(join(tfDir, 'main.tf'))) {
      err('Terraform config not found at terraform/main.tf');
      process.exit(1);
    }
    if (!dryRunMode) {
      run('terraform init', tfDir);
      run('terraform apply -auto-approve', tfDir);
    } else {
      dryRun('terraform init');
      dryRun('terraform apply -auto-approve');
    }
    log('Terraform deployment complete!');
    break;
  }

  case 'helm': {
    log('Deploying AGI-OS to Kubernetes via Helm...');
    const helmDir = join(deployDir, 'helm');
    if (!existsSync(join(helmDir, 'Chart.yaml'))) {
      err('Helm chart not found at helm/Chart.yaml');
      process.exit(1);
    }
    const cmd = 'helm upgrade --install agios ./helm --wait --timeout 5m';
    dryRunMode ? dryRun(cmd) : run(cmd, helmDir);
    log('Helm deployment complete!');
    break;
  }

  case 'status': {
    log('Checking AGI-OS deployment status...');
    try {
      const health = execSync('curl -s http://localhost:7860/health', { encoding: 'utf-8' });
      console.log(health);
    } catch {
      err('Cannot reach API Gateway at localhost:7860');
    }
    break;
  }

  case 'down': {
    log('Tearing down AGI-OS deployment...');
    if (!dryRunMode) {
      run('docker-compose down -v', deployDir);
    } else {
      dryRun('docker-compose down -v');
    }
    log('Deployment torn down.');
    break;
  }

  default:
    err(`Unknown target: ${target}`);
    console.log(HELP);
    process.exit(1);
}
