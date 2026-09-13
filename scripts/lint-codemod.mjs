#!/usr/bin/env node
/**
 * AGI OS — safe lint codemod
 * ---------------------------------------------------------------------------
 * Fixes `@typescript-eslint/no-unused-vars` findings using ESLint's exact
 * (line, column) for each report. It NEVER does a global string replace:
 * two declarations can share identical source text while only one is unused,
 * and a global replace silently breaks the other (this actually happened —
 * see docs/EXECUTION_PLAN.md, incident log).
 *
 * Handled automatically:
 *   DECL   unused import specifier (single-line or multi-line import block)
 *   ARG    unused parameter / catch binding  → prefixed with `_`
 *   ASSIGN unused `const x = <expr>`          → `<expr>` (keeps the side effect)
 *          unused `let x: T;`                 → line deleted
 *
 * Everything else is reported for human review. Iterates until ESLint is quiet
 * or no further progress is made.
 *
 * Usage: node scripts/lint-codemod.mjs [--rounds N] [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DRY = process.argv.includes('--dry');
const MAX_ROUNDS = Number(
  (process.argv.find((a, i, arr) => a === '--rounds' && arr[i + 1]) &&
    process.argv[process.argv.indexOf('--rounds') + 1]) || 6
);

function runEslint(args) {
  try {
    return execFileSync('npx', ['eslint', '.', ...args], {
      encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    return (err.stdout?.toString?.() ?? '') + (err.stderr?.toString?.() ?? '');
  }
}

function report() {
  const raw = runEslint(['-f', 'json']);
  const start = raw.indexOf('[');
  if (start === -1) throw new Error('could not read eslint report');
  return JSON.parse(raw.slice(start));
}

/** True when `pos` sits inside a `{ ... }` / `[ ... ]` destructuring pattern. */
function isInsideDestructuring(line, pos) {
  let depth = 0;
  for (let i = 0; i < pos; i++) {
    const c = line[i];
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth--;
  }
  return depth > 0;
}

function classify(message) {
  if (/is assigned a value but never used/.test(message)) return 'ASSIGN';
  if (/Allowed unused args/.test(message)) return 'ARG';
  if (/Allowed unused caught errors/.test(message)) return 'CATCH';
  return 'DECL';
}

/** Remove one named specifier from an import/export line, or the whole line. */
function stripSpecifier(lines, idx, name) {
  const line = lines[idx];
  if (line == null) return false;
  const escaped = name.replace(/[$]/g, '\\$');

  // whole-statement forms: `import * as X from '...'`, `import X from '...'`
  const whole = new RegExp(
    `^\\s*(import|export)\\s+(type\\s+)?(\\*\\s+as\\s+${escaped}|${escaped})\\s*(,\\s*\\{[^}]*\\}\\s*)?from\\s+['"][^'"]+['"];?\\s*$`
  );
  if (whole.test(line) && !line.includes(`{ ${name}`) && !line.includes(`{${name}`)) {
    // default/namespace import: only drop if nothing else is imported
    if (!/\{[^}]*\w/.test(line)) { lines[idx] = null; return true; }
  }

  // standalone line inside a multi-line import block:  "  Name,"  /  "  type Name,"
  const alone = new RegExp(`^\\s*(type\\s+)?${escaped}\\s*,?\\s*$`);
  if (alone.test(line.trim() === line.trim() ? line : line) && /^\s*(type\s+)?[\w$]+\s*,?\s*$/.test(line)) {
    lines[idx] = null; return true;
  }

  // inline specifier: { A, Name, B }
  const spec = new RegExp(`(?<=[{,])\\s*(type\\s+)?${escaped}(\\s+as\\s+[\\w$]+)?\\s*(?=,|\\})`);
  if (spec.test(line)) {
    let next = line.replace(spec, '')
      .replace(/\{\s*,/g, '{').replace(/,\s*,/g, ',').replace(/,\s*\}/g, ' }');
    if (/^\s*(import|export)\s+(type\s+)?\{\s*\}\s*(from\s+['"][^'"]+['"])?;?\s*$/.test(next)) {
      lines[idx] = null;
    } else if (/^\s*(import|export)\s+(type\s+)?\{\s*\}\s*,/.test(next)) {
      lines[idx] = null;                       // `import { }, Foo from` → keep Foo elsewhere
    } else {
      // never leave an empty destructuring pattern behind
      if (/\(\s*\{\s*\}\s*[:)]/.test(next)) return false;
      lines[idx] = next;
    }
    return true;
  }
  return false;
}

function fixFile(file, items) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let touched = false;
  const manual = [];

  // Process bottom-up so earlier line numbers stay valid.
  const sorted = [...items].sort((a, b) => b.line - a.line || b.column - a.column);

  for (const it of sorted) {
    const idx = it.line - 1;
    const line = lines[idx];
    if (line == null) continue;

    // ---- ARG / CATCH: insert `_` exactly at the reported column ------------
    if (it.kind === 'ARG' || it.kind === 'CATCH') {
      const pos = it.column - 1;
      if (line.slice(pos, pos + it.name.length) !== it.name) { manual.push(it); continue; }
      if (line[pos - 1] === '_') continue;
      // A destructured parameter binds a PROPERTY name, not a local identifier:
      // turning `{ taskId }` into `{ _taskId }` changes which property is read
      // and breaks the type. Those need `key: _alias` by hand.
      if (isInsideDestructuring(line, pos)) { manual.push(it); continue; }
      lines[idx] = line.slice(0, pos) + '_' + line.slice(pos);
      touched = true; continue;
    }

    // ---- ASSIGN: strip the binding on THIS line only ----------------------
    if (it.kind === 'ASSIGN') {
      // `let x: T;` — the declaration may be assigned in a beforeEach/setup
      // block further down. Deleting only the declaration leaves a live
      // assignment to an undeclared name (ReferenceError at runtime), so this
      // shape is always handed to a human.
      if (new RegExp(`^\\s*(let|var)\\s+${it.name}\\s*(:[^=]+)?;\\s*$`).test(line)) {
        manual.push(it); continue;
      }
      // `const x = <expr>;`  → `<expr>;`  (side effect preserved)
      const binding = new RegExp(`^(\\s*)const\\s+${it.name}\\s*=\\s*`);
      const m = binding.exec(line);
      if (m) {
        const rest = line.slice(m[0].length);
        // only if this line is not a destructuring / for-of head
        if (/^\s*(\[|\{)/.test(rest) || /^\s*for\s*\(/.test(line)) { manual.push(it); continue; }
        lines[idx] = m[1] + rest;
        touched = true; continue;
      }
      manual.push(it); continue;
    }

    // ---- DECL: unused import specifier ------------------------------------
    if (it.kind === 'DECL') {
      let done = false;
      for (let i = idx; i < Math.min(lines.length, idx + 10) && !done; i++) {
        if (lines[i] == null) continue;
        if (!new RegExp(`\\b${it.name.replace(/[$]/g, '\\$')}\\b`).test(lines[i])) continue;
        if (!/^\s*(import|export)\b/.test(lines[i]) && !/^\s*(type\s+)?[\w$]+\s*,?\s*$/.test(lines[i])) continue;
        done = stripSpecifier(lines, i, it.name);
      }
      if (!done) manual.push(it);
      if (done) touched = true;
    }
  }

  if (touched && !DRY) {
    writeFileSync(file, lines.filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n'));
  }
  return { touched, manual };
}

let round = 0;
let totalFixed = 0;
let lastManual = [];

while (round < MAX_ROUNDS) {
  round++;
  const rep = report();
  const perFile = new Map();
  for (const f of rep) {
    for (const m of f.messages) {
      if (m.ruleId !== '@typescript-eslint/no-unused-vars') continue;
      const name = /^'([^']+)'/.exec(m.message)?.[1];
      if (!name) continue;
      if (!perFile.has(f.filePath)) perFile.set(f.filePath, []);
      perFile.get(f.filePath).push({ name, kind: classify(m.message), line: m.line, column: m.column });
    }
  }
  const count = [...perFile.values()].reduce((a, b) => a + b.length, 0);
  if (count === 0) { console.log(`round ${round}: no unused-vars findings left`); break; }

  let fixed = 0; const manual = [];
  for (const [file, items] of perFile) {
    const r = fixFile(file, items);
    if (r.touched) fixed++;
    manual.push(...r.manual.map((m) => `${file.replace(process.cwd() + '/', '')}:${m.line}  ${m.name}  (${m.kind})`));
  }
  totalFixed += fixed;
  lastManual = manual;
  console.log(`round ${round}: ${count} findings, edited ${fixed} files${DRY ? ' (dry)' : ''}`);
  if (fixed === 0) break;
}

// Final tally of everything that is still an error
const finalRep = report();
const byRule = {};
let errors = 0, warnings = 0;
for (const f of finalRep) {
  errors += f.errorCount; warnings += f.warningCount;
  for (const m of f.messages) {
    const k = (m.severity === 2 ? 'E ' : 'W ') + (m.ruleId ?? '?');
    byRule[k] = (byRule[k] ?? 0) + 1;
  }
}
console.log(`\nfiles edited: ${totalFixed}`);
console.log(`eslint now → errors: ${errors}, warnings: ${warnings}`);
for (const [k, v] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
if (lastManual.length) {
  console.log(`\n${lastManual.length} findings need MANUAL review:`);
  for (const m of [...new Set(lastManual)]) console.log('  ' + m);
}
