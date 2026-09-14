#!/usr/bin/env node

import { AgentCLI } from './AgentCLI.js';

const cli = new AgentCLI();
cli.run(process.argv.slice(2));
