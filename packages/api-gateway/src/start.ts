import { createServer, IncomingMessage, ServerResponse } from 'http';
import { APIGateway } from './Server.js';

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
  console.log(`  AGI-OS API Gateway v1.25.0`);
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
