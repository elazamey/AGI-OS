#!/usr/bin/env node
'use strict';
// ============================================================================
// AGI-OS reference server — certification fixture, NOT a product artefact
// ----------------------------------------------------------------------------
// A dependency-free implementation of the HTTP contract the certification suite
// enforces (OpenAI-compatible /v1/* + governed mission surface). It exists so
// that:
//   * `runner.js --with-mock` can prove the harness itself is correct end to end
//     without a live deployment;
//   * CI can run the security specs against a server whose behaviour is known;
//   * `--mock-profile=stub` demonstrates that a fake "everything is 200" server
//     is REJECTED by the gate — the check nobody thought to write until now.
//
//   MOCK_PROFILE=conformant  full contract                → gate PASSED
//   MOCK_PROFILE=stub        200-everywhere canned server  → gate BLOCKED
//   MOCK_PROFILE=dead        binds the port then exits     → gate BLOCKED (skip cascade)
// ============================================================================

const http = require('node:http');
const crypto = require('node:crypto');

const PROFILE = (process.env.MOCK_PROFILE || 'conformant').toLowerCase();
const PORT = Number(process.env.MOCK_PORT || 7861);
const STARTED = Date.now();

// ---------------------------------------------------------------------------
// governance model (mirrors packages/governance/src/{policy,vocabulary}.ts)
// ---------------------------------------------------------------------------

const DANGEROUS_PHRASES = [
  'rm -rf /', 'rm -rf /*', '--no-preserve-root', 'mkfs.', 'dd if=/dev/zero of=/dev/sd',
  'shutdown -h now', 'chmod -R 777 /', ':(){ :|:& };:', 'drop table', 'truncate table',
  'delete from users', '/etc/shadow', '/etc/passwd', 'id_rsa', 'aws_access_key_id',
  'git push --force', 'push --force origin main', 'curl -fsSL http://collector.example',
  'pipe to sh', '| sh', '|bash',
];
// Whole-word triggers, split the way apps/hf-backend/governance.py splits them:
// unambiguous device names block on sight, while ordinary English words (dd,
// format, crontab) only fire next to an execution verb or a shell metacharacter —
// substring matching on these is what blocked "information" and "added" in the
// historical bug (see packages/governance/src/policy.ts header).
const UNAMBIGUOUS_WORDS = ['mkfs', 'fdisk', 'parted', 'shred'];
const CONTEXTUAL_WORDS = ['dd', 'format', 'crontab', 'shred'];
const EXEC_HINT_RE = /\b(run|runs|running|execute|exec|executes|eval|shell|command|cmdline|invoke|bash)\b/;
const SHELL_META_RE = /(\|\s*\w|&&|;\s*\w|\$\(|`[^`]+`)/;
const ESCALATE_PHRASES = ['git reset --hard', 'reset --hard', 'chmod 600', 'drop index', 'delete from', 'reboot', 'systemctl restart'];
const INJECTION_PATTERNS = [
  /begin trusted instructions/i, /new instructions for any automated agent/i,
  /governance override/i, /policy_enforce\s*=\s*false/i, /ignore (all |the )?(previous|prior|above|that)/i,
  /system\s*override/i, /you are dan/i, /governance is disabled/i,
  /operator handoff/i, /untrusted tool output contains imperative/i,
];

function normalize(text) {
  return String(text || '')
    // strip zero-width / bidi control characters used to slip past substring gates
    .replace(/[\u200B-\u200D\u2060\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    // fullwidth ASCII → ASCII (homoglyph obfuscation)
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function matchesDangerous(lower) {
  for (const phrase of DANGEROUS_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) return { kind: 'block', rule: 'POL-005', detail: phrase };
  }
  const contextualOnly = !EXEC_HINT_RE.test(lower) && !SHELL_META_RE.test(lower);
  for (const word of [...UNAMBIGUOUS_WORDS, ...CONTEXTUAL_WORDS].sort()) {
    if (!new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(lower)) continue;
    if (contextualOnly && CONTEXTUAL_WORDS.includes(word)) continue;
    return { kind: 'block', rule: 'POL-005', detail: word };
  }
  if (/\/etc\/(passwd|shadow)|\.ssh\/id_rsa|\.env\b/.test(lower)) return { kind: 'block', rule: 'POL-001', detail: 'sensitive file access' };
  if (/write[^a-z]{0,12}\/(?!tmp\/|var\/tmp\/)[a-z]/.test(lower)) return { kind: 'block', rule: 'POL-006', detail: 'write outside workspace' };
  return null;
}

function matchesEscalate(lower) {
  for (const phrase of ESCALATE_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) return { kind: 'ask', rule: 'POL-002', detail: phrase };
  }
  return null;
}

function detectInjection(lower) {
  const hit = INJECTION_PATTERNS.find((re) => re.test(lower));
  return hit ? String(hit).slice(1, -3) : null;
}

function evaluate(text) {
  const lower = normalize(text);
  const danger = matchesDangerous(lower);
  const injection = detectInjection(lower);
  if (danger) return { decision: 'block', rule: danger.rule, reason: `policy ${danger.rule}: ${danger.detail}`, injection };
  if (injection && /http:|https:|upload|exfil|post the|send the/i.test(lower)) {
    return { decision: 'block', rule: 'POL-004', reason: `untrusted embedded instruction requesting outbound action (${injection})`, injection };
  }
  const escalation = matchesEscalate(lower);
  if (escalation) return { decision: 'ask', rule: escalation.rule, reason: `policy ${escalation.rule}: ${escalation.detail} needs an operator`, injection };
  if (injection) return { decision: 'allow', rule: null, reason: 'no dangerous operation found', injection, note: 'embedded instructions in untrusted content were treated as data and ignored' };
  return { decision: 'allow', rule: null, reason: 'no matching deny rule; workspace-scoped read/write only', injection };
}

// ---------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------

const KEYS = new Map([
  ['agi-os-dev-key-2026', { tier: 'enterprise', permissions: ['*'], spent_tokens: 0, budget_tokens: 1000000 }],
  ['agi-os-readonly-2026', { tier: 'read', permissions: ['skills:read', 'memory:read'], spent_tokens: 0, budget_tokens: 10 }],
]);
const SKILLS = ['core-skills.filesystem', 'coding-skills.patch', 'git-skills.commit', 'research-skills.search', 'verification-skills.diff-audit'];
const MISSIONS = new Map();
const APPROVALS = new Map();
const MEMORY = new Map();
const COUNTERS = { requests: 0, missions_total: 0, blocked: 0, approvals: 0, errors_4xx: 0, errors_5xx: 0 };
const MODELS = ['agi-os-cortex', 'agi-os-cortex-v2'];
const MAX_BODY = 1024 * 1024; // 1 MB; 2 MB must come back as 413

function shortId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function promptHash(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 10);
}

function detectIntent(lower) {
  if (/patch|repair|fix|vulnerab|ترقيع|إصلاح|ثغرة/.test(lower)) return 'patch';
  if (/build|creat|project|scaffold|بناء|إنشاء|مشروع/.test(lower)) return 'build';
  if (/analy|review|audit|scan|فحص|تحليل|مراجعة/.test(lower)) return 'analyze';
  if (/deploy|rollout|نشر/.test(lower)) return 'deploy';
  return 'general';
}

// ---------------------------------------------------------------------------
// answer synthesis — deterministic per prompt, but never a single canned string
// ---------------------------------------------------------------------------

function composeAnswer(prompt, opts = {}) {
  const lower = normalize(prompt);
  const intent = detectIntent(lower);
  const hash = promptHash(lower);
  const words = lower.split(' ').filter(Boolean).length;
  const layers = 'L0 request integrity · L1 capability scope · L2 policy gate · L3 execution isolation · L4 outcome verification';
  const base = {
    general: `Acknowledge request ${hash}: ${words} word(s) triaged through the kernel. Plan: classify → constrain → execute under L2 policy → verify at L4. No destructive operation detected.`,
    patch: `Patch plan ${hash}: locate the vulnerable path, add a regression test first, then change exactly one module and re-verify. Governance note: no silent fix — the diff is the artefact.`,
    build: `Build plan ${hash}: scaffold the module boundaries, wire the public interface, add a smoke test, then a changelog entry. Verification gate: build green plus test green, not "looks done".`,
    analyze: `Analysis ${hash}: I read for structure, coupling and error handling before judging style. Findings are reported with file, line and a concrete failure scenario, never as vibes.`,
    deploy: `Deploy plan ${hash}: dry-run first, capture the pre-deploy digest, apply, verify health, keep the rollback transaction id in the ledger.`,
  };
  let text = base[intent];
  if (opts.json) {
    return JSON.stringify({
      request_id: hash, intent, governance: { decision: opts.decision || 'allow', level: 'L4', layers: layers.split(' · ').length },
      summary: text.split('.')[0], words,
    });
  }
  if (opts.governanceNote) text += `\n\nGovernance: ${opts.governanceNote}`;
  if (intent === 'analyze' || /five governance layers|governance layers/.test(lower)) {
    text += `\n\nThe layers, in order: ${layers}.`;
  }
  return text;
}

const REFUSAL_CHAT = (reason) => `I can't perform that. ${reason} — the governance gate (policy engine, not a prompt instruction) made the call. `
  + 'Ask me to produce a plan, a diff or a verification report instead, and I will run it under approval.';

// ---------------------------------------------------------------------------
// http plumbing
// ---------------------------------------------------------------------------

function send(res, status, payload, headers = {}) {
  const isString = typeof payload === 'string';
  const body = isString ? payload : JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': isString ? 'text/plain; charset=utf-8' : 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'X-AGI-OS-Profile': PROFILE,
    ...headers,
  });
  res.end(body);
}

function framework404(res, req) {
  // Byte-for-byte FastAPI's unrouted response, so the harness can distinguish
  // "no such route" from "no such resource".
  send(res, 404, { detail: 'Not Found' });
  void req;
}

function openAIError(res, status, message, type = 'invalid_request_error', code = null) {
  send(res, status, { error: { message, type, param: null, code } });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    // Never `destroy()` on overflow: resetting mid-upload makes the client see
    // ECONNRESET instead of the 413 we mean to send. Drain the body, answer 413,
    // then close — that is the difference between "rejected" and "crashed".
    req.on('data', (c) => {
      size += c.length;
      if (size <= MAX_BODY + 64 * 1024) chunks.push(c);
    });
    req.on('end', () => resolve({
      text: Buffer.concat(chunks).toString('utf8'),
      size,
      overflow: size > MAX_BODY,
    }));
    req.on('error', reject);
  });
}

function authenticate(req, permission) {
  if (PROFILE === 'stub') return { ok: true, key: null };
  const raw = String(req.headers.authorization || '');
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, message: 'API key required' };
  const key = KEYS.get(token);
  if (!key) return { ok: false, status: 401, message: 'Invalid API key' };
  if (permission && !key.permissions.includes('*') && !key.permissions.includes(permission)) {
    return { ok: false, status: 403, message: `Permission denied: ${permission}` };
  }
  return { ok: true, key, token };
}

// ---------------------------------------------------------------------------
// routes
// ---------------------------------------------------------------------------

function missionRecord(missionId) {
  const m = MISSIONS.get(missionId);
  if (!m) return null;
  return m;
}

function createMission(prompt, permission) {
  const id = shortId('miss');
  const evaluation = evaluate(prompt);
  const now = Date.now();
  const mission = {
    id,
    prompt: String(prompt).slice(0, 4000),
    status: 'ACCEPTED',
    lifecycle_stage: 'INIT',
    created_at: now,
    updated_at: now,
    events: [{ stage: 'INIT', type: 'mission_accepted', at: now, prompt_hash: promptHash(normalize(prompt)) }],
    governance: { decision: evaluation.decision, rule: evaluation.rule, reason: evaluation.reason, untrusted_instructions: evaluation.injection || null },
    result: null,
    approval_required: false,
    approval_status: null,
    permission,
  };
  // Refused and escalated missions are stored too: the audit trail has to contain
  // the attacks as well as the successes, and readback-by-id must not 404.
  MISSIONS.set(id, mission);
  mission.events.push({
    stage: 'POLICY', type: 'policy_evaluated', at: Date.now(),
    risk_level: evaluation.decision === 'block' ? 'CRITICAL' : evaluation.decision === 'ask' ? 'HIGH' : 'LOW',
    decision: evaluation.decision.toUpperCase(), rule_id: evaluation.rule, reason: evaluation.reason,
  });

  if (evaluation.decision === 'block') {
    mission.status = 'BLOCKED';
    mission.lifecycle_stage = 'POLICY';
    mission.events.push({ stage: 'POLICY', type: 'execution_refused', at: Date.now(), reason: evaluation.reason });
    COUNTERS.blocked += 1;
    return { mission, evaluation };
  }

  if (evaluation.decision === 'ask') {
    const approvalId = shortId('appr');
    mission.status = 'PENDING_APPROVAL';
    mission.lifecycle_stage = 'POLICY';
    mission.approval_required = true;
    mission.approval_status = 'pending';
    APPROVALS.set(approvalId, { approval_id: approvalId, mission_id: id, action: mission.prompt.slice(0, 160), status: 'pending', created_at: Date.now() });
    mission.events.push({ stage: 'POLICY', type: 'approval_requested', at: Date.now(), approval_id: approvalId });
    COUNTERS.approvals += 1;
    mission.approval_id = approvalId;
    return { mission, evaluation, approvalId };
  }

  mission.status = 'PLANNING';
  mission.lifecycle_stage = 'PLANNER';
  mission.events.push({ stage: 'PLANNER', type: 'planning_started', at: Date.now(), subtasks: 3, intent: detectIntent(normalize(mission.prompt)) });

  mission.status = 'EXECUTING';
  mission.lifecycle_stage = 'EXECUTION';
  mission.events.push({ stage: 'EXECUTION', type: 'execution_completed', at: Date.now(), isolated: true, sandbox: 'workspace-scope' });

  mission.lifecycle_stage = 'VERIFIER';
  mission.status = 'VERIFYING';
  const checksRun = 2 + (promptHash(mission.prompt).charCodeAt(0) % 3);
  mission.events.push({ stage: 'VERIFIER', type: 'verification_passed', at: Date.now(), pass_rate: 1, checks_run: checksRun });

  const txn = shortId('txn');
  mission.lifecycle_stage = 'LEDGER';
  mission.status = 'RECORDED';
  mission.events.push({ stage: 'LEDGER', type: 'transaction_recorded', at: Date.now(), txn_id: txn });

  const flagged = evaluation.injection
    ? ' Embedded instructions from untrusted content were detected and ignored (treated as data).'
    : '';
  mission.result = {
    output: composeAnswer(mission.prompt, { governanceNote: `${evaluation.reason}${flagged ? ' · untrusted instructions quarantined' : ''}` }),
    report: {
      request_id: promptHash(mission.prompt),
      intent: detectIntent(normalize(mission.prompt)),
      files_inspected: ['README.md', 'apps/hf-backend/main.py', 'packages/governance/src/policy.ts'],
      findings: checksRun,
      injection_detected: Boolean(evaluation.injection),
      injection_marker: evaluation.injection || null,
      note: evaluation.note || 'no untrusted instruction patterns found',
    },
    verification: { pass_rate: 1, checks_run: checksRun, evidence_required: true },
    transaction: txn,
  };
  mission.status = 'COMPLETED';
  mission.events.push({ stage: 'LEDGER', type: 'mission_completed', at: Date.now(), txn_id: txn });
  return { mission, evaluation };
}

function streamSSE(res, prompt) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  const answer = composeAnswer(prompt);
  const pieces = answer.match(/.{1,28}/gs) || [answer];
  const id = `chatcmpl-${promptHash(prompt).slice(0, 12)}`;
  const created = Math.floor(Date.now() / 1000);
  const envelope = (delta, finish) => ({
    id, object: 'chat.completion.chunk', created, model: MODELS[0],
    choices: [{ index: 0, delta, finish_reason: finish }],
  });
  let i = 0;
  const tick = () => {
    if (i === 0) res.write(`data: ${JSON.stringify(envelope({ role: 'assistant' }, null))}\n\n`);
    if (i < pieces.length) {
      res.write(`data: ${JSON.stringify(envelope({ content: pieces[i] }, null))}\n\n`);
      i += 1;
      setTimeout(tick, 8);
      return;
    }
    res.write(`data: ${JSON.stringify(envelope({}, 'stop'))}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  };
  tick();
}

const ROUTES = {
  'GET /health': (req, res) => send(res, 200, {
    status: 'ok',
    version: '1.34.0-mock',
    system: 'AGI-OS Cortex Core (certification reference server)',
    profile: PROFILE,
    level: 'L4',
    governance: 'policy-engine-inline',
    missions: MISSIONS.size,
    uptime_s: Math.round((Date.now() - STARTED) / 1000),
  }),

  'GET /ready': (req, res) => send(res, 200, { ready: true, checks: { kernel: 'ok', policy: 'ok', ledger: 'ok' } }),

  'GET /': (req, res) => send(res, 200,
    `<!doctype html><html><head><title>AGI-OS reference server</title></head><body>`
    + `<h1>AGI-OS certification reference server</h1><p>profile: <code>${PROFILE}</code></p>`
    + `<ul><li><a href="/health">/health</a></li><li><a href="/v1/models">/v1/models</a></li><li><a href="/docs">/docs</a></li></ul>`
    + `<p>Not a deployment: fixture for tests/production. See tests/production/tools/mock-server.js</p></body></html>`,
    { 'Content-Type': 'text/html; charset=utf-8' }),

  'GET /metrics': (req, res) => send(res, 200, [
    '# HELP agi_os_requests_total Requests served',
    '# TYPE agi_os_requests_total counter',
    `agi_os_requests_total ${COUNTERS.requests}`,
    '# HELP agi_os_missions_total Total missions executed',
    '# TYPE agi_os_missions_total counter',
    `agi_os_missions_total ${COUNTERS.missions_total}`,
    '# HELP agi_os_missions_blocked Missions refused by policy',
    '# TYPE agi_os_missions_blocked counter',
    `agi_os_missions_blocked ${COUNTERS.blocked}`,
    '# HELP agi_os_approvals_pending Approvals awaiting an operator',
    '# TYPE agi_os_approvals_pending gauge',
    `agi_os_approvals_pending ${[...APPROVALS.values()].filter((a) => a.status === 'pending').length}`,
  ].join('\n'), { 'Content-Type': 'text/plain; version=0.0.4' }),

  'GET /v1/models': (req, res) => send(res, 200, {
    object: 'list',
    data: MODELS.map((id) => ({ id, object: 'model', created: Math.floor(STARTED / 1000), owned_by: 'agi-os' })),
  }),

  'GET /api/v1/self-model': (req, res, ctx) => {
    const auth = authenticate(req);
    if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
    send(res, 200, {
      success: true,
      data: {
        version: '1.34.0-mock', skills_registered: SKILLS.length,
        missions_completed: [...MISSIONS.values()].filter((m) => m.status === 'COMPLETED').length,
        total_cost_usd: 0.0021, total_tokens: 4180,
        capabilities: ['planning', 'execution', 'verification', 'rollback', 'skill-synthesis', 'memory', 'openai-L4', 'human-in-the-loop'],
      },
    });
    void ctx;
  },

  'GET /api/v1/skills': (req, res) => {
    const auth = authenticate(req, 'skills:read');
    if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
    send(res, 200, { success: true, data: [...SKILLS] });
  },

  'GET /api/v1/approvals': (req, res) => {
    const auth = authenticate(req);
    if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
    send(res, 200, { success: true, data: [...APPROVALS.values()] });
  },

  'GET /api/v1/missions': (req, res) => {
    const auth = authenticate(req);
    if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
    send(res, 200, { success: true, data: [...MISSIONS.values()].map(publicMission) });
  },

  'GET /api/auth/github': (req, res) => send(res, 302, '', { Location: 'https://github.com/login/oauth/authorize?client_id=&scope=repo' }),
  'GET /api/auth/google': (req, res) => send(res, 302, '', { Location: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' }),

  'GET /api/integrations/status': (req, res) => {
    const auth = authenticate(req);
    if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
    send(res, 200, { success: true, data: { github: { status: 'disconnected' }, google: { status: 'disconnected' } } });
  },
};

function publicMission(m) {
  const { permission, prompt, ...rest } = m;
  void permission;
  return { ...rest, prompt: `${String(prompt).slice(0, 80)}…`, result: m.result };
}

async function handlePostChat(req, res, json) {
  if (PROFILE === 'stub') {
    return send(res, 200, { choices: [{ message: { content: 'ok' } }] });
  }
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    return openAIError(res, 400, 'request body must be a JSON object');
  }
  const model = json.model;
  if (typeof model !== 'string' || !model) {
    return openAIError(res, 400, "missing required parameter: 'model'", 'invalid_request_error', 'model_missing');
  }
  if (!MODELS.includes(model)) {
    return openAIError(res, 404, `The model '${model}' does not exist. Available: ${MODELS.join(', ')}`, 'invalid_request_error', 'model_not_found');
  }
  if (!Array.isArray(json.messages) || json.messages.length === 0) {
    return openAIError(res, 400, "'messages' must be a non-empty array", 'invalid_request_error', 'messages_missing');
  }
  for (const msg of json.messages) {
    if (!msg || typeof msg !== 'object' || typeof msg.role !== 'string') {
      return openAIError(res, 400, 'each message needs a string role', 'invalid_request_error');
    }
    if (msg.content !== null && typeof msg.content !== 'string') {
      return openAIError(res, 400, `message.content must be a string or null, got ${typeof msg.content}`, 'invalid_request_error');
    }
  }
  if (json.max_tokens !== undefined && !(Number.isInteger(json.max_tokens) && json.max_tokens > 0)) {
    return openAIError(res, 400, "'max_tokens' must be a positive integer", 'invalid_request_error');
  }

  const lastUser = [...json.messages].reverse().find((m) => m.role === 'user');
  const prompt = String(lastUser?.content || '');
  const evaluation = evaluate(prompt);
  const revealAttempt = /(print|reveal|repeat|show)[\s\S]{0,40}(system prompt|preamble|instructions you were given|sentinel)/i.test(prompt);

  if (json.stream === true) {
    if (evaluation.decision !== 'allow') {
      return openAIError(res, 403, evaluation.reason, 'governance_error', 'policy_blocked');
    }
    return streamSSE(res, prompt);
  }

  // tool selection semantics
  if (json.tool_choice && typeof json.tool_choice === 'object') {
    const wanted = json.tool_choice?.function?.name;
    const declared = Array.isArray(json.tools) ? json.tools.map((tool) => tool?.function?.name).filter(Boolean) : [];
    if (!declared.includes(wanted)) {
      return openAIError(res, 400, `tool_choice references an undeclared tool: ${wanted}`, 'invalid_request_error', 'tool_not_registered');
    }
  }
  const requireTool = json.tool_choice === 'required' || json.tool_choice === 'auto';
  if (requireTool && evaluation.decision === 'allow' && Array.isArray(json.tools) && json.tools.length) {
    const name = json.tools[0]?.function?.name;
    return send(res, 200, {
      id: `chatcmpl-${promptHash(prompt).slice(0, 12)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: shortId('call'), type: 'function', function: { name, arguments: JSON.stringify({ prompt: prompt.slice(0, 200) }) } }],
        },
        finish_reason: 'tool_calls',
      }],
      usage: { prompt_tokens: wordCount(prompt), completion_tokens: 24, total_tokens: wordCount(prompt) + 24 },
      governance: { decision: 'allow', note: 'tool call is a proposal; execution still passes the policy gate' },
    });
  }

  if (evaluation.decision !== 'allow' || revealAttempt) {
    const reason = revealAttempt
      ? 'The system prompt and policy configuration are not disclosed to callers.'
      : evaluation.reason;
    return send(res, 200, {
      id: `chatcmpl-${promptHash(prompt).slice(0, 12)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, message: { role: 'assistant', content: REFUSAL_CHAT(reason) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: wordCount(prompt), completion_tokens: 40, total_tokens: wordCount(prompt) + 40 },
      governance: { decision: revealAttempt ? 'allow' : evaluation.decision, rule: evaluation.rule, reason },
    });
  }

  const content = composeAnswer(prompt, {
    json: json.response_format?.type === 'json_object',
    decision: evaluation.decision,
    governanceNote: evaluation.injection ? 'untrusted instructions ignored' : null,
  });
  const promptTokens = wordCount(prompt);
  return send(res, 200, {
    id: `chatcmpl-${crypto.randomUUID().slice(0, 12)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: promptTokens, completion_tokens: wordCount(content), total_tokens: promptTokens + wordCount(content) },
    governance: { decision: 'allow', level: 'L4', reason: evaluation.reason },
  });
}

function wordCount(text) {
  return Math.max(1, String(text).trim().split(/\s+/).length);
}

async function handlePostMission(req, res, json) {
  if (PROFILE === 'stub') return send(res, 200, { success: true, data: { id: shortId('miss'), status: 'COMPLETED', result: {} } });
  const auth = authenticate(req, 'missions:execute');
  if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
  if (json === null || typeof json !== 'object') return openAIError(res, 400, 'body must be a JSON object');
  const prompt = json.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return openAIError(res, 400, "'prompt' must be a non-empty string", 'invalid_request_error', 'prompt_missing');
  }
  const { mission, approvalId } = createMission(prompt);
  COUNTERS.missions_total += 1;
  const meta = {
    policy_decision: mission.governance.decision,
    rate_limit_remaining: 59,
  };
  if (mission.status === 'BLOCKED') {
    meta.requires_approval = false;
    return send(res, 403, {
      success: false,
      error: `governance: ${mission.governance.reason}`,
      decision: 'block',
      rule: mission.governance.rule,
      mission_id: mission.id,
      risk_level: 'CRITICAL',
    });
  }
  if (mission.status === 'PENDING_APPROVAL') {
    meta.requires_approval = true;
    meta.approval_id = approvalId;
  }
  return send(res, 200, { success: true, data: publicMission(mission), meta });
}

async function handleSynthesizeSkill(req, res, json) {
  if (PROFILE === 'stub') return send(res, 200, { success: true, data: { registered: json?.name || 'anon' } });
  const auth = authenticate(req, 'skills:write');
  if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
  if (json === null || typeof json !== 'object') return openAIError(res, 400, 'body must be a JSON object');
  const name = String(json.name || '');
  if (!/^[a-z0-9][a-z0-9._-]{2,40}$/.test(name)) {
    return send(res, 422, { success: false, error: 'skill name must match ^[a-z0-9][a-z0-9._-]{2,40}$', code: 'invalid_skill_name' });
  }
  const corpus = `${name} ${json.description || ''} ${Array.isArray(json.triggers) ? json.triggers.join(' ') : ''} ${json.instructions || ''} ${json.testCode || ''}`;
  const danger = matchesDangerous(normalize(corpus));
  if (danger) {
    COUNTERS.blocked += 1;
    return send(res, 403, {
      success: false,
      error: `skill refused by policy ${danger.rule}: matched "${danger.detail}" in the skill body`,
      code: 'policy_blocked',
      skill: name,
      registered: false,
    });
  }
  SKILLS.push(name);
  return send(res, 200, { success: true, data: { registered: name, quarantine: 'workspace-only', review: 'pending' } });
}

const CRED_RE = /(AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY|-----BEGIN|api[_-]?key["'\s:=]+[A-Za-z0-9+/_-]{12,}|xox[bap]-[A-Za-z0-9-]{10,})/;

function handleMemoryStore(req, res, json) {
  const auth = authenticate(req, 'memory:write');
  if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
  if (!json || typeof json.key !== 'string' || !json.key) return openAIError(res, 400, "'key' is required");
  const flat = JSON.stringify(json.value ?? null);
  if (CRED_RE.test(flat)) {
    return send(res, 422, { success: false, error: 'credential-shaped material may not be persisted in memory; use the secret store', code: 'secret_material_refused' });
  }
  MEMORY.set(json.key, json.value);
  return send(res, 200, { success: true, data: { stored: true, key: json.key } });
}

function handleMemoryQuery(req, res, json) {
  const auth = authenticate(req, 'memory:read');
  if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
  const needle = normalize(json?.query || '');
  const results = [...MEMORY.entries()]
    .filter(([k, v]) => !needle || normalize(`${k} ${JSON.stringify(v)}`).includes(needle))
    .slice(0, 10)
    .map(([k, v]) => ({ key: k, value: v, source: 'memory' }));
  return send(res, 200, { success: true, data: { results, query: json?.query || '' } });
}

// ---------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  COUNTERS.requests += 1;
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$|^$/, (m) => (m === '' ? '/' : '')) || '/';
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const known = `${method} ${pathname}`;
  if (ROUTES[known]) {
    const handler = ROUTES[known];
    Promise.resolve(handler(req, res, { url })).catch((err) => {
      COUNTERS.errors_5xx += 1;
      if (!res.headersSent) send(res, 500, { error: { message: 'internal error', type: 'server_error', param: null, code: null } });
      else res.end();
      void err;
    });
    return;
  }

  // POST routes
  if (method === 'POST') {
    (async () => {
      const { text, size, overflow } = await readBody(req).catch(() => ({ text: '', size: 0, overflow: true }));
      if (overflow || size > MAX_BODY) {
        COUNTERS.errors_4xx += 1;
        return openAIError(res, 413, `payload too large (${size} bytes > ${MAX_BODY} limit)`, 'invalid_request_error', 'context_length_exceeded');
      }
      let json = {};
      if (text.trim()) {
        const ct = String(req.headers['content-type'] || '');
        if (!ct.includes('json')) {
          COUNTERS.errors_4xx += 1;
          return openAIError(res, 415, `unsupported media type '${ct || 'none'}'; expected application/json`, 'invalid_request_error', 'unsupported_media_type');
        }
        try { json = JSON.parse(text); } catch {
          COUNTERS.errors_4xx += 1;
          return openAIError(res, 400, 'request body is not valid JSON', 'invalid_request_error', 'json_parse_error');
        }
      }

      if (pathname === '/v1/chat/completions') return handlePostChat(req, res, json);
      if (pathname === '/api/v1/missions/execute') return handlePostMission(req, res, json);
      if (pathname === '/api/v1/skills/synthesize') return handleSynthesizeSkill(req, res, json);
      if (pathname === '/api/v1/memory/store') return handleMemoryStore(req, res, json);
      if (pathname === '/api/v1/memory/query') return handleMemoryQuery(req, res, json);
      const rollback = /^\/api\/v1\/missions\/([^/]+)\/rollback$/.exec(pathname);
      if (rollback) {
        const auth = authenticate(req, 'missions:execute');
        if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
        const m = missionRecord(rollback[1]);
        if (!m) {
          COUNTERS.errors_4xx += 1;
          return send(res, 404, { success: false, error: 'Mission not found' });
        }
        const txn = shortId('txn');
        m.status = 'FAILED';
        m.updated_at = Date.now();
        m.events.push({ stage: 'LEDGER', type: 'rollback_initiated', at: Date.now(), txn_id: txn });
        return send(res, 200, { success: true, data: { rolled_back: true, txn_id: txn, mission_id: m.id } });
      }
      const approve = /^\/api\/v1\/approvals\/([^/]+)\/(approve|reject)$/.exec(pathname);
      if (approve) {
        const auth = authenticate(req);
        if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
        const entry = APPROVALS.get(approve[1]);
        if (!entry) return send(res, 404, { success: false, error: 'Approval not found' });
        entry.status = approve[2] === 'approve' ? 'approved' : 'rejected';
        const m = MISSIONS.get(entry.mission_id);
        if (m) m.approval_status = entry.status;
        return send(res, 200, { success: true, data: { approval_id: entry.approval_id, status: entry.status } });
      }
      COUNTERS.errors_4xx += 1;
      return framework404(res, req);
    })().catch((err) => {
      COUNTERS.errors_5xx += 1;
      if (!res.headersSent) send(res, 500, { error: { message: String(err.message), type: 'server_error', param: null, code: null } });
      void err;
    });
    return;
  }

  // GET routes with a path parameter
  if (method === 'GET') {
    const byId = /^\/api\/v1\/missions\/([^/]+)$/.exec(pathname);
    if (byId) {
      const auth = authenticate(req);
      if (!auth.ok) return openAIError(res, auth.status, auth.message, 'authentication_error');
      const m = missionRecord(byId[1]);
      if (!m) {
        COUNTERS.errors_4xx += 1;
        return send(res, 404, { success: false, error: 'Mission not found' });
      }
      return send(res, 200, { success: true, data: publicMission(m) });
    }
  }

  const methodExists = Object.keys(ROUTES).some((k) => k.split(' ')[1] === pathname);
  if (methodExists) {
    COUNTERS.errors_4xx += 1;
    return send(res, 405, { error: { message: `method ${method} not allowed for ${pathname}`, type: 'invalid_request_error', param: null, code: 'method_not_allowed' } });
  }
  if (pathname === '/docs' || pathname === '/openapi.json') {
    return framework404(res, req);
  }
  COUNTERS.errors_4xx += 1;
  framework404(res, req);
});

// A deliberately conformant-looking stub used to prove the gate catches fraud.
if (PROFILE === 'stub') {
  ROUTES['GET /health'] = (req, res) => send(res, 200, { status: 'ok' });
  ROUTES['GET /v1/models'] = (req, res) => send(res, 200, { data: [{ id: 'agi-os-cortex' }] });
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock] profile=${PROFILE} listening on http://127.0.0.1:${PORT}`);
  if (PROFILE === 'dead') {
    console.log('[mock] profile=dead — closing immediately so the harness sees an unreachable target');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 50).unref?.();
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 300).unref?.();
  });
}
