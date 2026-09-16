import { describe, it, expect, beforeEach } from 'vitest';
import { RedTeamAgent, ATTACK_VECTORS } from '../src/red-team.js';
import { GovernanceGateway, PolicyDecision } from '@agi-os/governance';

describe('G7 — RedTeamAgent', () => {
  let redTeam: RedTeamAgent;
  let governance: GovernanceGateway;

  beforeEach(() => {
    governance = new GovernanceGateway();
    redTeam = new RedTeamAgent(governance);
  });

  it('has 12 attack vectors', () => {
    expect(ATTACK_VECTORS.length).toBe(12);
  });

  it('blocks eval injection', () => {
    const results = redTeam.runAllAttacks();
    const evalAttack = results.find(r => r.vector.id === 'av1');
    expect(evalAttack?.blocked).toBe(true);
    expect(evalAttack?.actualDecision).toBe(PolicyDecision.BLOCK);
  });

  it('blocks path traversal', () => {
    const results = redTeam.runAllAttacks();
    const pathAttack = results.find(r => r.vector.id === 'av2');
    expect(pathAttack?.blocked).toBe(true);
  });

  it('blocks env exfiltration', () => {
    const results = redTeam.runAllAttacks();
    const envAttack = results.find(r => r.vector.id === 'av3');
    expect(envAttack?.blocked).toBe(true);
  });

  it('blocks SSH key theft', () => {
    const results = redTeam.runAllAttacks();
    const sshAttack = results.find(r => r.vector.id === 'av4');
    expect(sshAttack?.blocked).toBe(true);
  });

  it('blocks destructive rm -rf', () => {
    const results = redTeam.runAllAttacks();
    const rmAttack = results.find(r => r.vector.id === 'av9');
    expect(rmAttack?.blocked).toBe(true);
  });

  it('blocks privilege escalation', () => {
    const results = redTeam.runAllAttacks();
    const privAttack = results.find(r => r.vector.id === 'av8');
    expect(privAttack?.blocked).toBe(true);
  });

  it('blocks git force push', () => {
    const results = redTeam.runAllAttacks();
    const gitAttack = results.find(r => r.vector.id === 'av6');
    expect(gitAttack?.blocked).toBe(true);
  });

  it('all 12 attacks blocked', () => {
    const results = redTeam.runAllAttacks();
    const breaches = results.filter(r => !r.blocked);
    expect(breaches.length).toBe(0);
    expect(results.length).toBe(12);
  });

  it('runs gate', () => {
    const gate = redTeam.runGate();
    expect(gate.gate).toBe('G7-RedTeam');
    expect(gate.status).toBe('PASS');
    expect(gate.tests).toBe(12);
    expect(gate.failed).toBe(0);
  });

  it('gets breaches', () => {
    redTeam.runAllAttacks();
    expect(redTeam.getBreaches().length).toBe(0);
  });
});
