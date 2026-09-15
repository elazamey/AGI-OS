#!/usr/bin/env node
/**
 * Test launcher for the control plane.
 *
 * The package deliberately runs its suite on Node's built-in test runner with type
 * stripping instead of vitest: the gate has to be executable in a bare CI
 * container (and on a laptop with no install) because a verification layer you can
 * only run after `pnpm install` is a verification layer people skip.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 6)) {
  console.error(
    `provider-orchestrator tests need Node >= 22.6 for --experimental-strip-types (running ${process.version}).\n` +
      'Either upgrade Node or run them through vitest from a workspace install.',
  );
  process.exit(1);
}

const dir = new URL('../tests', import.meta.url).pathname;
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort()
  .map((f) => join(dir, f));

const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
