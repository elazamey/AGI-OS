#!/usr/bin/env node
// ============================================================================
// AGI OS - CLI entrypoint
// ----------------------------------------------------------------------------
// `package.json` declared `bin: { agi: "./dist/index.js" }`, but index.ts is a
// barrel of exports: it never read process.argv and had no shebang, so running
// `agi` printed nothing and exited 0 — an inert command that looked installed.
//
// This is the real entrypoint. It parses argv, dispatches to Cli, renders
// human-readable output (or JSON with --json), and sets an exit code that
// reflects what actually happened.
//
//   exit 0  the command succeeded
//   exit 1  the command ran and failed
//   exit 2  usage error (unknown flag, missing argument)
// ============================================================================

import { Cli } from './Cli.js';
import type { CliResult } from './Cli.js';

const VERSION = '0.1.0';

interface ParsedArgs {
  command?: string;
  rest: string[];
  json: boolean;
  dataDir?: string;
  help: boolean;
  version: boolean;
  usageError?: string;
}

/** Minimal, dependency-free argv parser. */
export function parseArgv(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { rest: [], json: false, help: false, version: false };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--json') {
      out.json = true;
    } else if (token === '--help' || token === '-h') {
      out.help = true;
    } else if (token === '--version' || token === '-v') {
      out.version = true;
    } else if (token === '--data-dir') {
      const value = argv[++i];
      if (!value) {
        out.usageError = '--data-dir requires a value';
        return out;
      }
      out.dataDir = value;
    } else if (token.startsWith('--data-dir=')) {
      out.dataDir = token.slice('--data-dir='.length);
    } else if (token.startsWith('-') && token.length > 1) {
      out.usageError = `unknown flag: ${token}`;
      return out;
    } else if (out.command === undefined) {
      out.command = token;
    } else {
      out.rest.push(token);
    }
  }
  return out;
}

const USAGE = `agi ${VERSION} — AGI OS command line

Usage:
  agi <command> [args] [--json] [--data-dir <dir>]

Commands:
  init                 Create the AGI-OS data directory and database
  status               Report cost-guard, provider and safety state
  mission "<prompt>"   Dispatch an autonomous agent mission
  help                 Show this help

Flags:
  --json               Emit machine-readable JSON instead of prose
  --data-dir <dir>     Where AGI-OS keeps its state (default: .agi-os)
  -h, --help           Show this help
  -v, --version        Print the version

Exit codes:
  0  success    1  command failed    2  usage error
`;

/** Render a CliResult as prose. Kept explicit so output is stable and testable. */
export function renderResult(result: CliResult): string {
  const lines: string[] = [];

  if (!result.success) {
    lines.push(`error: ${result.error ?? 'unknown failure'}`);
    return lines.join('\n');
  }

  switch (result.command) {
    case 'init': {
      const d = (result.data ?? {}) as { dataDir?: string; dbPath?: string; message?: string };
      lines.push(d.message ?? 'AGI-OS environment initialized');
      if (d.dataDir) lines.push(`  data dir: ${d.dataDir}`);
      if (d.dbPath) lines.push(`  database: ${d.dbPath}`);
      break;
    }
    case 'status': {
      // `result.data` is optional, so every level is defended: a renderer that
      // throws turns a partial status report into a crash.
      const d = (result.data ?? {}) as {
        costGuard?: { enforced?: boolean; maxSpend?: number; remaining?: number; status?: string };
        llm?: { provider?: string; defaultModel?: string };
        timestamp?: string;
      };
      const cg = d.costGuard ?? {};
      lines.push('AGI-OS status');
      lines.push(`  cost guard:  ${cg.enforced ? 'enforced' : 'NOT ENFORCED'} — ${cg.status ?? 'unknown'}`);
      lines.push(`  max spend:   ${cg.maxSpend ?? 0}`);
      lines.push(`  remaining:   ${cg.remaining ?? 0}`);
      lines.push(`  provider:    ${d.llm?.provider ?? 'unknown'}`);
      lines.push(`  model:       ${d.llm?.defaultModel ?? 'unknown'}`);
      if (d.timestamp) lines.push(`  as of:       ${d.timestamp}`);
      break;
    }
    case 'mission': {
      const d = (result.data ?? {}) as { missionId?: string; prompt?: string; status?: string; message?: string };
      lines.push(d.message ?? 'Mission created');
      if (d.missionId) lines.push(`  mission: ${d.missionId}`);
      if (d.status) lines.push(`  status:  ${d.status}`);
      if (d.prompt) lines.push(`  prompt:  ${d.prompt}`);
      break;
    }
    case 'help': {
      const d = (result.data ?? {}) as { commands?: Array<{ name: string; description: string; usage: string }> };
      lines.push('Available commands:');
      for (const c of d.commands ?? []) {
        lines.push(`  ${c.usage.padEnd(28)} ${c.description}`);
      }
      break;
    }
    default:
      lines.push(JSON.stringify(result.data ?? {}, null, 2));
  }

  return lines.join('\n');
}

export async function run(argv: string[], io: {
  stdout: (s: string) => void;
  stderr: (s: string) => void;
} = { stdout: (s) => process.stdout.write(s + '\n'), stderr: (s) => process.stderr.write(s + '\n') }): Promise<number> {
  const args = parseArgv(argv);

  if (args.usageError) {
    io.stderr(`error: ${args.usageError}`);
    io.stderr(USAGE);
    return 2;
  }
  if (args.version) {
    io.stdout(VERSION);
    return 0;
  }
  // No command at all, an explicit --help, or `agi help` all print usage.
  if (args.help || args.command === undefined) {
    io.stdout(USAGE);
    return args.command === undefined && !args.help ? 2 : 0;
  }

  const cli = new Cli(args.dataDir ? { dataDir: args.dataDir } : {});

  // `agi mission "do the thing"` must reach Cli.mission as one prompt string.
  const forwarded = args.command === 'mission' && args.rest.length > 0
    ? [args.command, args.rest.join(' ')]
    : [args.command, ...args.rest];

  let result: CliResult;
  try {
    result = await cli.execute(forwarded);
  } catch (err) {
    io.stderr(`error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }

  if (args.json) {
    io.stdout(JSON.stringify(result, null, 2));
  } else if (result.command === 'help') {
    io.stdout(USAGE);
  } else {
    io.stdout(renderResult(result));
  }

  return result.success ? 0 : 1;
}

// Only take over the process when executed directly, so importing this module
// (from tests, or from another package) has no side effects.
const invokedDirectly =
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('/main.js') || process.argv[1].endsWith('main.ts'));

if (invokedDirectly) {
  run(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      process.stderr.write(`fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
      process.exitCode = 1;
    }
  );
}
