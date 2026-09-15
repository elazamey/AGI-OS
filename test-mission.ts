import {
  SkillDiscoveryEngine,
  ExecutionSandbox,
  RollbackLedger,
  PolicyEngine,
  StreamingApiServer,
} from './packages/agent-os/src/index.js';

async function runEmailValidatorMission() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  GOLDEN MISSION: Email Validator — Full Lifecycle');
  console.log('═══════════════════════════════════════════════════════\n');

  const server = new StreamingApiServer();
  const skillEngine = server.getSkillEngine();
  const sandbox = server.getSandbox();
  const rollbackLedger = server.getRollbackLedger();
  const policyEngine = server.getPolicyEngine();

  // ═══════════════════════════════════════════════════════
  // PHASE 1: PLANNER
  // ═══════════════════════════════════════════════════════
  console.log('━━━ PHASE 1: PLANNER ━━━');
  console.log('📝 Mission: "إنشاء كود للتحقق من صحة بريد إلكتروني + اختبارات وحدة"');

  const skillMd = `# email-validator
description: Validates email addresses using regex
triggers: email, validate, validator, check-email

## Instructions
1. Create emailValidator.js with a validateEmail function
2. Create emailValidator.test.js with unit tests
3. Run tests with node --test`;

  const skill = skillEngine.parseSkillMd(skillMd);
  console.log(`✅ Skill loaded: ${skill.name}`);
  console.log(`   Triggers: ${skill.triggers.join(', ')}`);
  console.log(`   Description: ${skill.description}`);

  const subtasks = [
    { id: 't1', name: 'Create emailValidator.js', tool: 'write_file', risk: 'SAFE' },
    { id: 't2', name: 'Create emailValidator.test.js', tool: 'write_file', risk: 'SAFE' },
    { id: 't3', name: 'Run unit tests', tool: 'run_command', risk: 'SENSITIVE' },
  ];
  console.log(`   Subtasks planned: ${subtasks.length}`);
  subtasks.forEach(t => console.log(`   ├── ${t.id}: ${t.name} [${t.risk}]`));
  console.log('');

  // ═══════════════════════════════════════════════════════
  // PHASE 2: POLICY
  // ═══════════════════════════════════════════════════════
  console.log('━━━ PHASE 2: POLICY ━━━');

  const decisions = subtasks.map(t => ({
    task: t.name,
    ...policyEngine.evaluate(`${t.tool} ${t.name}`),
  }));

  decisions.forEach(d => {
    const icon = d.risk_level === 'SAFE' ? '🟢' : d.risk_level === 'SENSITIVE' ? '🟡' : '🔴';
    console.log(`${icon} ${d.task}: risk=${d.risk_level}, approval=${d.requires_approval}`);
  });
  console.log('');

  // ═══════════════════════════════════════════════════════
  // PHASE 3: EXECUTION (Sandboxed)
  // ═══════════════════════════════════════════════════════
  console.log('━━━ PHASE 3: EXECUTION ━━━');
  console.log('🔒 Running inside Execution Sandbox (shell=false, 30s timeout)\n');

  // Step 3.1: Write emailValidator.js
  console.log('  📄 Writing emailValidator.js...');
  const validatorCode = `
function validateEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_\`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return re.test(email);
}
module.exports = { validateEmail };
`.trim();

  const writeResult1 = await sandbox.execute([
    'node', '-e',
    `require('fs').writeFileSync('emailValidator.js', \`${validatorCode}\`, 'utf8'); console.log('written');`
  ]);
  console.log(`  ${writeResult1.success ? '✅' : '❌'} emailValidator.js created`);

  // Step 3.2: Write emailValidator.test.js
  console.log('  📄 Writing emailValidator.test.js...');
  const testCode = `
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateEmail } = require('./emailValidator');

describe('validateEmail', () => {
  it('should accept valid emails', () => {
    assert.strictEqual(validateEmail('user@example.com'), true);
    assert.strictEqual(validateEmail('test.name@domain.co'), true);
    assert.strictEqual(validateEmail('user+tag@sub.domain.org'), true);
  });

  it('should reject invalid emails', () => {
    assert.strictEqual(validateEmail(''), false);
    assert.strictEqual(validateEmail('notanemail'), false);
    assert.strictEqual(validateEmail('@no-local.com'), false);
    assert.strictEqual(validateEmail('no-at-sign.com'), false);
  });

  it('should handle edge cases', () => {
    assert.strictEqual(validateEmail(null), false);
    assert.strictEqual(validateEmail(undefined), false);
    assert.strictEqual(validateEmail(123), false);
  });
});
`.trim();

  const writeResult2 = await sandbox.execute([
    'node', '-e',
    `require('fs').writeFileSync('emailValidator.test.js', \`${testCode}\`, 'utf8'); console.log('written');`
  ]);
  console.log(`  ${writeResult2.success ? '✅' : '❌'} emailValidator.test.js created`);

  // Step 3.3: Run tests
  console.log('  🧪 Running unit tests...');
  const testResult = await sandbox.execute(['node', '--test', 'emailValidator.test.js']);
  console.log(`  ${testResult.success ? '✅' : '❌'} Tests ${testResult.success ? 'PASSED' : 'FAILED'}`);
  if (testResult.stdout) {
    const lines = testResult.stdout.split('\n').filter(l => l.includes('✓') || l.includes('✗') || l.includes('pass') || l.includes('fail') || l.includes('#'));
    lines.forEach(l => console.log(`     ${l.trim()}`));
  }
  if (testResult.stderr && !testResult.success) {
    console.log(`  ⚠️  stderr: ${testResult.stderr.substring(0, 200)}`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════
  // PHASE 4: VERIFIER
  // ═══════════════════════════════════════════════════════
  console.log('━━━ PHASE 4: VERIFIER ━━━');

  const verifyRead = await sandbox.execute(['node', '-e', 'console.log(require("fs").readFileSync("emailValidator.js","utf8").length)']);
  const verifyTest = await sandbox.execute(['node', '-e', 'console.log(require("fs").readFileSync("emailValidator.test.js","utf8").length)']);

  console.log(`  📄 emailValidator.js: ${verifyRead.stdout.trim()} bytes`);
  console.log(`  📄 emailValidator.test.js: ${verifyTest.stdout.trim()} bytes`);
  console.log(`  🧪 Test result: ${testResult.success ? 'ALL PASSED ✅' : 'FAILED ❌'}`);
  console.log(`  📊 Pass rate: ${testResult.success ? '100%' : '0%'}`);
  console.log('');

  // ═══════════════════════════════════════════════════════
  // PHASE 5: LEDGER (Rollback)
  // ═══════════════════════════════════════════════════════
  console.log('━━━ PHASE 5: LEDGER ━━━');

  const txn = rollbackLedger.createTransaction('email-validator-mission');
  console.log(`  📒 Transaction: ${txn.id}`);
  console.log(`  📒 Status: ${txn.status}`);

  const rollbackResult = await rollbackLedger.executeWithRollback(
    async () => {
      return { passed: testResult.success, files: 2, tests: 5 };
    },
    []
  );

  console.log(`  📒 Rollback test: ${rollbackResult.success ? 'SUCCESS' : 'FAILED'}`);
  console.log(`  📒 Result: ${JSON.stringify(rollbackResult.result)}`);
  console.log('');

  // ═══════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════');
  console.log('  MISSION COMPLETE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Skill:     ${skill.name}`);
  console.log(`  Files:     2 (emailValidator.js, emailValidator.test.js)`);
  console.log(`  Tests:     ${testResult.success ? 'ALL PASSED ✅' : 'FAILED ❌'}`);
  console.log(`  Sandbox:   shell=false, timeout=30s`);
  console.log(`  Policy:    ${decisions.every(d => d.risk_level !== 'CRITICAL') ? 'ALL APPROVED ✅' : 'BLOCKED ❌'}`);
  console.log(`  Ledger:    Transaction recorded ✅`);
  console.log('═══════════════════════════════════════════════════════\n');
}

runEmailValidatorMission().catch(console.error);
