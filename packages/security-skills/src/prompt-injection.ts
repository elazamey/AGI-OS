import { generateId, now } from '@agi-os/kernel';
import type { SecurityScanResult, Threat } from './types.js';

const INJECTION_PATTERNS = [
  { pattern: /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+(?:instructions|prompts)/i, severity: 'HIGH' as const },
  { pattern: /you\s+are\s+now\s+(?:a|an)\s+/i, severity: 'MEDIUM' as const },
  { pattern: /system\s*:\s*/i, severity: 'MEDIUM' as const },
  { pattern: /\[INST\]/i, severity: 'HIGH' as const },
  { pattern: /<\|im_start\|>/i, severity: 'HIGH' as const },
  { pattern: /pretend\s+(?:you\s+are|to\s+be)/i, severity: 'MEDIUM' as const },
  { pattern: /disregard\s+(?:all|any|previous)/i, severity: 'HIGH' as const },
  { pattern: /override\s+(?:safety|instructions|rules)/i, severity: 'CRITICAL' as const },
  { pattern: /jailbreak/i, severity: 'HIGH' as const },
  { pattern: /DAN\s+mode/i, severity: 'CRITICAL' as const },
];

export class PromptInjectionDetector {
  scan(text: string): SecurityScanResult {
    const threats: Threat[] = [];

    for (const { pattern, severity } of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        threats.push({
          id: generateId(),
          type: 'injection_prompt',
          severity,
          description: `Potential prompt injection: ${pattern.source.substring(0, 50)}`,
          recommendation: 'Block or sanitize input',
        });
      }
    }

    return {
      id: generateId(),
      scanner: 'prompt-injection',
      target: 'user_input',
      threats,
      score: threats.length === 0 ? 100 : Math.max(0, 100 - threats.length * 30),
      passed: threats.length === 0,
      timestamp: now().toISOString(),
    };
  }
}
