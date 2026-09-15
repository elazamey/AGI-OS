// ============================================================================
// Deployment plane: model the platforms that publish output — do not re-implement
// the ones that already work.
// ----------------------------------------------------------------------------
// Vercel is already in Production, auto-deployed from `main`, and Ready. Building a
// second path into it would fork the source of truth for "what is deployed" (the
// exact class of bug the HF Space had: two entry points, one of them never run).
// So each target here has two halves:
//
//   deploy()   — only when this repository owns the publish step (HF Space push)
//   observe()  — read the platform's own answer (deployment id, url, state)
//
// and *neither* of them is allowed to claim health. That is `verification.ts`'s
// job, and the reason `DeploymentResult.status` has no "VERIFIED" value.
// ============================================================================

import { spawnSync } from 'node:child_process';
import type { DeployContext } from './types.ts';
import { probe, type HttpProbeResult } from './verification.ts';

export interface DeploymentTarget {
  readonly id: string;
  /** `observe` = the platform deploys itself; `publish` = we push the artefact. */
  readonly mode: 'observe' | 'publish';
  readonly url: string;
  observe(signal?: { timeoutMs?: number }): Promise<ObserveResult>;
  publish?(context: DeployContext): Promise<PublishResult>;
}

export interface ObserveResult {
  provider: string;
  deploymentId: string;
  url: string;
  status: 'DEPLOYED' | 'FAILED' | 'UNKNOWN';
  /** What the platform itself reports — never a health claim. */
  platformState: string;
  evidence: Record<string, unknown>;
}

export interface PublishResult {
  ok: boolean;
  status: 'DEPLOYED' | 'FAILED' | 'BLOCKED';
  message: string;
  evidence?: Record<string, unknown>;
}

function headerText(result: HttpProbeResult, name: string): string | undefined {
  const value = result.headers?.[name];
  return Array.isArray(value) ? String(value[0]) : value === undefined ? undefined : String(value);
}

/**
 * Vercel production: observe-only. The deployment id comes from `x-vercel-id`,
 * which Vercel returns on every response and which pins the *exact* build that
 * answered — so a verdict can name the commit it actually tested.
 */
export function vercelProductionTarget(url: string): DeploymentTarget {
  return {
    id: 'vercel',
    mode: 'observe',
    url,
    async observe(signal) {
      const result = await probe(url, { timeoutMs: signal?.timeoutMs ?? 15_000 });
      const deploymentId = headerText(result, 'x-vercel-id') ?? `unknown@${new Date().toISOString()}`;
      const served = result.status >= 200 && result.status < 400;
      return {
        provider: 'vercel',
        deploymentId,
        url,
        status: served ? 'DEPLOYED' : result.status === 0 ? 'UNKNOWN' : 'FAILED',
        // `ready` here is Vercel's word for "the build exists", nothing more.
        platformState: served ? `served ${result.status}` : `not serving (status=${result.status})`,
        evidence: {
          http_status: result.status,
          x_vercel_id: headerText(result, 'x-vercel-id') ?? null,
          x_vercel_cache: headerText(result, 'x-vercel-cache') ?? null,
          server: headerText(result, 'server') ?? null,
          latency_ms: result.ms,
          deploy_owner: 'vercel-git-integration (main auto-deploy) — this repository does not trigger Vercel builds by design',
          error: result.error ?? null,
        },
      };
    },
  };
}

/**
 * Hugging Face Space: we own the publish step (git push of `apps/hf-backend`), so
 * this target can both publish and observe. `publish` is opt-in and requires the
 * `HF_TOKEN` env — it never shells out silently during a verification run.
 */
export function huggingFaceTarget(url: string, spaceRepo?: string): DeploymentTarget {
  return {
    id: 'huggingface',
    mode: 'publish',
    url,
    async observe(signal) {
      const healthUrl = `${url.replace(/\/+$/, '')}/health`;
      const result = await probe(healthUrl, { timeoutMs: signal?.timeoutMs ?? 15_000 });
      const served = result.status === 200;
      const body = result.json as Record<string, unknown> | null;
      const isHfErrorPage = !served && /space is in error|couldn.t find|404/i.test(result.text);
      return {
        provider: 'huggingface',
        deploymentId: spaceRepo ?? new URL(url).hostname,
        url,
        status: served ? 'DEPLOYED' : 'FAILED',
        platformState: served
          ? `serving /health (version=${String(body?.version ?? 'unknown')})`
          : isHfErrorPage
            ? 'Space reports an error/404 at the platform level'
            : `not serving (status=${result.status})`,
        evidence: {
          health_url: healthUrl,
          http_status: result.status,
          latency_ms: result.ms,
          body: result.text.slice(0, 400),
          error: result.error ?? null,
          note: 'a 404 from the space host means nothing is bound to /health — see apps/hf-backend/README.md for the app_file/main.py split this replaces',
        },
      };
    },
    async publish(context) {
      if (!spaceRepo) return { ok: false, status: 'BLOCKED', message: 'no HF space repository configured (set HUGGINGFACE_SPACE=namespace/name)' };
      const token = process.env.HF_TOKEN ?? context.env?.HF_TOKEN;
      if (!token) return { ok: false, status: 'BLOCKED', message: 'HF_TOKEN is not set; refusing to publish' };
      if (context.dryRun) return { ok: true, status: 'BLOCKED', message: 'dry-run: push not executed', evidence: { space: spaceRepo, workdir: context.workdir } };
      const remote = `https://user:${token}@huggingface.co/spaces/${spaceRepo}`;
      const run = spawnSync('git', ['-C', context.workdir, 'push', remote, `HEAD:${context.ref}`], { encoding: 'utf8' });
      const ok = run.status === 0;
      return {
        ok,
        status: ok ? 'DEPLOYED' : 'FAILED',
        message: ok ? `pushed HEAD:${context.ref} to ${spaceRepo}` : `git push failed: ${run.stderr.trim().slice(0, 300) || `exit ${run.status}`}`,
        evidence: { commit: context.commit, stdout: run.stdout.slice(0, 400), stderr: run.stderr.slice(0, 400) },
      };
    },
  };
}

/**
 * A target the project intends to use but has not bound yet. It is present in the
 * registry and reports BLOCKED — that is honest — instead of being silently
 * omitted or, worse, reported as a success it did not earn.
 */
export function unboundTarget(id: string, url: string, reason: string): DeploymentTarget {
  return {
    id,
    mode: 'observe',
    url,
    async observe() {
      return { provider: id, deploymentId: `${id}:unbound`, url, status: 'UNKNOWN', platformState: `not bound: ${reason}`, evidence: { reason } };
    },
    async publish() {
      return { ok: false, status: 'BLOCKED', message: `${id} is not configured (${reason})` };
    },
  };
}
