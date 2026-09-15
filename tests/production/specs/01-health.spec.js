'use strict';
// ----------------------------------------------------------------------------
// 01 · HEALTH — critical
// The whole certification is worthless if the target is down, so this suite
// decides whether the remaining suites run at all.
// ----------------------------------------------------------------------------

module.exports = ({ suite }) => suite({
  name: 'Health',
  critical: true,
  note: 'liveness + truthfulness of /health',
  tests: [
    {
      name: 'GET /health returns 200',
      async fn(t, client) {
        const res = await client.get('/health');
        t.record('request', { method: 'GET', path: '/health' });
        t.record('response', { status: res.status, body: res.truncated ? '<oversized>' : res.json || res.text, ms: res.durationMs, attempts: res.attempts });
        t.require('transport succeeded', !res.error, res.error);
        t.require('status is 200', res.status === 200, `got ${res.status}`);
        t.require('body is JSON', res.json !== null && res.json !== undefined, `content-type=${res.contentType || res.headers['content-type']}`);
        const b = res.json || {};
        const healthy = b.status === 'ok' || b.status === 'healthy' || b.status === 'up'
          || b.ok === true || b.success === true || b.healthy === true;
        t.require('payload asserts health (not just a 200)', healthy, JSON.stringify(b).slice(0, 200));
      },
    },
    {
      name: 'health payload identifies build (version/system)',
      async fn(t, client) {
        const res = await client.get('/health');
        const b = res.json || {};
        t.record('identity', { version: b.version || b.build || null, system: b.system || b.name || null });
        t.check('exposes a version string', Boolean(b.version || b.build), JSON.stringify(b).slice(0, 160));
        t.check('exposes the system name', Boolean(b.system || b.name), 'no "system"/"name" field');
        t.check('response served in < 3s', res.durationMs < 3000, `${res.durationMs}ms`);
      },
    },
    {
      name: 'readiness agrees with liveness',
      async fn(t, client) {
        const res = await client.get('/ready');
        t.record('ready', { status: res.status, body: res.json || res.text });
        if (res.status === 404) {
          t.note('/ready not routed — accepted, but /health is the only gate');
          t.check('endpoint exists or is explicitly absent', true, '404 tolerated');
          return;
        }
        t.require('status is 200', res.status === 200, `got ${res.status}`);
        const b = res.json || {};
        const ready = b.ready === true || b.status === 'ready' || b.success === true || b.status === 'ok';
        t.require('readiness asserts ready', ready, JSON.stringify(b).slice(0, 200));
      },
    },
    {
      name: 'five sequential probes are stable (no cold-start collapse)',
      async fn(t, client) {
        const samples = [];
        for (let i = 0; i < 5; i += 1) {
          const res = await client.get('/health');
          samples.push({ attempt: i + 1, status: res.status, ms: res.durationMs, error: res.error });
          t.check(`probe ${i + 1} returned 200`, res.status === 200, res.error || `status=${res.status}`);
        }
        t.record('samples', samples);
        const worst = Math.max(...samples.map((s) => s.ms));
        t.check('worst latency < 5s', worst < 5000, `${worst}ms`);
      },
    },
    {
      name: 'GET / serves an entry point (UI or API index)',
      async fn(t, client) {
        const res = await client.get('/');
        t.record('root', { status: res.status, contentType: res.contentType, bytes: (res.text || '').length });
        t.require('transport succeeded', !res.error, res.error);
        t.check('status < 400', res.status > 0 && res.status < 400, `got ${res.status}`);
        const looksServed = /<html|<!doctype/i.test(res.text) || res.json !== null;
        t.check('serves HTML or JSON (not an empty body)', looksServed, truncateBody(res.text));
      },
    },
  ],
});

function truncateBody(text) {
  const s = String(text || '');
  return s.length > 120 ? `${s.slice(0, 120)}…` : s || '<empty body>';
}
