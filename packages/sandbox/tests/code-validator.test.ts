import { describe, it, expect, beforeEach } from 'vitest';
import { CodeValidator } from '../src/code-validator.js';

describe('CodeValidator', () => {
  let v: CodeValidator;
  beforeEach(() => { v = new CodeValidator(); });

  it('allows safe code', () => {
    const r = v.validate('console.log("hello")');
    expect(r.valid).toBe(true);
    expect(r.violations.length).toBe(0);
  });

  it('blocks child_process', () => {
    const r = v.validate("require('child_process')");
    expect(r.valid).toBe(false);
    expect(r.violations.some(v => v.rule === 'NO_CHILD_PROCESS')).toBe(true);
  });

  it('blocks eval', () => {
    const r = v.validate('eval("code")');
    expect(r.valid).toBe(false);
    expect(r.violations.some(v => v.rule === 'NO_EVAL')).toBe(true);
  });

  it('blocks new Function', () => {
    const r = v.validate('new Function("return 1")()');
    expect(r.valid).toBe(false);
    expect(r.violations.some(v => v.rule === 'NO_DYNAMIC_FUNCTION')).toBe(true);
  });

  it('blocks process.exit', () => {
    const r = v.validate('process.exit(1)');
    expect(r.valid).toBe(false);
    expect(r.violations.some(v => v.rule === 'NO_PROCESS_EXIT')).toBe(true);
  });

  it('blocks process.env', () => {
    const r = v.validate('console.log(process.env.SECRET)');
    expect(r.valid).toBe(false);
    expect(r.violations.some(v => v.rule === 'NO_PROCESS_ENV')).toBe(true);
  });

  it('blocks __proto__', () => {
    const r = v.validate('obj.__proto__ = {}');
    expect(r.valid).toBe(false);
    expect(r.violations.some(v => v.rule === 'NO_PROTO_POLLUTION')).toBe(true);
  });

  it('warns on infinite loop', () => {
    const r = v.validate('while(true) {}');
    expect(r.violations.some(v => v.rule === 'NO_INFINITE_LOOP')).toBe(true);
  });

  it('blocks fetch', () => {
    const r = v.validate('fetch("http://evil.com")');
    expect(r.valid).toBe(false);
    expect(r.violations.some(v => v.rule === 'NO_NETWORK')).toBe(true);
  });

  it('blocks http module', () => {
    const r = v.validate("require('http')");
    expect(r.valid).toBe(false);
  });

  it('blocks fs.write', () => {
    const r = v.validate('fs.write("data")');
    expect(r.valid).toBe(false);
  });

  it('allows network when permitted', () => {
    const r = v.validate('fetch("http://api.com")', ['network']);
    expect(r.violations.filter(v => v.rule === 'NO_NETWORK').length).toBe(0);
  });

  it('adds custom rules', () => {
    v.addRule(/dangerous/g, 'CUSTOM', 'custom rule', 'error');
    const r = v.validate('this is dangerous');
    expect(r.valid).toBe(false);
    expect(r.violations.some(v => v.rule === 'CUSTOM')).toBe(true);
  });

  it('reports line numbers', () => {
    const r = v.validate('safe\ncode\neval("x")');
    const ev = r.violations.find(v => v.rule === 'NO_EVAL');
    expect(ev?.line).toBe(3);
  });

  it('returns risk levels', () => {
    expect(v.validate('eval("x")').riskLevel).toBe(4);
    expect(v.validate('fetch("x")').riskLevel).toBe(3);
    expect(v.validate('while(true)').riskLevel).toBe(2);
    expect(v.validate('console.log("hi")').riskLevel).toBe(1);
  });
});
