import { createServer, IncomingMessage, ServerResponse } from 'http';
import { APIGateway } from './Server.js';
import { randomBytes } from 'crypto';

// ═══════════════════════════════════════════════════════
// OAuth Configuration
// ═══════════════════════════════════════════════════════

const OAUTH_CONFIG: Record<string, {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  capabilities: string[];
}> = {
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['repo', 'workflow', 'read:org'],
    clientId: process.env.GITHUB_CLIENT_ID || '',
    capabilities: ['git_commit', 'create_pull_request', 'manage_issues', 'trigger_workflow'],
  },
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/calendar'],
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    capabilities: ['drive_sync', 'doc_read', 'calendar_query', 'web_search'],
  },
};

const TOKEN_STORE = new Map<string, { accessToken: string; refreshToken?: string; connectedAt: number; provider: string }>();
const INTEGRATION_STATUS = new Map<string, { status: string; connectedAt?: number; capabilities?: string[] }>();
const OAUTH_STATES = new Set<string>();

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function sendSSE(res: ServerResponse, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendHTML(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
  res.end(html);
}

function extractApiKey(req: IncomingMessage): string | undefined {
  const auth = req.headers['authorization'];
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

async function handleRequest(gateway: APIGateway, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const method = req.method || 'GET';
  const apiKey = extractApiKey(req);

  // CORS
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  try {
    // ── OpenAI Compatible: /v1/chat/completions ──
    if (path === '/v1/chat/completions' && method === 'POST') {
      const body = await parseBody(req);
      const result = await gateway.handleChatCompletions(body, apiKey);
      if (!result.success) {
        sendJSON(res, result.error?.includes('API key') ? 401 : result.error?.includes('Permission') ? 403 : result.error?.includes('Rate limit') ? 429 : 400, { error: { message: result.error, type: 'invalid_request_error', param: null, code: null } });
        return;
      }
      const data = result.data as any;
      if (body.stream) {
        const chunks = data._stream_chunks || [];
        delete data._stream_chunks;
        delete data.stream;
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        sendSSE(res, { ...data, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] });
        for (let i = 1; i < chunks.length; i++) {
          sendSSE(res, { ...data, choices: chunks[i].choices });
        }
        sendSSE(res, { ...data, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      sendJSON(res, 200, data);
      return;
    }

    // ── OpenAI Compatible: /v1/models ──
    if (path === '/v1/models' && method === 'GET') {
      const models = gateway.listOpenAIModels();
      sendJSON(res, 200, models);
      return;
    }

    // ── Health ──
    if (path === '/health' && method === 'GET') {
      sendJSON(res, 200, gateway.health());
      return;
    }

    // ── Metrics ──
    if (path === '/metrics' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(gateway.getMetrics());
      return;
    }

    // ── Readiness ──
    if (path === '/ready' && method === 'GET') {
      sendJSON(res, 200, gateway.getReadiness());
      return;
    }

    // ── Self Model ──
    if (path === '/api/v1/self-model' && method === 'GET') {
      sendJSON(res, 200, gateway.getSelfModel(apiKey));
      return;
    }

    // ── Skills ──
    if (path === '/api/v1/skills' && method === 'GET') {
      sendJSON(res, 200, gateway.listSkills(apiKey));
      return;
    }

    if (path === '/api/v1/skills/synthesize' && method === 'POST') {
      const body = await parseBody(req);
      sendJSON(res, 200, gateway.synthesizeSkill(body, apiKey));
      return;
    }

    // ── Missions ──
    if (path === '/api/v1/missions/execute' && method === 'POST') {
      const body = await parseBody(req);
      const result = await gateway.executeMission(body.prompt, body.context || {}, apiKey);
      if (!result.success) {
        sendJSON(res, 400, { error: { message: result.error, type: 'invalid_request_error', param: null, code: null } });
        return;
      }
      sendJSON(res, 200, result);
      return;
    }

    if (path === '/api/v1/missions' && method === 'GET') {
      sendJSON(res, 200, gateway.listMissions(apiKey));
      return;
    }

    if (path.match(/^\/api\/v1\/missions\/[^/]+$/) && method === 'GET') {
      const id = path.split('/').pop()!;
      sendJSON(res, 200, gateway.getMission(id, apiKey));
      return;
    }

    if (path.match(/^\/api\/v1\/missions\/[^/]+\/rollback$/) && method === 'POST') {
      const id = path.split('/')[4];
      sendJSON(res, 200, gateway.rollbackMission(id, apiKey));
      return;
    }

    // ── Memory ──
    if (path === '/api/v1/memory/query' && method === 'POST') {
      const body = await parseBody(req);
      sendJSON(res, 200, gateway.queryMemory(body.query, apiKey));
      return;
    }

    if (path === '/api/v1/memory/store' && method === 'POST') {
      const body = await parseBody(req);
      sendJSON(res, 200, gateway.storeMemory(body.key, body.value, apiKey));
      return;
    }

    // ── Approvals ──
    if (path === '/api/v1/approvals' && method === 'GET') {
      sendJSON(res, 200, { success: true, data: gateway.getPendingApprovals() });
      return;
    }

    // ── OAuth: Initiate ──
    if (path.match(/^\/api\/auth\/(github|google)$/) && method === 'GET') {
      const provider = path.split('/').pop()!;
      const config = OAUTH_CONFIG[provider];
      if (!config || !config.clientId) {
        sendHTML(res, 200, `<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0f;color:#ef4444"><h2>OAuth not configured</h2><p>Set GITHUB_CLIENT_ID or GOOGLE_CLIENT_ID environment variable.</p></body></html>`);
        return;
      }
      const state = randomBytes(16).toString('hex');
      OAUTH_STATES.add(state);
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: `${process.env.BASE_URL || `http://${req.headers.host || 'localhost:7860'}`}/api/auth/callback`,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state: `${provider}_${state}`,
      });
      res.writeHead(302, { Location: `${config.authUrl}?${params.toString()}` });
      res.end();
      return;
    }

    // ── OAuth: Callback ──
    if (path === '/api/auth/callback' && method === 'GET') {
      const urlParams = new URL(req.url || '/', `http://${req.headers.host}`).searchParams;
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const providerId = state?.split('_')[0] || '';

      if (!code || !state || !OAUTH_STATES.has(state.replace(`${providerId}_`, ''))) {
        sendHTML(res, 200, `<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0f;color:#ef4444"><h2>Invalid OAuth state</h2></body></html>`);
        return;
      }
      OAUTH_STATES.delete(state.replace(`${providerId}_`, ''));

      const config = OAUTH_CONFIG[providerId];
      if (!config) {
        sendHTML(res, 200, `<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0f;color:#ef4444"><h2>Unknown provider</h2></body></html>`);
        return;
      }

      try {
        const tokenRes = await fetch(config.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            client_id: config.clientId,
            client_secret: process.env[`${providerId.toUpperCase()}_CLIENT_SECRET`] || '',
            code,
            redirect_uri: `${process.env.BASE_URL || `http://${req.headers.host}`}/api/auth/callback`,
            grant_type: 'authorization_code',
          }),
        });
        const tokenData = await tokenRes.json() as Record<string, string>;

        if (tokenData.access_token) {
          TOKEN_STORE.set(providerId, {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            connectedAt: Date.now(),
            provider: providerId,
          });
          INTEGRATION_STATUS.set(providerId, {
            status: 'connected',
            connectedAt: Date.now(),
            capabilities: config.capabilities,
          });

          sendHTML(res, 200, `<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0f;color:#10b981"><h2>✅ ${providerId.charAt(0).toUpperCase() + providerId.slice(1)} Connected</h2><p style="color:#94a3b8">This window will close automatically.</p><script>setTimeout(() => window.close(), 1500);</script></body></html>`);
        } else {
          sendHTML(res, 200, `<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0f;color:#ef4444"><h2>Token exchange failed</h2><pre>${JSON.stringify(tokenData, null, 2)}</pre></body></html>`);
        }
      } catch (err: any) {
        sendHTML(res, 200, `<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0f;color:#ef4444"><h2>OAuth Error</h2><p>${err.message}</p></body></html>`);
      }
      return;
    }

    // ── Integrations: Status ──
    if (path === '/api/integrations/status' && method === 'GET') {
      const accounts = Array.from(INTEGRATION_STATUS.entries()).map(([id, data]) => ({ id, ...data }));
      sendJSON(res, 200, { accounts });
      return;
    }

    // ── 404 ──
    sendJSON(res, 404, { error: { message: `Not found: ${path}`, type: 'invalid_request_error', param: null, code: null } });

  } catch (err: any) {
    sendJSON(res, 500, { error: { message: err.message || 'Internal error', type: 'server_error', param: null, code: null } });
  }
}

// ═══════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════

const PORT = parseInt(process.env.AGI_PORT || '4000', 10);
const HOST = process.env.AGI_HOST || '0.0.0.0';

const gateway = new APIGateway({
  port: PORT,
  host: HOST,
  apiKeyRequired: true,
  rateLimitPerMinute: parseInt(process.env.AGI_RATE_LIMIT || '120', 10),
  defaultBudgetUsd: parseFloat(process.env.AGI_BUDGET_USD || '100'),
  defaultBudgetTokens: parseInt(process.env.AGI_BUDGET_TOKENS || '1000000', 10),
  registryPath: process.env.AGI_SKILLS_PATH || undefined,
});

const server = createServer(async (req, res) => {
  await handleRequest(gateway, req, res);
});

server.listen(PORT, HOST, () => {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  AGI-OS API Gateway v1.34.0`);
  console.log(`  Listening on http://${HOST}:${PORT}`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Endpoints:');
  console.log('    POST /v1/chat/completions    (OpenAI Compatible)');
  console.log('    GET  /v1/models              (Model Listing)');
  console.log('    POST /api/v1/missions/execute');
  console.log('    GET  /api/v1/missions');
  console.log('    GET  /api/v1/skills');
  console.log('    POST /api/v1/memory/store');
  console.log('    POST /api/v1/memory/query');
  console.log('    GET  /api/v1/self-model');
  console.log('    GET  /health');
  console.log('    GET  /metrics');
  console.log('    GET  /ready');
  console.log('═══════════════════════════════════════════════════════════════');
});

export { gateway, server };
