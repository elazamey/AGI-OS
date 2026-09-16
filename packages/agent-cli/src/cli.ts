#!/usr/bin/env node
import { AgentCLI } from './AgentCLI.js';

const config = {
  registryOwner: process.env.AGI_REGISTRY_OWNER,
  registryRepo: process.env.AGI_REGISTRY_REPO,
  theme: (process.env.AGI_THEME as 'light' | 'dark') ?? 'dark',
  verbose: process.argv.includes('--verbose'),
};

const cli = new AgentCLI(config);
cli.start().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
