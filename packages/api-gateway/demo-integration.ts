import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:4000/v1',
  apiKey: 'agi-os-dev-key-2026',
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string): void {
  if (condition) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ ${msg}`); }
}

async function runIntegrationDemo(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  AGI-OS v1.25.0 — Integration Demo via Official OpenAI SDK');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── TEST 1: L1 — Model Listing & Basic Chat ──
  console.log('🔹 [TEST 1] L1 — Model Listing & Basic Chat Completion');
  try {
    const models = await client.models.list();
    assert(models.data.length > 0, `Models returned: ${models.data.map(m => m.id).join(', ')}`);
    assert(models.data.some(m => m.id === 'agi-os-local'), 'agi-os-local model exists');
    assert(models.data[0].owned_by === 'agi-os', 'owned_by is agi-os');

    const basic = await client.chat.completions.create({
      model: 'agi-os-local',
      messages: [
        { role: 'system', content: 'You are AGI-OS Cognitive Engine.' },
        { role: 'user', content: 'What is the 5-step governance lifecycle?' },
      ],
    });

    assert(basic.object === 'chat.completion', 'object is chat.completion');
    assert(basic.id.startsWith('chatcmpl-'), `id format: ${basic.id}`);
    assert(typeof basic.created === 'number', `created timestamp: ${basic.created}`);
    assert(basic.choices.length === 1, 'one choice returned');
    assert(basic.choices[0].finish_reason === 'stop', 'finish_reason is stop');
    assert(basic.choices[0].message.role === 'assistant', 'role is assistant');
    assert(typeof basic.choices[0].message.content === 'string', 'content is string');
    assert(basic.usage !== undefined, 'usage object present');
    assert(typeof basic.usage!.prompt_tokens === 'number', 'prompt_tokens is number');
    assert(typeof basic.usage!.completion_tokens === 'number', 'completion_tokens is number');
    assert(basic.usage!.total_tokens === basic.usage!.prompt_tokens + basic.usage!.completion_tokens, 'total = prompt + completion');
    console.log(`  📝 Response: ${basic.choices[0].message.content!.substring(0, 80)}...`);
    console.log(`  📊 Usage: ${basic.usage!.prompt_tokens} + ${basic.usage!.completion_tokens} = ${basic.usage!.total_tokens} tokens\n`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ L1 failed: ${err.message}\n`);
  }

  // ── TEST 2: L2 — Streaming (SSE) ──
  console.log('🔹 [TEST 2] L2 — Real-Time Streaming (SSE)');
  try {
    const stream = await client.chat.completions.create({
      model: 'agi-os-local',
      messages: [{ role: 'user', content: 'Write a simple JavaScript UUID generator.' }],
      stream: true,
    });

    let chunkCount = 0;
    let fullContent = '';
    process.stdout.write('  ⚡ Stream: ');
    for await (const chunk of stream) {
      chunkCount++;
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) { process.stdout.write(content); fullContent += content; }
    }
    console.log('');
    assert(chunkCount > 0, `Received ${chunkCount} chunks`);
    assert(fullContent.length > 0, `Stream content length: ${fullContent.length}`);
    console.log('');
  } catch (err: any) {
    failed++;
    console.log(`  ❌ L2 failed: ${err.message}\n`);
  }

  // ── TEST 3: L3 — Tool Calling ──
  console.log('🔹 [TEST 3] L3 — Tool Calling / Function Calling');
  try {
    const toolResponse = await client.chat.completions.create({
      model: 'agi-os-local',
      messages: [
        { role: 'user', content: 'Scan axios for vulnerabilities.' },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'auto_patcher_and_audit',
            description: 'Scans package dependencies for vulnerabilities and applies fixes.',
            parameters: {
              type: 'object',
              properties: {
                packageName: { type: 'string', description: 'Package name to scan' },
              },
              required: ['packageName'],
            },
          },
        },
      ],
      tool_choice: 'auto',
    });

    const choice = toolResponse.choices[0];
    assert(choice.finish_reason === 'tool_calls', `finish_reason: ${choice.finish_reason}`);
    assert(choice.message.tool_calls !== undefined, 'tool_calls present in message');
    assert(choice.message.tool_calls!.length > 0, `tool_calls count: ${choice.message.tool_calls!.length}`);

    const toolCall = choice.message.tool_calls![0];
    assert(toolCall.type === 'function', `tool_call type: ${toolCall.type}`);
    assert(toolCall.function.name === 'auto_patcher_and_audit', `function name: ${toolCall.function.name}`);
    assert(toolCall.id.startsWith('call_'), `call id format: ${toolCall.id}`);

    const args = JSON.parse(toolCall.function.arguments);
    assert(args !== undefined, `arguments parsed: ${JSON.stringify(args)}`);
    console.log(`  📦 Tool: ${toolCall.function.name}(${toolCall.function.arguments})\n`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ L3 failed: ${err.message}\n`);
  }

  // ── TEST 4: L4 — Structured Output ──
  console.log('🔹 [TEST 4] L4 — Structured JSON Output');
  try {
    const jsonResponse = await client.chat.completions.create({
      model: 'agi-os-local',
      messages: [
        {
          role: 'user',
          content: 'Return mission details as JSON with status, phase, and riskLevel fields.',
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = jsonResponse.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);
    assert(typeof parsed === 'object', 'response is valid JSON object');
    assert(parsed.result !== undefined, 'result field present');
    console.log(`  📋 Parsed JSON: ${JSON.stringify(parsed).substring(0, 100)}...\n`);
  } catch (err: any) {
    failed++;
    console.log(`  ❌ L4 failed: ${err.message}\n`);
  }

  // ── TEST 5: Auth — Invalid Key ──
  console.log('🔹 [TEST 5] Auth — Invalid API Key Rejection');
  try {
    const badClient = new OpenAI({
      baseURL: 'http://localhost:4000/v1',
      apiKey: 'sk-invalid-key',
    });
    await badClient.chat.completions.create({
      model: 'agi-os-local',
      messages: [{ role: 'user', content: 'test' }],
    });
    failed++;
    console.log('  ❌ Should have thrown error\n');
  } catch (err: any) {
    assert(err.status === 401 || err.message.includes('Invalid'), `Rejected with: ${err.message}\n`);
  }

  // ── SUMMARY ──
  console.log('═══════════════════════════════════════════════════════════════');
  if (failed === 0) {
    console.log('  🎉 ALL INTEGRATION TESTS PASSED');
    console.log('  ✅ L1 (Basic) + L2 (Streaming) + L3 (Tools) + L4 (JSON)');
  } else {
    console.log(`  ⚠️  Results: ${passed} passed, ${failed} failed`);
  }
  console.log('═══════════════════════════════════════════════════════════════');
  process.exit(failed > 0 ? 1 : 0);
}

runIntegrationDemo();
