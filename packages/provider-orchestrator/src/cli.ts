#!/usr/bin/env node
// ============================================================================
// agios-control — the control-plane CLI (providers · plan · verify · gate)
// ----------------------------------------------------------------------------
// Runs with zero installs on Node >= 22.6 (type stripping), which is deliberate:
// the gate must be executable in a bare CI container and on a laptop without a build
// step, or it degrades into documentation.
//
//   node --experimental-strip-types src/cli.ts gate --live --strict
//   node --experimental-strip-types src/cli.ts plan --task=coding --json
// ============================================================================

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatDecision, routeAgents, routeModels } from './router.ts';
import { formatPlan, planMission } from './orchestrator.ts';
import { huggingFaceTarget, unboundTarget, vercelProductionTarget, type DeploymentTarget, type ObserveResult } from './deployment.ts';
import { verifyDeployment, verdictSummary } from './verification.ts';
import { evaluateGate, renderGateReport, type CertificationSummary } from './gate.ts';
import { JsonlLedger } from './evidence.ts';
import { loadControlPlaneConfig, type ControlPlaneConfig } from './config.ts';
import type { CapabilityRequirement, VerificationVerdict } from './types.ts';

const HELP = `agios-control — AGI-OS control plane

  providers [--config=FILE]                        both planes, their allowances and their state
  plan    [--prompt=TEXT] [--plane=model|agent|auto] [--capabilities=a,b]
          [--task=coding] [--local] [--allow-paid] [--granted=a,b] [--json]
                                                   the routing decision + score breakdown
  verify  [--frontend=URL] [--backend=URL] [--live] [--json]
                                                   post-deploy functional verification
  gate    [--live] [--strict] [--certification=PATH] [--run-certification] [--mission=TEXT]
                                                   deployment + verification + certification → VERIFIED/DEGRADED/BLOCKED

  --config defaults to agi-os-providers.json at the repository root
  --live          probe the published URLs from the config (requires network)
  --allow-paid    operator override of FREE_ONLY for one plan; written into the evidence
  --out=DIR       evidence + report directory (default .agi-os/control)
`;

interface Args {
  command: string;
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): Args {
  const command = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'help';
  const flags: Record<string, string | boolean> = {};
  for (const raw of argv.slice(command === 'help' ? 0 : 1)) {
    if (!raw.startsWith('--')) continue;
    const body = raw.slice(2);
    const eq = body.indexOf('=');
    if (eq === -1) flags[body] = true;
    else flags[body.slice(0, eq)] = body.slice(eq + 1);
  }
  return { command, flags };
}

function findRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

function loadConfig(flags: Args['flags']): { config: ControlPlaneConfig; file: string; root: string } {
  const root = findRoot(process.cwd());
  const file = typeof flags.config === 'string' ? flags.config : join(root, 'agi-os-providers.json');
  if (!existsSync(file)) throw new Error(`config not found: ${file}`);
  return { config: loadControlPlaneConfig(file), file, root };
}

function requirementFrom(flags: Args['flags'], config: ControlPlaneConfig): CapabilityRequirement {
  const capabilities = typeof flags.capabilities === 'string' ? flags.capabilities.split(',').map((c) => c.trim()).filter(Boolean) : config.defaultRequirement.capabilities;
  return {
    ...config.defaultRequirement,
    capabilities,
    taskKind: typeof flags.task === 'string' ? (flags.task as CapabilityRequirement['taskKind']) : config.defaultRequirement.taskKind,
    mustBeLocal: flags.local === true || config.defaultRequirement.mustBeLocal,
    model: typeof flags.model === 'string' ? flags.model : config.defaultRequirement.model,
    prefer: typeof flags.prefer === 'string' ? (flags.prefer as CapabilityRequirement['prefer']) : config.defaultRequirement.prefer,
    autonomy: flags.plane === 'agent' ? 'full-mission' : config.defaultRequirement.autonomy,
    allowPaidOverride: flags['allow-paid'] === true,
    approvals: typeof flags.granted === 'string' ? flags.granted.split(',').map((s) => s.trim()).filter(Boolean) : [],
  };
}

function targetsFor(config: ControlPlaneConfig): DeploymentTarget[] {
  return config.deployments.map((target) => {
    if (!target.enabled) return unboundTarget(target.id, target.url, 'disabled in agi-os-providers.json');
    if (target.id === 'huggingface') return huggingFaceTarget(target.url, target.spaceRepo);
    if (target.id === 'vercel') return vercelProductionTarget(target.url);
    return unboundTarget(target.id, target.url, 'no publisher implemented for this platform yet');
  });
}

function readCertification(path: string): CertificationSummary | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as CertificationSummary;
  } catch (error) {
    return { gate: 'BLOCKED', reason: `unreadable certification summary at ${path}: ${(error as Error).message}` };
  }
}

function runCertification(root: string, baseUrl: string | undefined): CertificationSummary {
  const env = { ...process.env, ...(baseUrl ? { AGIOS_BASE_URL: baseUrl } : {}) };
  const child = spawnSync(process.execPath, [join(root, 'tests', 'production', 'runner.js'), '--json'], { cwd: root, encoding: 'utf8', env, timeout: 30 * 60 * 1000 });
  const stdout = child.stdout ?? '';
  const start = stdout.indexOf('{\n  "runId"');
  if (start === -1) {
    return { gate: 'BLOCKED', reason: `certification runner produced no summary (exit ${child.status ?? '?'}): ${(child.stderr ?? '').slice(0, 400) || stdout.slice(-400)}` };
  }
  try {
    return JSON.parse(stdout.slice(start)) as CertificationSummary;
  } catch (error) {
    return { gate: 'BLOCKED', reason: `certification summary is not JSON: ${(error as Error).message}` };
  }
}

/** Offline runs must not fabricate a verdict, so they report SKIP and the gate degrades. */
async function verifyTarget(
  config: ControlPlaneConfig,
  url: string | undefined,
  backend: string | undefined,
  live: boolean,
  ledger?: JsonlLedger,
): Promise<VerificationVerdict> {
  if (!live) {
    // Recorded as skipped rather than omitted: an offline run has to be identifiable
    // as an offline run in the evidence, three weeks later, by someone else.
    ledger?.write({ type: 'verify:skipped', reason: 'offline run (--live not passed)', url: url ?? null, backend: backend ?? null });
    return {
      frontend: 'SKIP',
      frontend_http: 0,
      backend: 'SKIP',
      backend_health: 0,
      api_contract: 'SKIP',
      deployment: 'DEGRADED',
      checks: [
        { label: 'frontend http', ok: true, skipped: true, detail: 'offline run (pass --live to probe the published deployment)' },
        { label: 'backend health', ok: true, skipped: true, detail: 'offline run' },
        { label: 'chat contract', ok: true, skipped: true, detail: 'offline run' },
      ],
      durationMs: 0,
      reasons: ['offline run: verification steps were not executed, so nothing here is proven'],
    };
  }
  const bearerName = config.verification.bearerEnv;
  return verifyDeployment({
    frontendUrl: url,
    backendBaseUrl: backend,
    markers: config.deployments.find((d) => d.url === url)?.markers ?? [],
    timeoutMs: config.verification.timeoutMs,
    requireContract: config.verification.requireContract,
    bearerToken: bearerName ? process.env[bearerName] : undefined,
    ledger,
  });
}

function providerLine(provider: ControlPlaneConfig['models'][number]): string {
  const tier = provider.freeTier;
  const allowance = tier ? `${tier.basis} ${tier.remaining ?? tier.limit - (tier.used ?? 0)}/${tier.limit}${tier.hardStop === false ? ' (soft)' : ''}` : 'no allowance declared';
  const mark = !provider.enabled ? '✗' : provider.billing === 'paid' ? '$' : '✓';
  return `  ${mark} ${provider.id.padEnd(20)} ${(provider.billing ?? 'free-tier').padEnd(13)} ${provider.health.padEnd(14)} ${allowance}`;
}

export async function main(argv: string[]): Promise<number> {
  const { command, flags } = parseArgs(argv);
  const json = flags.json === true;
  if (command === 'help' || flags.help === true) {
    process.stdout.write(HELP);
    return 0;
  }

  const { config, file, root } = loadConfig(flags);
  const live = flags.live === true || config.verification.probeLive;
  const freeOnly = config.freeOnly && flags['allow-paid'] !== true;
  const outDir = typeof flags.out === 'string' ? flags.out : join(root, '.agi-os', 'control');
  const runId = `${command}-${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`;

  if (config.issues.length > 0) {
    process.stderr.write(`config issues in ${file}:\n${config.issues.map((i) => `  ! ${i.provider}: ${i.problem}`).join('\n')}\n`);
    if (command === 'gate') return 2;
  }

  if (command === 'providers') {
    process.stdout.write(`FREE_ONLY: ${config.freeOnly ? 'on' : 'OFF (manifest declares paid use allowed)'}\n\n`);
    process.stdout.write('model plane (free-first operating layer)\n');
    for (const provider of config.models) process.stdout.write(`${providerLine(provider)}\n`);
    process.stdout.write('\nagent plane (optional adapters)\n');
    for (const provider of config.agents) process.stdout.write(`${providerLine(provider)}\n`);
    process.stdout.write('\ndeployment plane\n');
    for (const target of config.deployments) {
      process.stdout.write(`  ${target.enabled ? '✓' : '✗'} ${target.id.padEnd(20)} ${target.mode.padEnd(8)} ${target.url || '(no url)'}\n`);
    }
    process.stdout.write('\nverification plane\n');
    for (const target of config.verifications) process.stdout.write(`  · ${target.id}${target.notes ? ` — ${target.notes}` : ''}\n`);
    return 0;
  }

  if (command === 'plan') {
    const requirement = requirementFrom(flags, config);
    if (flags.plane === 'model' || flags.plane === 'agent') {
      // One plane only: useful for CI jobs that must not touch the agent adapters.
      const single = (flags.plane === 'agent' ? routeAgents : routeModels)({
        providers: config.registry.all(),
        requirement,
        prompt: typeof flags.prompt === 'string' ? flags.prompt : undefined,
        freeOnly,
      });
      if (json) process.stdout.write(`${JSON.stringify({ plane: flags.plane, freeOnly, ...single }, null, 2)}\n`);
      else process.stdout.write(`${formatDecision(single)}\n`);
      return single.selected ? 0 : 2;
    }
    const plan = planMission({ registry: config.registry, requirement, prompt: typeof flags.prompt === 'string' ? flags.prompt : undefined, freeOnly });
    if (json) {
      process.stdout.write(
        `${JSON.stringify(
          {
            freeOnly,
            plane: plan.plane,
            provider: plan.provider?.id ?? null,
            score: plan.score,
            reason: plan.reason,
            ladder: plan.ladder.map((p) => p.id),
            scores: plan.model.scores,
            freeFirst: plan.model.freeFirst,
            blockedReason: plan.provider ? null : plan.model.blockedReason,
          },
          null,
          2,
        )}\n`,
      );
    } else {
      process.stdout.write(`${formatPlan(plan)}\n`);
    }
    return plan.provider ? 0 : 2;
  }

  if (command === 'verify') {
    const outDirForVerify = typeof flags.out === 'string' ? flags.out : null;
    if (outDirForVerify) mkdirSync(outDirForVerify, { recursive: true });
    const primary = config.deployments.find((d) => d.enabled) ?? config.deployments[0];
    const verdict = await verifyTarget(
      config,
      typeof flags.frontend === 'string' ? flags.frontend : primary?.url,
      typeof flags.backend === 'string' ? flags.backend : primary?.backendBaseUrl,
      live,
    );
    if (json) process.stdout.write(`${JSON.stringify(verdictSummary(verdict), null, 2)}\n`);
    else {
      for (const check of verdict.checks) {
        const mark = check.skipped ? '·' : check.ok ? '✓' : '✗';
        process.stdout.write(`${mark} ${check.label.padEnd(18)} ${check.detail ?? ''}\n`);
      }
      process.stdout.write(`\n${JSON.stringify(verdictSummary(verdict))}\n`);
    }
    if (outDirForVerify) {
      // Written for CI artefacts: a verdict that only lived in a log line cannot be
      // attached to a deployment, and this file is what the gate re-reads.
      writeFileSync(join(outDirForVerify, 'verify-latest.json'), JSON.stringify({ ...verdictSummary(verdict), checks: verdict.checks, reasons: verdict.reasons, durationMs: verdict.durationMs }, null, 2), 'utf8');
    }
    return verdict.deployment === 'VERIFIED' ? 0 : verdict.deployment === 'DEGRADED' ? 1 : 2;
  }

  if (command === 'gate') {
    mkdirSync(outDir, { recursive: true });
    const ledger = new JsonlLedger({ path: join(outDir, `${runId}.jsonl`), runId });
    const targets = targetsFor(config);
    const deployments: ObserveResult[] = [];
    const verifications: Array<{ target: string; verdict: VerificationVerdict }> = [];

    // Who ran the mission is part of the deployment record: it names the free provider
    // that produced the artefact, and proves FREE_ONLY was in force while it did.
    const mission = typeof flags.mission === 'string' ? flags.mission : undefined;
    if (mission !== undefined) {
      const plan = planMission({
        registry: config.registry,
        requirement: requirementFrom(flags, config),
        prompt: mission,
        freeOnly,
        onEvent: (event) => ledger.write(event),
      });
      ledger.write({ type: 'plan', plane: plan.plane, provider: plan.provider?.id ?? null, score: plan.score, freeOnly, reason: plan.reason });
      process.stdout.write(`mission ran on: ${plan.provider?.id ?? plan.blockedReason ?? 'NO_ELIGIBLE_PROVIDER'} (plane ${plan.plane}, score ${plan.score})\n`);
    }

    for (const target of targets) {
      const configured = config.deployments.find((d) => d.id === target.id);
      const observed = await target.observe({ timeoutMs: config.verification.timeoutMs });
      deployments.push(observed);
      ledger.write({ type: 'observe', ...observed });
      const verdict = await verifyTarget(config, target.url, configured?.backendBaseUrl, live, ledger);
      verifications.push({ target: target.id, verdict });
      ledger.write({ type: 'verify:target', target: target.id, ...verdictSummary(verdict) });
    }

    const certificationPath = typeof flags.certification === 'string' ? flags.certification : join(root, 'tests', 'production', 'reports', 'latest.json');
    const certification =
      flags['run-certification'] === true
        ? runCertification(root, typeof flags.baseUrl === 'string' ? flags.baseUrl : config.deployments.find((d) => d.backendBaseUrl)?.backendBaseUrl)
        : readCertification(certificationPath);
    ledger.write({ type: 'certification', path: certificationPath, summary: certification });

    const decision = evaluateGate({ deployments, verifications, certification, strict: flags.strict === true });
    writeFileSync(join(outDir, `gate-${runId}.md`), renderGateReport(decision), 'utf8');
    writeFileSync(
      join(outDir, 'gate-latest.json'),
      JSON.stringify({ ...decision, inputs: { ...decision.inputs, verifications: decision.inputs.verifications.map((v) => ({ target: v.target, summary: verdictSummary(v.verdict) })) } }, null, 2),
      'utf8',
    );
    ledger.close({ status: decision.status, reasons: decision.reasons, freeOnly });

    if (json) process.stdout.write(`${JSON.stringify({ status: decision.status, reasons: decision.reasons, exitCode: decision.exitCode, freeOnly }, null, 2)}\n`);
    else process.stdout.write(`${renderGateReport(decision)}\n`);
    process.stdout.write(`evidence: ${join(outDir, `${runId}.jsonl`)}\n`);
    return decision.exitCode;
  }

  process.stderr.write(`unknown command: ${command}\n\n${HELP}`);
  return 64;
}

const invokedDirectly = process.argv[1] && /cli\.(ts|js|mjs|cjs)$/.test(process.argv[1]);
if (invokedDirectly) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error: Error) => {
      process.stderr.write(`error: ${error.message}\n`);
      process.exit(2);
    });
}
