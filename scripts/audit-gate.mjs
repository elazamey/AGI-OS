#!/usr/bin/env node
/**
 * AGI OS — Dependency audit gate
 * ---------------------------------------------------------------------------
 * Replaces the hardcoded 3-entry `DependencyAuditor.KNOWN_VULNERABILITIES`
 * list with a real advisory feed (npm/pnpm audit) and enforces:
 *
 *   zero `high` or `critical` advisories, unless explicitly allowlisted.
 *
 * Allowlist entries MUST carry an expiry date. An expired entry fails the
 * build, so exceptions cannot silently become permanent.
 *
 * Usage:  node scripts/audit-gate.mjs [--level high] [--json]
 * Exit:   0 = clean, 1 = blocking advisories found, 2 = gate could not run
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWLIST_PATH = join(ROOT, '.pnpm-audit-allowlist.json');

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];

function parseArgs(argv) {
  const args = { level: 'high', json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--level') args.level = argv[++i];
    else if (argv[i] === '--json') args.json = true;
  }
  return args;
}

function severityRank(sev) {
  const idx = SEVERITY_ORDER.indexOf(String(sev).toLowerCase());
  return idx === -1 ? 0 : idx;
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return { exceptions: [] };
  try {
    return JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch (err) {
    console.error(`[audit-gate] cannot parse ${ALLOWLIST_PATH}: ${err.message}`);
    process.exit(2);
  }
}

function runAudit() {
  try {
    // pnpm audit exits non-zero when it finds anything; that is expected.
    const out = execFileSync('pnpm', ['audit', '--json', '--prod=false'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(out);
  } catch (err) {
    // pnpm audit exits 1 with a JSON body on stdout when vulnerabilities exist.
    const stdout = err.stdout?.toString?.() ?? '';
    if (stdout.trim().startsWith('{')) {
      try {
        return JSON.parse(stdout);
      } catch { /* fall through */ }
    }
    console.error('[audit-gate] could not run `pnpm audit`:');
    console.error(err.stderr?.toString?.() || err.message);
    console.error('[audit-gate] network access to the advisory registry is required.');
    process.exit(2);
  }
}

/** Flatten the audit report into one row per (package, severity, title). */
function collectFindings(report) {
  const rows = [];

  // npm-style report (pnpm >= 8 emits this shape)
  if (report.advisories && typeof report.advisories === 'object') {
    for (const adv of Object.values(report.advisories)) {
      rows.push({
        id: String(adv.github_advisory_id ?? adv.id ?? 'unknown'),
        package: adv.module_name ?? 'unknown',
        severity: adv.severity ?? 'info',
        title: (adv.title ?? '').trim(),
        vulnerableVersions: adv.vulnerable_versions ?? '',
        patchedVersions: adv.patched_versions ?? '',
        url: adv.url ?? '',
      });
    }
    return rows;
  }

  // npm v7+ `vulnerabilities` map
  if (report.vulnerabilities && typeof report.vulnerabilities === 'object') {
    for (const [name, v] of Object.entries(report.vulnerabilities)) {
      for (const via of v.via ?? []) {
        if (typeof via === 'string') continue;
        rows.push({
          id: String(via.source ?? via.url ?? 'unknown'),
          package: via.name ?? name,
          severity: via.severity ?? v.severity ?? 'info',
          title: (via.title ?? '').trim(),
          vulnerableVersions: via.range ?? '',
          patchedVersions: '',
          url: via.url ?? '',
        });
      }
    }
    return rows;
  }

  return rows;
}

function isAllowlisted(finding, exceptions, today) {
  for (const ex of exceptions) {
    const pkgMatches = ex.package === finding.package || ex.package === '*';
    const idMatches = !ex.id || ex.id === finding.id;
    const sevMatches = !ex.severity || ex.severity === finding.severity;
    if (!pkgMatches || !idMatches || !sevMatches) continue;

    if (!ex.expires) {
      return { matched: ex, expired: true, reason: 'allowlist entry has no `expires` date' };
    }
    if (new Date(ex.expires) < today) {
      return { matched: ex, expired: true, reason: `allowlist entry expired on ${ex.expires}` };
    }
    return { matched: ex, expired: false, reason: ex.reason ?? '(no reason recorded)' };
  }
  return null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const minRank = severityRank(args.level);
  const allowlist = loadAllowlist();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const report = runAudit();
  const findings = collectFindings(report);

  const blocking = [];
  const allowed = [];
  const expired = [];

  for (const f of findings) {
    if (severityRank(f.severity) < minRank) continue;
    const hit = isAllowlisted(f, allowlist.exceptions ?? [], today);
    if (!hit) blocking.push(f);
    else if (hit.expired) expired.push({ ...f, reason: hit.reason });
    else allowed.push({ ...f, reason: hit.reason });
  }

  const summary = report.metadata?.vulnerabilities ?? {};

  if (args.json) {
    console.log(JSON.stringify({ summary, blocking, allowed, expired }, null, 2));
  } else {
    console.log('[audit-gate] advisory totals:', JSON.stringify(summary));
    console.log(`[audit-gate] findings at or above "${args.level}": ${blocking.length + allowed.length + expired.length}`);
    if (allowed.length) {
      console.log(`[audit-gate] allowlisted (${allowed.length}):`);
      for (const f of allowed) console.log(`  - ${f.severity.toUpperCase()} ${f.package}: ${f.title} — ${f.reason}`);
    }
    if (expired.length) {
      console.error(`[audit-gate] EXPIRED allowlist entries (${expired.length}):`);
      for (const f of expired) console.error(`  - ${f.severity.toUpperCase()} ${f.package}: ${f.title} — ${f.reason}`);
    }
    if (blocking.length) {
      console.error(`[audit-gate] BLOCKING advisories (${blocking.length}):`);
      for (const f of blocking) {
        console.error(`  - ${f.severity.toUpperCase()} ${f.package} [${f.vulnerableVersions}] ${f.title}`);
        if (f.patchedVersions) console.error(`      fix: ${f.patchedVersions}`);
        if (f.url) console.error(`      ref: ${f.url}`);
      }
    }
  }

  if (blocking.length > 0 || expired.length > 0) {
    console.error('');
    console.error(`[audit-gate] FAILED — ${blocking.length} blocking, ${expired.length} expired.`);
    console.error('[audit-gate] Fix the dependency, or add a time-boxed entry to .pnpm-audit-allowlist.json');
    console.error('[audit-gate] with `package`, `reason`, `owner` and `expires` (max 30 days).');
    process.exit(1);
  }

  console.log('[audit-gate] PASSED');
}

main();
