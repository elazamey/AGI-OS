#!/usr/bin/env node
/**
 * AGI OS — workspace hygiene checks
 * ---------------------------------------------------------------------------
 * Cheap structural invariants that CI enforces so whole classes of the bugs
 * found in the readiness review cannot come back:
 *
 *   node-types    every package importing a `node:` builtin declares @types/node
 *                 (4 packages failed `tsc` on exactly this)
 *   test-script   every package with a tests/ directory has a `test` script
 *   build-script  every package with a src/ directory has a `build` script
 *   exports       every package.json exposes `main` + `types`
 *   bin-runs      a declared `bin` target has a shebang and actually parses args
 *
 * Usage: node scripts/workspace-hygiene.mjs [--json]
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG_ROOT = join(ROOT, 'packages');

const failures = [];
const checks = { passed: 0 };

function fail(check, pkg, message) {
  failures.push({ check, package: pkg, message });
}

function walkTs(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      out.push(...walkTs(full));
    } else if (/\.(ts|tsx|mts|cts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

for (const name of readdirSync(PKG_ROOT)) {
  const dir = join(PKG_ROOT, name);
  const manifestPath = join(dir, 'package.json');
  if (!statSync(dir).isDirectory() || !existsSync(manifestPath)) continue;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const dev = manifest.devDependencies ?? {};
  const deps = manifest.dependencies ?? {};
  const scripts = manifest.scripts ?? {};

  // ---- node-types ---------------------------------------------------------
  const srcFiles = walkTs(join(dir, 'src'));
  const usesNodeBuiltins = srcFiles.some((f) => /from\s+['"]node:/.test(readFileSync(f, 'utf8')));
  if (usesNodeBuiltins && !dev['@types/node'] && !deps['@types/node']) {
    fail('node-types', name, 'imports `node:` builtins but does not declare @types/node (tsc will fail)');
  } else checks.passed++;

  // ---- test-script --------------------------------------------------------
  if (existsSync(join(dir, 'tests')) && !scripts.test) {
    fail('test-script', name, 'has a tests/ directory but no `test` script');
  } else checks.passed++;

  // ---- build-script -------------------------------------------------------
  if (existsSync(join(dir, 'src')) && !scripts.build) {
    fail('build-script', name, 'has a src/ directory but no `build` script');
  } else checks.passed++;

  // ---- exports ------------------------------------------------------------
  if (!manifest.private && (!manifest.main || !manifest.types)) {
    fail('exports', name, `publishable package is missing main/types (main=${manifest.main}, types=${manifest.types})`);
  } else checks.passed++;

  // ---- bin-runs -----------------------------------------------------------
  // `dist/` is generated, so a bin entry can "exist" while its source is just a
  // barrel of exports that never reads argv. Check the SOURCE, always.
  for (const [binName, rel] of Object.entries(manifest.bin ?? {})) {
    const srcCandidates = [
      join(dir, rel.replace(/(^|\/)dist\//, '$1src/').replace(/\.js$/, '.ts')),
      join(dir, 'src', 'cli.ts'),
      join(dir, 'src', 'main.ts'),
      join(dir, 'src', 'bin.ts'),
    ];
    const entry = srcCandidates.find((p) => existsSync(p));
    if (!entry) {
      fail('bin-runs', name, `bin "${binName}" -> ${rel} has no source entrypoint (looked for ${srcCandidates[0].replace(dir + '/', '')})`);
      continue;
    }
    const src = readFileSync(entry, 'utf8');
    if (!/process\.argv/.test(src)) {
      fail('bin-runs', name, `bin "${binName}" (${entry.replace(dir + '/', '')}) never reads process.argv — the command is inert`);
      continue;
    }
    if (!/^#!/.test(src)) {
      fail('bin-runs', name, `bin "${binName}" (${entry.replace(dir + '/', '')}) has no shebang — it is not executable on PATH`);
      continue;
    }
    checks.passed++;
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ checks: checks.passed, failures }, null, 2));
} else {
  console.log(`[hygiene] ${checks.passed} checks passed, ${failures.length} failed`);
  for (const f of failures) console.log(`  ✗ ${f.check}  ${f.package}: ${f.message}`);
}

if (failures.length > 0) {
  console.error(`[hygiene] FAILED — ${failures.length} structural problem(s)`);
  process.exit(1);
}
console.log('[hygiene] PASSED');
