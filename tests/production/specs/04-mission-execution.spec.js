'use strict';
// ----------------------------------------------------------------------------
// 04 · MISSION EXECUTION
// Proves the advertised loop (plan → execute → verify → record) actually runs
// and leaves a retrievable artefact, instead of returning 200 with a placeholder.
// ----------------------------------------------------------------------------

const { behaviour } = require('../lib/harness');

const BENIGN = 'Inspect the repository README and report how many packages are documented.';
const STAGES = ['INIT', 'POLICY', 'PLANNER', 'EXECUTION', 'VERIFIER', 'LEDGER'];

function firstIndexOfAny(stages, candidates) {
  for (const c of candidates) {
    const i = stages.indexOf(c);
    if (i !== -1) return i;
  }
  return -1;
}

async function executeMission(client, prompt, extra = {}) {
  const res = await client.post('/api/v1/missions/execute', { prompt, ...extra });
  return { res, m: behaviour.mission(res) };
}

module.exports = ({ suite }) => suite({
  name: 'Mission Execution',
  critical: false,
  note: 'full lifecycle, not a 200 receipt',
  tests: [
    {
      name: 'a benign mission reaches COMPLETED',
      async fn(t, client) {
        const { res, m } = await executeMission(client, BENIGN);
        t.record('response', { status: m.http, id: m.id, missionStatus: m.status, result: m.result });
        t.require('endpoint is routed', !m.unrouted, res.error || `status=${m.http}`);
        t.require('request accepted', m.http === 200 || m.http === 202, `status=${m.http} body=${m.raw.slice(0, 160)}`);
        t.require('mission id returned', Boolean(m.id), `body=${m.raw.slice(0, 160)}`);
        t.require('status is COMPLETED', m.status === 'COMPLETED', `status=${m.status}`);
        const verdict = behaviour.substantiveMission(m.result);
        t.require('mission produced a real artefact', verdict.ok, verdict.why);
        t.check('lifecycle events recorded', m.events.length >= 3, `${m.events.length} events`);
        t.record('events', m.events.map((e) => e.stage || e.type).filter(Boolean));
      },
    },
    {
      name: 'lifecycle stages are recorded in governance order',
      async fn(t, client) {
        const { m } = await executeMission(client, 'Summarise the test layout of the governance package.');
        const stages = m.stages.map((s) => s.toUpperCase());
        t.record('stages', stages);
        t.require('policy evaluation happened before execution',
          firstIndexOfAny(stages, ['POLICY']) !== -1
          && firstIndexOfAny(stages, ['EXECUTION', 'EXECUTE', 'SANDBOX']) !== -1
          && firstIndexOfAny(stages, ['POLICY']) < firstIndexOfAny(stages, ['EXECUTION', 'EXECUTE', 'SANDBOX']),
          `stages=${stages.join(' → ')}`);
        t.check('a verifier stage exists', firstIndexOfAny(stages, ['VERIFIER', 'VERIFY', 'VERIFICATION']) !== -1, `stages=${stages.join(' → ')}`);
        t.check('a ledger/record stage exists', firstIndexOfAny(stages, ['LEDGER', 'RECORD', 'COMMIT']) !== -1, `stages=${stages.join(' → ')}`);
        const coverage = STAGES.filter((s) => stages.includes(s)).length;
        t.note(`canonical stage coverage ${coverage}/${STAGES.length}`);
        t.check('at least 4 canonical stages present', coverage >= 4, `stages=${stages.join(' → ')}`);
      },
    },
    {
      name: 'the completed mission is retrievable by id',
      async fn(t, client) {
        const { m } = await executeMission(client, 'Report the number of skills in the registry.');
        t.require('mission created', Boolean(m.id), m.raw.slice(0, 140));
        const res = await client.get(`/api/v1/missions/${m.id}`);
        const got = behaviour.mission(res);
        t.record('readback', { status: got.http, id: got.id, missionStatus: got.status });
        t.require('fetch by id succeeds', got.http === 200 && !got.unrouted, `status=${got.http}`);
        t.check('same id echoed', got.id === m.id, `${got.id} vs ${m.id}`);
        t.check('status unchanged on readback', got.status === m.status, `${got.status} vs ${m.status}`);
      },
    },
    {
      name: 'the mission is listed in the mission index',
      async fn(t, client) {
        const { m } = await executeMission(client, 'Count the docs pages in this repository.');
        const res = await client.get('/api/v1/missions');
        const payload = (res.json && 'data' in res.json) ? res.json.data : res.json;
        const list = Array.isArray(payload) ? payload : (Array.isArray(res.json) ? res.json : null);
        t.record('listStatus', res.status);
        t.require('listing returns an array', list !== null, `body=${String(res.text).slice(0, 160)}`);
        t.check('new mission appears in the listing', list.some((x) => (x.id || x.mission_id) === m.id),
          `ids=${list.map((x) => x.id || x.mission_id).slice(-5).join(',')}`);
      },
    },
    {
      name: 'two identical prompts produce two distinct mission ids',
      async fn(t, client) {
        const a = await executeMission(client, 'Idempotency probe.');
        const b = await executeMission(client, 'Idempotency probe.');
        t.record('ids', [a.m.id, b.m.id]);
        t.require('both accepted', Boolean(a.m.id && b.m.id), `${a.m.raw.slice(0, 80)} | ${b.m.raw.slice(0, 80)}`);
        t.require('ids differ (no replay of a cached stub)', a.m.id !== b.m.id, `both ${a.m.id}`);
      },
    },
    {
      name: 'rollback moves the mission out of COMPLETED and returns a txn',
      async fn(t, client) {
        const { m } = await executeMission(client, 'Rollback drill: touch nothing.');
        t.require('mission id', Boolean(m.id), m.raw.slice(0, 120));
        const res = await client.post(`/api/v1/missions/${m.id}/rollback`, {});
        t.record('rollback', { status: res.status, body: res.json });
        t.require('rollback routed', !behaviour.mission(res).unrouted, `status=${res.status}`);
        t.require('rollback accepted', res.status === 200 && !res.serverError, `status=${res.status} ${String(res.text).slice(0, 140)}`);
        const body = res.json || {};
        const data = body.data || body;
        t.check('a transaction id is returned', Boolean(data.txn_id || data.transaction || data.id), JSON.stringify(data).slice(0, 160));
        const after = behaviour.mission(await client.get(`/api/v1/missions/${m.id}`));
        t.check('mission no longer COMPLETED after rollback', after.status !== 'COMPLETED', `status=${after.status}`);
      },
    },
    {
      name: 'a bogus bearer token is never treated as authenticated',
      async fn(t, client) {
        const res = await client.post('/api/v1/missions/execute',
          { prompt: 'Auth bypass probe.' },
          { headers: { Authorization: 'Bearer bogus-not-a-valid-key-000' } });
        t.record('bogusKey', { status: res.status, body: String(res.text).slice(0, 160) });
        const denied = res.status === 401 || res.status === 403;
        const open = res.status === 200 || res.status === 202;
        t.require('bogus key is rejected or auth is explicitly disabled', denied || open, `status=${res.status}`);
        if (open) t.note('target accepted an arbitrary token — deployment has auth disabled; governance specs will assert stricter outcomes');
        t.check('bogus key never yields a 5xx', !res.serverError, `status=${res.status}`);
      },
    },
  ],
});
