'use strict';
// ----------------------------------------------------------------------------
// 02 · LINK INTEGRITY — critical
// Catches the two failure modes that make a "green" deployment useless:
//   (a) documentation pointing at files/hosts that do not exist, and
//   (b) the shipped UI calling endpoints the backend never routes, or calling
//       a backend origin nobody owns (owner drift: two different hf.space
//       hosts referenced from one app).
// ----------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIR = new Set(['node_modules', '.git', 'dist', '.next', 'coverage', 'out', 'build']);

function walk(dir, depth = 0) {
  const out = [];
  if (depth > 4 || !fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    if (SKIP_DIR.has(entry)) continue;
    const full = path.join(dir, entry);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walk(full, depth + 1));
    else if (/\.(ts|tsx|js|jsx|md|json)$/.test(entry)) out.push(full);
  }
  return out;
}

function read(root, rel) {
  const full = path.join(root, rel);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

/**
 * A 404 is only evidence of a *missing route* when the answer is the framework
 * default (FastAPI `{"detail":"Not Found"}`, an HTML 404 page, or an empty
 * body). A 404 carrying a domain error ("Mission not found") means the router
 * matched and the resource is absent — that endpoint exists.
 */
function looksUnrouted(res) {
  if (res.status !== 404) return false;
  const text = String(res.text || '').trim();
  if (!text) return true;
  if (/^<(!doctype|html)/i.test(text)) return true;
  return /^\{\s*"detail"\s*:\s*"Not Found"\s*\}$/.test(text);
}

module.exports = ({ suite, config }) => {
  const root = config.repoRoot;

  return [
    suite({
      name: 'Link Integrity',
      critical: true,
      note: 'README + UI ↔ backend contract',
      tests: [
        {
          name: 'relative links in README/docs resolve to real files',
          async fn(t) {
            const files = config.linkIntegrity.docsToCheck;
            let scanned = 0;
            for (const rel of files) {
              const text = read(root, rel);
              if (text === null) {
                t.check(`${rel} exists`, false, 'file missing from repo');
                continue;
              }
              const targets = new Set();
              for (const m of text.matchAll(/\]\((?!http|#|mailto:)([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
                targets.add(m[1].split('#')[0]);
              }
              for (const target of targets) {
                scanned += 1;
                const resolved = path.resolve(path.dirname(path.join(root, rel)), target);
                const exists = fs.existsSync(resolved) || fs.existsSync(`${resolved}.md`);
                t.check(`${rel} → ${target} resolves`, exists, path.relative(root, resolved));
              }
            }
            t.record('docLinksChecked', scanned);
            t.check('at least one doc link was verified', scanned > 0, 'no relative links found');
          },
        },
        {
          name: 'exactly one backend origin is referenced across the repo',
          async fn(t) {
            const scanDirs = [
              'apps/web-ui/src', 'apps/workspace/src', 'LAUNCH', 'docs',
              'apps/hf-backend', 'README.md', 'SHOW_HN.md', 'agi-os-bootstrap.json',
            ];
            const hosts = new Map();
            for (const rel of scanDirs) {
              const full = path.join(root, rel);
              const files = fs.existsSync(full) && fs.statSync(full).isDirectory() ? walk(full) : (fs.existsSync(full) ? [full] : []);
              for (const f of files) {
                const text = fs.readFileSync(f, 'utf8');
                for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+\.hf\.space)/gi)) {
                  const host = m[1].toLowerCase();
                  if (!hosts.has(host)) hosts.set(host, []);
                  const where = path.relative(root, f);
                  if (!hosts.get(host).includes(where)) hosts.get(host).push(where);
                }
              }
            }
            t.record('hosts', Object.fromEntries([...hosts.entries()].map(([h, f]) => [h, f.slice(0, 8)])));
            if (hosts.size === 0) {
              t.note('no hf.space origins referenced — running against a local target only');
              t.check('no origin drift detected', true);
              return;
            }
            t.require(`single canonical backend host (found ${hosts.size})`, hosts.size === 1,
              [...hosts.entries()].map(([h, f]) => `${h} ← ${f.slice(0, 6).join(', ')}`).join(' | '));
            const host = [...hosts.keys()][0];
            const allowed = config.linkIntegrity.allowedHosts.map((a) => a.toLowerCase());
            t.check(`host "${host}" is in AGIOS_ALLOWED_HOSTS`, allowed.some((a) => host === a || host.endsWith(`.${a}`)), `allowed: ${allowed.join(', ')}`);
          },
        },
        {
          name: 'endpoints called by the shipped UI are routed by the backend',
          async fn(t, client) {
            const uiDir = path.join(root, 'apps', 'web-ui', 'src');
            const files = walk(uiDir);
            const paths = new Set();
            for (const f of files) {
              const text = fs.readFileSync(f, 'utf8');
              // Also matches the `backendUrl('/health')` helper — the point is to
              // enumerate the paths the client reaches for, not a specific call form.
              for (const m of text.matchAll(/(?:fetch|axios\.(?:get|post|put|delete)|backendUrl)\s*\(\s*[`'"]([^`'"]*)[`'"]/g)) {
                let u = m[1];
                if (u.startsWith('http')) {
                  try { u = new URL(u).pathname; } catch { continue; }
                }
                // Fill template holes with a sample value: the UI calls
                // `/api/auth/${providerId}`, and probing a truncated `/api/auth`
                // would report a route that exists as missing.
                u = u.replace(/\$\{[^}]*\}/g, 'github');
                if (/^\/(health|ready|metrics|v1\/|api\/)/.test(u)) paths.add(u.replace(/\/+$/, '') || '/');
              }
            }
            t.record('uiPaths', [...paths]);
            t.require('UI references at least one backend endpoint', paths.size > 0, 'no fetch() calls found in apps/web-ui/src');
            for (const p of [...paths].sort()) {
              const res = await client.get(p);
              t.check(`${p} is routed`, !looksUnrouted(res), res.error || `status=${res.status} ct=${res.contentType} body=${String(res.text).slice(0, 80)}`);
            }
          },
        },
        {
          name: 'every path documented in the OpenAPI spec is reachable',
          async fn(t, client) {
            const spec = read(root, path.join('apps', 'web-ui', 'src', 'lib', 'openapi-spec.ts'));
            if (spec === null) {
              t.note('apps/web-ui/src/lib/openapi-spec.ts absent — skipping spec cross-check');
              t.check('openapi spec present', false, 'file not found');
              return;
            }
            const documented = [];
            const matches = [...spec.matchAll(/^\s{4}'(\/[^']*)':\s*\{/gm)];
            for (let i = 0; i < matches.length; i += 1) {
              const m = matches[i];
              const next = i + 1 < matches.length ? matches[i + 1].index : spec.length;
              // Slice to the *next* path key: a fixed window bleeds the following
              // endpoint's verbs into this one and probes the wrong method.
              const block = spec.slice(m.index, next);
              documented.push({
                path: m[1],
                get: /(^|\n)\s{6}get:/.test(block),
                post: /(^|\n)\s{6}post:/.test(block),
              });
            }
            t.record('documented', documented.map((d) => `${d.get ? 'GET' : ''}${d.post ? 'POST' : ''} ${d.path}`));
            t.require('spec declares paths', documented.length > 0, 'no `GET`/`POST` blocks parsed');
            const unknown = [];
            for (const d of documented) {
              const concrete = d.path.replace(/\{[^}]+\}/g, 'probe-0001');
              const res = d.get
                ? await client.get(concrete)
                : await client.post(concrete, {});
              if (looksUnrouted(res)) unknown.push(`${d.path} → ${res.status} unrouted`);
              else t.check(`${d.path} answered by the router (${res.status})`, true, res.error || `status=${res.status}`);
            }
            t.require('no documented path is unrouted', unknown.length === 0, unknown.join(' | '));
          },
        },
        {
          name: 'README package count claim matches the workspace',
          async fn(t) {
            const readme = read(root, 'README.md') || '';
            const claimMatch = readme.match(/badge\/packages-(\d+)/);
            const workspace = read(root, 'pnpm-workspace.yaml') || '';
            const packagesDir = path.join(root, 'packages');
            const actual = fs.existsSync(packagesDir)
              ? fs.readdirSync(packagesDir).filter((p) => fs.existsSync(path.join(packagesDir, p, 'package.json'))).length
              : 0;
            t.record('claim', claimMatch ? Number(claimMatch[1]) : null);
            t.record('actual', actual);
            t.check('pnpm-workspace lists packages', /packages\/\*/.test(workspace), 'packages/* glob missing');
            if (claimMatch) {
              const claimed = Number(claimMatch[1]);
              t.check(`badge claims ${claimed} packages, ${actual} exist`, actual >= claimed,
                `README overstates by ${claimed - actual}`);
            } else {
              t.note('no packages badge to verify');
            }
          },
        },
      ],
    }),
  ];
};
