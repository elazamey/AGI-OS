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
 *   manifest-json every manifest in the repo is strict JSON — a trailing comma is a
 *                 syntax error in package.json, and pnpm's own parser is lenient
 *                 enough that CI could stay green while `require('./package.json')`,
 *                 `node -e`, and half the toolchain break (this actually shipped)
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

/**
 * Strict JSON, reported instead of thrown. Every tool reads these files differently:
 * pnpm tolerates a trailing comma, `JSON.parse` does not, so the failure surfaces
 * somewhere far away from the edit that caused it.
 */
function readManifest(file, label) {
  const text = readFileSync(file, 'utf8');
  try {
    return { manifest: JSON.parse(text) };
  } catch (error) {
    const line = /line (\d+)/.exec(error.message)?.[1] ?? '?';
    return { error: `not strict JSON at line ${line}: ${error.message}` };
  }
}

// ---- manifest-json --------------------------------------------------------
const manifestsToCheck = [join(ROOT, 'package.json'), join(ROOT, 'tsconfig.json'), join(ROOT, 'tests', 'production', 'package.json')];
for (const app of existsSync(join(ROOT, 'apps')) ? readdirSync(join(ROOT, 'apps')) : []) {
  for (const file of ['package.json', 'tsconfig.json']) {
    const full = join(ROOT, 'apps', app, file);
    if (existsSync(full)) manifestsToCheck.push(full);
  }
}
for (const name of readdirSync(PKG_ROOT)) {
  for (const file of ['package.json', 'tsconfig.json']) {
    const full = join(PKG_ROOT, name, file);
    if (statSync(join(PKG_ROOT, name)).isDirectory() && existsSync(full)) manifestsToCheck.push(full);
  }
}
for (const file of manifestsToCheck) {
  const relative = file.slice(ROOT.length + 1);
  const { error } = readManifest(file, relative);
  if (error) fail('manifest-json', relative, error);
  else checks.passed++;
}

for (const name of readdirSync(PKG_ROOT)) {
  const dir = join(PKG_ROOT, name);
  const manifestPath = join(dir, 'package.json');
  if (!statSync(dir).isDirectory() || !existsSync(manifestPath)) continue;

  const { manifest, error: parseError } = readManifest(manifestPath, name);
  if (parseError) continue; // already reported by the manifest-json check
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

// ---- docker-context -------------------------------------------------------
// `docker build` failed in CI for two reasons that static checking catches: a
// COPY source excluded by .dockerignore, and packages whose tsconfig extends a
// root config that was never copied into the image.
{
  const dockerfile = join(ROOT, 'Dockerfile');
  if (!existsSync(dockerfile)) {
    fail('docker-context', '(root)', 'no Dockerfile at the repository root');
  } else {
    const ignoreFile = join(ROOT, '.dockerignore');
    const ignores = existsSync(ignoreFile)
      ? readFileSync(ignoreFile, 'utf8')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'))
      : [];

    const isIgnored = (p) =>
      ignores.some((pattern) => {
        const bare = pattern.replace(/\/$/, '');
        if (pattern.endsWith('*')) return p.startsWith(pattern.slice(0, -1));
        if (pattern.startsWith('*')) return p.endsWith(pattern.slice(1));
        return p === bare || p.startsWith(bare + '/');
      });

    const builderCopies = [];
    for (const line of readFileSync(dockerfile, 'utf8').split('\n')) {
      const m = line.match(/^COPY\s+(.+?)\s+(\S+)\s*$/);
      if (!m) continue;
      if (m[1].startsWith('--from=')) continue; // resolved inside the image
      for (const src of m[1].split(/\s+/)) {
        builderCopies.push(src);
        if (!existsSync(join(ROOT, src))) {
          fail('docker-context', 'Dockerfile', `COPY source "${src}" does not exist in the build context`);
        } else if (isIgnored(src)) {
          fail('docker-context', 'Dockerfile', `COPY source "${src}" is excluded by .dockerignore — the build will fail`);
        } else checks.passed++;
      }
    }

    // A package tsconfig that extends a path outside the package must have that
    // file copied into the image, or `pnpm build` fails inside Docker while
    // passing locally.
    const copiedSet = new Set(builderCopies.map((c) => c.replace(/\/$/, '')));
    const coversRoot = copiedSet.has('tsconfig.json');
    for (const name of readdirSync(PKG_ROOT)) {
      const tsconfig = join(PKG_ROOT, name, 'tsconfig.json');
      if (!existsSync(tsconfig)) continue;
      const raw = readFileSync(tsconfig, 'utf8');
      const m = raw.match(/"extends"\s*:\s*"(\.\.\/[^"]+)"/);
      if (!m) continue;
      const target = m[1].replace(/^\.\.\/\.\.\//, '');
      if (!existsSync(join(ROOT, target))) {
        fail('docker-context', name, `tsconfig extends "${m[1]}" but ${target} does not exist at the root`);
      } else if (!coversRoot) {
        fail('docker-context', name, `tsconfig extends "${m[1]}" but the Dockerfile never copies ${target} into the build stage`);
      } else checks.passed++;
    }
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
