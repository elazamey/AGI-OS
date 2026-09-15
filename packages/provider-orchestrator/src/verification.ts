// ============================================================================
// Verification plane: proves the artefact actually works.
// ----------------------------------------------------------------------------
// This exists because a deployment can be simultaneously "Ready" (platform
// status), serving HTTP 200 (frontend), and completely disconnected from its
// backend (all telemetry reading "Disconnected"). Platform readiness is an
// attribute of the deployment plane; only these checks can produce VERIFIED.
//
// The chain, per the operator's spec:
//   frontend HTTP 200 → valid HTML → expected app marker
//   → backend reachable → /health → /ready → /v1/models → chat contract
// ============================================================================

import http from 'node:http';
import https from 'node:https';
import type { EvidenceSink, StepCheck, VerificationVerdict } from './types.ts';

export interface HttpProbeResult {
  url: string;
  status: number;
  ms: number;
  text: string;
  json: Record<string, unknown> | null;
  contentType: string;
  /** Kept because platform headers are how a verdict names the build it tested. */
  headers: Record<string, string | string[] | undefined>;
  error?: string;
}

export interface ProbeOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/** Never throws: an unreachable URL is data (status 0), not an exception. */
export function probe(url: string, options: ProbeOptions = {}): Promise<HttpProbeResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    let target: URL;
    try {
      target = new URL(url);
    } catch (error) {
      resolve({ url, status: 0, ms: 0, text: '', json: null, contentType: '', headers: {}, error: `invalid url: ${(error as Error).message}` });
      return;
    }
    const transport = target.protocol === 'https:' ? https : http;
    const payload = options.body === undefined ? undefined : JSON.stringify(options.body);
    const headers: Record<string, string | number> = { Accept: 'application/json, text/html;q=0.9', ...options.headers };
    if (payload !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = transport.request(
      {
        method: options.method ?? (payload === undefined ? 'GET' : 'POST'),
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        headers,
        timeout: options.timeoutMs ?? 15_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c as Buffer));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const contentType = String(res.headers['content-type'] ?? '');
          let json: Record<string, unknown> | null = null;
          if (contentType.includes('json')) {
            try {
              json = JSON.parse(text) as Record<string, unknown>;
            } catch {
              json = null;
            }
          }
          resolve({ url, status: res.statusCode ?? 0, ms: Date.now() - started, text, json, contentType, headers: res.headers as Record<string, string | string[] | undefined> });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error(`timeout after ${options.timeoutMs ?? 15000}ms`)));
    req.on('error', (error: Error) =>
      resolve({ url, status: 0, ms: Date.now() - started, text: '', json: null, contentType: '', headers: {}, error: `${error.name}: ${error.message}` }),
    );
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

const FAIL = 'FAIL' as const;
const PASS = 'PASS' as const;
const SKIP = 'SKIP' as const;

export interface VerifyInput {
  frontendUrl?: string;
  backendBaseUrl?: string;
  /** Substrings that must appear in the served HTML (build-id, app title, marker). */
  markers?: string[];
  /** Model id for the chat smoke test; when omitted the first advertised model is used. */
  chatModel?: string;
  timeoutMs?: number;
  /** Auth header for governed backends. */
  bearerToken?: string;
  /** Require the chat contract step (default true — a UI alone proves nothing). */
  requireContract?: boolean;
  ledger?: EvidenceSink;
  now?: () => number;
}

function join(base: string | undefined, path: string): string | null {
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function verifyDeployment(input: VerifyInput): Promise<VerificationVerdict> {
  const started = (input.now?.() ?? Date.now());
  const checks: StepCheck[] = [];
  const reasons: string[] = [];
  const timeoutMs = input.timeoutMs ?? 15_000;
  const headers: Record<string, string> = input.bearerToken ? { Authorization: `Bearer ${input.bearerToken}` } : {};
  const hardFail = new Set(['frontend http', 'frontend html', 'app marker', 'backend health', 'models list', 'chat contract']);

  let frontendHttp = 0;
  let backendHealth = 0;
  let frontend: VerificationVerdict['frontend'] = SKIP;
  let backend: VerificationVerdict['backend'] = SKIP;
  let contract: VerificationVerdict['api_contract'] = SKIP;

  const add = (label: string, ok: boolean, detail?: string, skipped = false) => {
    checks.push({ label, ok, detail, skipped });
    if (!ok && !skipped) reasons.push(`${label}: ${detail ?? 'failed'}`);
    input.ledger?.write({ type: 'verify', label, ok, detail, skipped });
  };

  // ── 1-3 · frontend ──────────────────────────────────────────────────────
  if (input.frontendUrl) {
    const res = await probe(input.frontendUrl, { timeoutMs });
    frontendHttp = res.status;
    const ok = res.status === 200;
    frontend = ok ? PASS : FAIL;
    add('frontend http', ok, ok ? `200 in ${res.ms}ms` : res.error ?? `status=${res.status}`);
    // A served document, not an error page and not a truncated body: the closing tag
    // is what catches "200 OK with half a page", which is what a crashed SSR looks like.
    const looksHtml = /<!doctype html/i.test(res.text) && /<\/html>\s*$/i.test(res.text.trim());
    add('frontend html', looksHtml && res.text.length > 100, looksHtml ? `${res.text.length} bytes, closed document` : `not a complete html document (ct=${res.contentType || 'n/a'}, ${res.text.length}B)`);
    const markers = input.markers ?? [];
    if (markers.length > 0) {
      const missing = markers.filter((marker) => !res.text.includes(marker));
      add('app marker', missing.length === 0, missing.length ? `missing: ${missing.join(', ')} — is this the build we think it is?` : markers.join(', '));
    } else {
      add('app marker', true, 'no markers configured (skipped)', true);
    }
  } else {
    add('frontend http', true, 'no frontendUrl supplied', true);
    add('frontend html', true, 'no frontendUrl supplied', true);
  }

  // ── 4-6 · backend connectivity (this is where "Ready" lies) ──────────────
  const healthUrl = join(input.backendBaseUrl, '/health');
  if (healthUrl) {
    const res = await probe(healthUrl, { timeoutMs, headers });
    backendHealth = res.status;
    const body = res.json ?? {};
    const assertsHealth =
      body.status === 'ok' || body.status === 'healthy' || body.ok === true || body.success === true || body.healthy === true;
    backend = res.status === 200 && assertsHealth ? PASS : FAIL;
    add('backend health', res.status === 200 && assertsHealth, `status=${res.status}${res.error ? ` ${res.error}` : ''} body=${res.text.slice(0, 120)}`);

    const readyUrl = join(input.backendBaseUrl, '/ready');
    if (readyUrl) {
      const ready = await probe(readyUrl, { timeoutMs, headers });
      if (ready.status === 404) add('backend readiness', true, '/ready not routed', true);
      else add('backend readiness', ready.status === 200, `status=${ready.status}`);
    }

    const modelsUrl = join(input.backendBaseUrl, '/v1/models');
    let modelId: string | undefined = input.chatModel;
    if (modelsUrl) {
      const models = await probe(modelsUrl, { timeoutMs, headers });
      const data = (models.json?.data ?? []) as Array<Record<string, unknown>>;
      const shaped = models.status === 200 && Array.isArray(data) && data.length > 0 && typeof data[0]?.id === 'string';
      add('models list', shaped, shaped ? `${data.length} model(s): ${data.map((m) => m.id).slice(0, 4).join(', ')}` : `status=${models.status} body=${models.text.slice(0, 100)}`);
      if (shaped && !modelId) modelId = String(data[0].id);
    }

    // ── 7 · chat contract smoke (OpenAI shape + non-stub answer) ───────────
    const chatUrl = join(input.backendBaseUrl, '/v1/chat/completions');
    if (chatUrl && (input.requireContract !== false || modelId !== undefined)) {
      const res = await probe(chatUrl, {
        method: 'POST',
        timeoutMs,
        headers,
        body: { model: modelId ?? 'agi-os-cortex', messages: [{ role: 'user', content: 'Reply with a one-sentence description of the governance gate.' }] },
      });
      const choice = (res.json?.choices as Array<Record<string, unknown>> | undefined)?.[0];
      const message = choice?.message as Record<string, unknown> | undefined;
      const content = typeof message?.content === 'string' ? message.content : '';
      const shaped = res.status === 200 && typeof res.json?.id === 'string' && res.json?.object === 'chat.completion' && content.length > 24 && !!choice?.finish_reason;
      contract = shaped ? PASS : FAIL;
      add(
        'chat contract',
        shaped,
        shaped ? `id=${res.json?.id} content=${content.length} chars` : `status=${res.status}${res.error ? ` ${res.error}` : ''} body=${res.text.slice(0, 140)}`,
      );
    } else {
      add('chat contract', true, 'no chat endpoint available', true);
    }
  } else {
    add('backend health', true, 'no backendBaseUrl supplied — frontend-only verification', true);
    add('models list', true, 'no backendBaseUrl supplied', true);
    add('chat contract', true, 'no backendBaseUrl supplied', true);
  }

  // ── verdict ─────────────────────────────────────────────────────────────
  const failedHard = checks.filter((c) => !c.ok && !c.skipped && hardFail.has(c.label));
  const skipped = checks.filter((c) => c.skipped);
  let deployment: VerificationVerdict['deployment'] = 'VERIFIED';
  if (failedHard.length > 0) deployment = 'BLOCKED';
  else if (skipped.length > 0) {
    deployment = 'DEGRADED';
    reasons.push(`${skipped.length} step(s) could not be evaluated (${skipped.map((s) => s.label).join(', ')}) — unproven, not healthy`);
  }

  const verdict: VerificationVerdict = {
    frontend,
    frontend_http: frontendHttp,
    backend,
    backend_health: backendHealth,
    api_contract: contract,
    deployment,
    checks,
    durationMs: (input.now?.() ?? Date.now()) - started,
    reasons,
  };
  input.ledger?.write({ type: 'verdict', ...verdict });
  return verdict;
}

/** The compact shape the operator asked to see in logs and job summaries. */
export function verdictSummary(verdict: VerificationVerdict): Record<string, unknown> {
  return {
    frontend: verdict.frontend,
    frontend_http: verdict.frontend_http,
    backend: verdict.backend,
    backend_health: verdict.backend_health,
    api_contract: verdict.api_contract,
    deployment: verdict.deployment,
  };
}
