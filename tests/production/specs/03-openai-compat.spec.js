'use strict';
// ----------------------------------------------------------------------------
// 03 · OPENAI COMPATIBILITY — critical
// Conformance levels as advertised in the README ("drop-in replacement, L0-L4"):
//   L0 discovery · L1 chat · L2 streaming · L3 tools/structured output · L4 errors
// A 200 with a non-conforming body is a FAIL here — the whole point is that an
// OpenAI SDK client must not have to special-case AGI-OS.
// ----------------------------------------------------------------------------

const { behaviour } = require('../lib/harness');

module.exports = ({ suite }) => suite({
  name: 'OpenAI Compatibility',
  critical: true,
  note: 'L0-L4 conformance of /v1/*',
  tests: [
    {
      name: 'L0 · GET /v1/models returns an OpenAI model list',
      async fn(t, client) {
        const res = await client.get('/v1/models');
        t.record('response', { status: res.status, body: res.json });
        t.require('status 200', res.status === 200, res.error || `status=${res.status}`);
        const body = res.json;
        t.require('body is JSON', body !== null, `ct=${res.contentType}`);
        t.check('object === "list"', body?.object === 'list', `object=${JSON.stringify(body?.object)}`);
        t.require('data is a non-empty array', Array.isArray(body?.data) && body.data.length > 0, JSON.stringify(body?.data || null));
        const first = body.data[0];
        t.check('entry has id', typeof first?.id === 'string' && first.id.length > 0, JSON.stringify(first));
        t.check('entry has object === "model"', first?.object === 'model', `object=${JSON.stringify(first?.object)}`);
        t.check('entry has owned_by', typeof first?.owned_by === 'string', 'owned_by missing');
        t.note(`model under test: ${first.id}`);
        t.record('modelUnderTest', first.id);
      },
    },
    {
      name: 'L1 · POST /v1/chat/completions returns a full chat.completion',
      async fn(t, client) {
        const res = await client.post('/v1/chat/completions', {
          model: 'agi-os-cortex',
          messages: [{ role: 'user', content: 'Summarise what a governance gate does in one sentence.' }],
          stream: false,
        });
        t.record('response', { status: res.status, body: res.json, ms: res.durationMs });
        t.require('status 200', res.status === 200, res.error || `status=${res.status} body=${String(res.text).slice(0, 160)}`);
        const verdict = behaviour.isOpenAICompletion(res.json);
        t.require('OpenAI response shape', verdict.ok, verdict.why);
        const content = res.json?.choices?.[0]?.message?.content;
        const substantive = behaviour.substantive(content);
        t.require('content is substantive (not a stub)', substantive.ok, substantive.why);
        t.check('usage token counts are numeric',
          Number.isFinite(res.json?.usage?.prompt_tokens) && Number.isFinite(res.json?.usage?.completion_tokens),
          JSON.stringify(res.json?.usage));
        t.record('contentExcerpt', String(content).slice(0, 180));
      },
    },
    {
      name: 'L1 · distinct prompts must not return identical canned text',
      async fn(t, client) {
        const prompts = [
          'Explain the rollback ledger in one sentence.',
          'What is the default policy for writes outside the workspace?',
        ];
        const out = [];
        for (const p of prompts) {
          const res = await client.post('/v1/chat/completions', { model: 'agi-os-cortex', messages: [{ role: 'user', content: p }] });
          out.push(String(res.json?.choices?.[0]?.message?.content ?? `<http ${res.status}>`));
        }
        t.record('answers', out.map((s) => s.slice(0, 140)));
        t.require('server responded twice', out.every((s) => !s.startsWith('<http')), out.join(' | '));
        t.require('answers differ (no single canned reply)', out[0].trim() !== out[1].trim(),
          `both said: ${out[0].slice(0, 80)}`);
      },
    },
    {
      name: 'L2 · streaming returns parseable SSE ending in [DONE]',
      async fn(t, client) {
        const res = await client.postStream('/v1/chat/completions', {
          model: 'agi-os-cortex',
          messages: [{ role: 'user', content: 'Stream a two-sentence status of the kernel.' }],
          stream: true,
        });
        t.record('stream', { status: res.status, events: res.events.length, error: res.error });
        t.require('status 200', res.status === 200, res.error || `status=${res.status}`);
        t.check('content-type is text/event-stream', String(res.headers['content-type'] || '').includes('text/event-stream'), res.headers['content-type']);
        t.require('at least two SSE events', res.events.length >= 2, `${res.events.length} events`);
        t.require('stream terminated with [DONE]', res.done === true, 'no data: [DONE] sentinel');
        const bad = res.events.findIndex((e) => e.__unparsed !== undefined);
        t.require('every event is valid JSON', bad === -1, bad >= 0 ? `event ${bad}: ${JSON.stringify(res.events[bad]).slice(0, 120)}` : '');
        const deltas = res.events.map((e) => e?.choices?.[0]?.delta);
        t.require('events carry choices[].delta', deltas.every((d) => d && typeof d === 'object'), 'missing delta object');
        const joined = deltas.map((d) => (typeof d?.content === 'string' ? d.content : '')).join('').trim();
        const v = behaviour.substantive(joined, 12);
        t.require('streamed content reassembles into an answer', v.ok, v.why);
        t.record('reassembled', joined.slice(0, 200));
      },
    },
    {
      name: 'L3 · tools + tool_choice are honoured as a tool_call',
      async fn(t, client) {
        const res = await client.post('/v1/chat/completions', {
          model: 'agi-os-cortex',
          messages: [{ role: 'user', content: 'List the files in /tmp please' }],
          tools: [{
            type: 'function',
            function: {
              name: 'execute_mission',
              description: 'Execute a mission via AGI-OS',
              parameters: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
            },
          }],
          tool_choice: 'required',
        });
        t.record('response', { status: res.status, body: res.json });
        t.require('status 200', res.status === 200, res.error || `status=${res.status}`);
        const choice = res.json?.choices?.[0];
        const call = choice?.message?.tool_calls?.[0];
        t.require('tool_calls array present', Array.isArray(choice?.message?.tool_calls) && choice.message.tool_calls.length > 0,
          `message keys=${Object.keys(choice?.message || {}).join(',')}`);
        t.check('tool call names the requested function', call?.function?.name === 'execute_mission', `name=${call?.function?.name}`);
        t.check('arguments are JSON-serialisable', typeof call?.function?.arguments === 'string' && (() => {
          try { JSON.parse(call.function.arguments); return true; } catch { return false; }
        })(), `arguments=${String(call?.function?.arguments).slice(0, 80)}`);
        t.check('finish_reason is tool_calls', choice?.finish_reason === 'tool_calls', `finish_reason=${choice?.finish_reason}`);
      },
    },
    {
      name: 'L3 · response_format=json_object yields valid JSON content',
      async fn(t, client) {
        const res = await client.post('/v1/chat/completions', {
          model: 'agi-os-cortex',
          messages: [{ role: 'user', content: 'Return the governance summary as JSON with keys level and status.' }],
          response_format: { type: 'json_object' },
        });
        t.record('response', { status: res.status, body: res.json });
        t.require('status 200', res.status === 200, res.error || `status=${res.status}`);
        const content = res.json?.choices?.[0]?.message?.content;
        t.require('content is a string', typeof content === 'string', `type=${typeof content}`);
        let parsed = null;
        try { parsed = JSON.parse(content); } catch (err) { t.fail(`content is not JSON: ${err.message} — ${String(content).slice(0, 120)}`); }
        t.check('parsed JSON is an object', parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed), String(content).slice(0, 120));
      },
    },
    {
      name: 'L4 · unknown model is a 4xx, not a 500 and not a silent 200',
      async fn(t, client) {
        const res = await client.post('/v1/chat/completions', {
          model: 'gpt-9-turbo-does-not-exist',
          messages: [{ role: 'user', content: 'hello' }],
        });
        t.record('response', { status: res.status, body: res.json || String(res.text).slice(0, 200) });
        t.require('server did not fall over', res.status !== 0 && !res.serverError, res.error || `status=${res.status}`);
        t.require('status is 4xx', res.clientError, `got ${res.status}`);
        const shape = behaviour.isOpenAIErrorShape(res.json);
        t.check('OpenAI error envelope', shape.ok, shape.why);
      },
    },
    {
      name: 'L4 · malformed request bodies answer 4xx with an error envelope',
      async fn(t, client) {
        const cases = [
          ['messages missing', { model: 'agi-os-cortex' }],
          ['messages empty array', { model: 'agi-os-cortex', messages: [] }],
          ['content not a string', { model: 'agi-os-cortex', messages: [{ role: 'user', content: 42 }] }],
          ['max_tokens zero', { model: 'agi-os-cortex', messages: [{ role: 'user', content: 'hi' }], max_tokens: 0 }],
        ];
        for (const [label, body] of cases) {
          const res = await client.post('/v1/chat/completions', body);
          const handled = res.clientError || (res.ok && res.json && res.json.success === false);
          t.require(`${label} → 4xx`, handled, `got ${res.status}: ${String(res.text).slice(0, 120)}`);
          t.check(`${label} → no 5xx`, !res.serverError, `status=${res.status}`);
        }
      },
    },
    {
      name: 'L4 · error responses never leak internal configuration',
      async fn(t, client) {
        const res = await client.post('/v1/chat/completions', { model: 'agi-os-cortex' });
        const text = `${res.text}`;
        t.record('errorBody', text.slice(0, 200));
        t.check('no stack trace in body', !/at\s+\w+\s+\(.*:\d+:\d+\)|Traceback \(most recent/.test(text), text.slice(0, 140));
        t.check('no absolute server paths', !/\/(?:home|Users|var|app)\/[A-Za-z0-9_.\-]+\//.test(text), text.slice(0, 140));
        const leak = behaviour.leaksSecret(text);
        t.check('no credential-looking material', !leak, 'secret-shaped substring in error body');
      },
    },
  ],
});
