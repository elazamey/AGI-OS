// Shared fixture: an HTTP server that can pretend to be a healthy backend, a stub
// that answers with fake content, or a frontend whose backend is dead. Used by the
// verification/gate tests so they exercise real sockets instead of mocked ones.
import http from 'node:http';
import type { AddressInfo } from 'node:net';

export type FixtureProfile = 'conformant' | 'stub' | 'frontend-only' | 'error-page';

export interface Fixture {
  url: string;
  htmlUrl: string;
  close(): Promise<void>;
  requests: Array<{ method: string; url: string }>;
}

const HTML = `<!doctype html><html lang="en"><head><title>AGI-OS</title></head>
<body><div id="root">AGI-OS Workspace</div><script src="/_next/static/chunks/main.js"></script></body></html>`;

export async function startFixture(profile: FixtureProfile): Promise<Fixture> {
  const requests: Array<{ method: string; url: string }> = [];
  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    requests.push({ method: req.method ?? 'GET', url });
    const json = (status: number, body: unknown) => {
      const text = JSON.stringify(body);
      res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) });
      res.end(text);
    };
    if (url === '/' || url.startsWith('/index')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Vercel-Id': 'iad1::fixture-deploy-0001' });
      res.end(HTML);
      return;
    }
    if (profile === 'frontend-only') return json(404, { error: 'no backend bound' });
    if (profile === 'error-page') return json(502, { error: 'upstream unavailable' });
    if (url === '/health') return json(200, profile === 'stub' ? { status: 'ok' } : { status: 'ok', uptime_s: 42, version: '1.26.0', active_missions: 0 });
    if (url === '/ready') return json(200, { ready: true });
    if (url === '/v1/models') return json(200, { object: 'list', data: [{ id: 'agi-os-cortex', object: 'model', owned_by: 'agi-os' }] });
    if (url === '/v1/chat/completions') {
      if (profile === 'stub') return json(200, { id: 'chatcmpl-stub', object: 'chat.completion', model: 'stub', choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] });
      return json(200, {
        id: 'chatcmpl_fixture',
        object: 'chat.completion',
        created: 1,
        model: 'agi-os-cortex',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Governance gates every mission before execution.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
      });
    }
    return json(404, { error: 'not found' });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;
  return {
    url,
    htmlUrl: url,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections?.();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
