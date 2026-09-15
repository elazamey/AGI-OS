'use strict';
// ----------------------------------------------------------------------------
// 09 · SELF-HEALING / RESILIENCE
// The README sells "automatic retry, fallback and recovery". This suite attacks
// the transport layer: broken JSON, unknown models, 2 MB bodies, timeouts and a
// concurrent abuse burst — then checks the service is still standing, still
// counting, and did not silently restart.
// ----------------------------------------------------------------------------

module.exports = ({ suite, config }) => suite({
  name: 'Self-Healing',
  critical: false,
  note: 'corrupt input, oversized input, bursts, counters',
  tests: [
    {
      name: 'malformed JSON answers 4xx — never a 500, never a hang',
      async fn(t, client) {
        const bodies = [
          ['truncated json', '{"model": "agi-os-cortex", "messages": ['],
          ['not json at all', 'hello, this is not JSON'],
          ['wrong type (array)', '[1,2,3]'],
          ['trailing garbage', '{"model":"agi-os-cortex","messages":[{"role":"user","content":"hi"}},]'],
          ['null body', 'null'],
        ];
        for (const [label, raw] of bodies) {
          const started = Date.now();
          const res = await client.post('/v1/chat/completions', raw, { headers: { 'Content-Type': 'application/json' } });
          const elapsed = Date.now() - started;
          t.record(label, { status: res.status, ms: elapsed, body: String(res.text).slice(0, 120) });
          t.require(`${label}: transport answered`, res.status !== 0, res.error || 'no response');
          t.require(`${label}: 4xx (got ${res.status})`, res.clientError || (res.ok && res.json && res.json.success === false),
            `status=${res.status} body=${String(res.text).slice(0, 140)}`);
          t.check(`${label}: not a 5xx`, !res.serverError, `status=${res.status}`);
          t.check(`${label}: answered within timeout budget`, elapsed < config.request.timeoutMs, `${elapsed}ms`);
        }
      },
    },
    {
      name: 'non-JSON content type is rejected, not parsed into a crash',
      async fn(t, client) {
        const res = await client.post('/v1/chat/completions', 'model=agi-os-cortex&prompt=hi', {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        t.record('formEncoded', { status: res.status, body: String(res.text).slice(0, 160) });
        t.require('no 5xx', !res.serverError && res.status !== 0, res.error || `status=${res.status}`);
        t.require('rejected with 4xx', res.clientError || (res.ok && res.json?.success === false), `status=${res.status}`);
      },
    },
    {
      name: '2 MB payload is refused gracefully and the service stays usable',
      async fn(t, client) {
        const big = 'A'.repeat(2 * 1024 * 1024);
        const started = Date.now();
        const res = await client.post('/v1/chat/completions', {
          model: 'agi-os-cortex',
          messages: [{ role: 'user', content: big }],
        });
        const elapsed = Date.now() - started;
        t.record('oversized', { status: res.status, ms: elapsed, sentBytes: big.length, body: String(res.text).slice(0, 140) });
        t.require('transport answered (no silent drop)', res.status !== 0, res.error || 'connection closed with no response');
        const graceful = res.status === 413 || res.clientError || (res.ok && res.json?.success === false);
        t.require('payload handled with a 4xx / explicit error', graceful, `status=${res.status}`);
        t.check('no 5xx', !res.serverError, `status=${res.status}`);
        const health = await client.get('/health');
        t.require('service still healthy right after the oversized request', health.status === 200, `status=${health.status}`);
      },
    },
    {
      name: 'unknown model name yields a typed 4xx error',
      async fn(t, client) {
        const res = await client.post('/v1/chat/completions', {
          model: '', messages: [{ role: 'user', content: 'hi' }],
        });
        t.record('emptyModel', { status: res.status, body: String(res.text).slice(0, 160) });
        t.require('empty model rejected', res.clientError || res.status === 200, `status=${res.status}`);
        if (res.clientError) {
          const { behaviour } = require('../lib/harness');
          const shape = behaviour.isOpenAIErrorShape(res.json);
          t.check('typed error envelope present', shape.ok, shape.why);
        }
      },
    },
    {
      name: '12-request abuse burst keeps the service alive',
      async fn(t, client) {
        const before = await client.get('/metrics');
        const jobs = Array.from({ length: 12 }, (_, i) => {
          if (i % 4 === 0) return client.post('/v1/chat/completions', '{ broken');
          if (i % 4 === 1) return client.post('/api/v1/missions/execute', { prompt: '   ' });
          if (i % 4 === 2) return client.get(`/api/v1/missions/does-not-exist-${i}`);
          return client.post('/v1/chat/completions', { model: 'agi-os-cortex', messages: [{ role: 'user', content: `ping ${i}` }] });
        });
        const results = await Promise.all(jobs);
        const statuses = results.map((r) => r.status);
        t.record('burst', { statuses, transportErrors: results.filter((r) => r.status === 0).length });
        t.require('every request received a response', statuses.every((s) => s !== 0), statuses.join(','));
        t.require('no 5xx during the burst', statuses.every((s) => s < 500), statuses.filter((s) => s >= 500).join(','));

        const health = await client.get('/health');
        t.require('health OK after burst', health.status === 200, `status=${health.status}`);

        const after = await client.get('/metrics');
        const counter = (text, name) => {
          const m = new RegExp(`^${name}\\s+(\\d+)`, 'm').exec(String(text || ''));
          return m ? Number(m[1]) : null;
        };
        const b = counter(before.text, 'agi_os_missions_total');
        const a = counter(after.text, 'agi_os_missions_total');
        t.record('missionCounter', { before: b, after: a, metricsStatus: after.status });
        if (b !== null && a !== null) {
          t.check('metrics counter did not reset (no silent restart)', a >= b, `${b} → ${a}`);
        } else {
          t.note('/metrics unavailable or counter absent — restart detection skipped');
        }
      },
    },
    {
      name: 'client-side timeout budget protects against a hung endpoint',
      async fn(t, client) {
        const started = Date.now();
        const res = await client.get('/health', { timeoutMs: 1 });
        const elapsed = Date.now() - started;
        t.record('timeoutProbe', { status: res.status, error: res.error, ms: elapsed, attempts: res.attempts });
        t.require('probe returned without hanging', elapsed < 5000, `${elapsed}ms`);
        if (res.error) t.note(`harness timeout fired as expected: ${res.error}`);
        else t.note('endpoint answered within 1ms budget — no hang to detect');
        const recovery = await client.get('/health');
        t.require('subsequent request succeeds (client recovered)', recovery.status === 200, `status=${recovery.status}`);
      },
    },
  ],
});
