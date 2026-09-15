#!/usr/bin/env node
'use strict';
// ============================================================================
// AGI-OS Production Certification — entry point
// ----------------------------------------------------------------------------
//   node tests/production/runner.js                 # certify AGIOS_BASE_URL
//   node tests/production/runner.js --with-mock     # boot reference server, certify it
//   node tests/production/runner.js --mock-profile=stub   # prove the gate catches a fake
//   node tests/production/runner.js --list          # show suites without calling the target
//
// Exit codes: 0 PASSED · 1 DEGRADED · 2 BLOCKED · 3 harness/target setup error
// ============================================================================

const path = require('node:path');
const cp = require('node:child_process');

const config = require('./certify.config');
const { Runner } = require('./lib/harness');

function parseArgs(argv) {
  const args = { list: false, json: false, spawnMock: false, profile: null, only: null, strict: null };
  for (const raw of argv) {
    const [flag, value] = raw.includes('=') ? [raw.slice(0, raw.indexOf('=')), raw.slice(raw.indexOf('=') + 1)] : [raw, null];
    switch (flag) {
      case '--list': args.list = true; break;
      case '--json': args.json = true; break;
      case '--with-mock': case '--mock': args.spawnMock = true; break;
      case '--no-mock': args.spawnMock = false; break;
      case '--mock-profile': args.profile = value; break;
      case '--only': args.only = value; break;
      case '--base-url': process.env.AGIOS_BASE_URL = value; break;
      case '--key': case '--api-key': process.env.AGIOS_API_KEY = value; break;
      case '--strict': args.strict = true; break;
      case '--lenient': args.strict = false; break;
      case '--help': case '-h': usage(); process.exit(0); break;
      default:
        if (!flag.startsWith('-')) continue;
        console.error(`unknown flag: ${flag}`);
        usage();
        process.exit(3);
    }
  }
  return args;
}

function usage() {
  console.log(`AGI-OS production certification

  node tests/production/runner.js [flags]

  --with-mock            boot tools/mock-server.js (reference implementation) and certify it
  --mock-profile=<name>  conformant | stub | dead   (default: conformant)
  --base-url=<url>       target to certify (default: $AGIOS_BASE_URL or http://127.0.0.1:7860)
  --key=<key>            bearer token (default: $AGIOS_API_KEY)
  --only=<substring>     run suites whose name contains <substring>
  --strict               a non-critical failure also withholds certification
  --json                 print machine-readable summary
  --list                 list suites and exit
`);
}

async function waitForHealth(baseUrl, timeoutMs) {
  const { URL } = require('node:url');
  const http = require('node:http');
  const https = require('node:https');
  const target = new URL(baseUrl);
  const transport = target.protocol === 'https:' ? https : http;
  const deadline = Date.now() + timeoutMs;
  let lastError = 'not tried';
  while (Date.now() < deadline) {
    const ok = await new Promise((resolve) => {
      const req = transport.request({
        host: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        method: 'GET',
        path: `${target.pathname.replace(/\/+$/, '')}/health`,
        timeout: 1500,
      }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', (err) => { lastError = err.message; resolve(false); });
      req.on('timeout', () => { req.destroy(new Error('connect timeout')); });
      req.end();
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  console.error(`  target never became ready: ${baseUrl} (${lastError})`);
  return false;
}

function spawnMock(profile, port) {
  const child = cp.spawn(process.execPath, [config.mock.script], {
    env: { ...process.env, MOCK_PROFILE: profile, MOCK_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const log = [];
  const capture = (buf) => {
    const s = String(buf).trim();
    log.push(s);
    if (log.length <= 12 && process.env.AGIOS_DEBUG) console.error(`  [mock] ${s}`);
  };
  child.stdout.on('data', capture);
  child.stderr.on('data', capture);
  child.on('exit', (code, signal) => {
    if (process.env.AGIOS_DEBUG) console.error(`  [mock] exited code=${code} signal=${signal}`);
  });
  child.certifyLog = log;
  return child;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.profile) config.mock.profile = args.profile;
  if (args.only) config.suiteFilter = args.only;
  if (args.strict !== null) config.strict = args.strict;
  if (args.spawnMock) {
    config.mock.spawn = true;
    config.baseUrl = `http://127.0.0.1:${config.mock.port}`;
  }

  const specsDir = path.join(__dirname, 'specs');
  const runner = new Runner(config);
  const files = runner.loadSpecs(specsDir);

  if (args.list) {
    console.log(`specs loaded: ${files.length}`);
    for (const s of runner.suites) {
      console.log(`  ${s.critical ? '●' : '○'} ${s.name.padEnd(28)} ${s.tests.length} test(s)${s.note ? ` — ${s.note}` : ''}`);
    }
    console.log(`\n  ● = critical (failure blocks the gate and skips everything after it)`);
    return 0;
  }

  let mock = null;
  if (config.mock.spawn) {
    console.log(`▸ booting reference server (profile=${config.mock.profile}, port=${config.mock.port})`);
    mock = spawnMock(config.mock.profile, config.mock.port);
    await waitForHealth(config.baseUrl, config.mock.bootTimeoutMs);
  }

  console.log(`▸ AGI-OS production certification`);
  console.log(`  run:   ${config.runId}`);
  console.log(`  target: ${config.baseUrl}${config.mock.spawn ? ` (mock profile: ${config.mock.profile})` : ''}`);
  console.log(`  suites: ${runner.suites.length} · specs: ${files.length} · node ${process.version}\n`);

  let summary;
  try {
    summary = await runner.run();
  } finally {
    if (mock && !mock.killed) mock.kill('SIGTERM');
  }

  if (args.json) {
    console.log(JSON.stringify({ runId: config.runId, target: config.baseUrl, evidence: runner.evidenceFile, report: runner.reportFile, ...summary }, null, 2));
  } else {
    console.log('');
    console.log('─'.repeat(72));
    const colour = summary.gate === 'PASSED' ? '\x1b[42m\x1b[30m' : summary.gate === 'DEGRADED' ? '\x1b[43m\x1b[30m' : '\x1b[41m\x1b[37m';
    console.log(`${colour} FINAL GATE: ${summary.gate} \x1b[0m  ${summary.passed} passed · ${summary.failed} failed · ${summary.skipped} skipped · ${summary.assertions} assertions`);
    console.log(`\x1b[1m Reason:\x1b[0m ${summary.reason}`);
    console.log('─'.repeat(72));
    console.log(`  evidence: ${path.relative(process.cwd(), runner.evidenceFile)}`);
    console.log(`  report:   ${path.relative(process.cwd(), runner.reportFile)}`);
  }

  return summary.gate === 'PASSED' ? 0 : summary.gate === 'DEGRADED' ? 1 : 2;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`\n\x1b[31mharness error\x1b[0m: ${err && err.stack ? err.stack : err}`);
    process.exit(3);
  });
