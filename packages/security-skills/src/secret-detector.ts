import { generateId, now } from '@agi-os/kernel';
import type { SecurityScanResult, Threat } from './types.js';

const SECRET_PATTERNS = [
  { name: 'API Key', pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"][A-Za-z0-9_-]{15,}['"]/i },
  { name: 'AWS Key', pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/ },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA )?PRIVATE KEY-----/ },
  { name: 'Token', pattern: /(?:token|bearer|authorization)\s*[=:]\s*['"][A-Za-z0-9_.-]{15,}['"]/i },
  { name: 'Password', pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{6,}['"]/i },
  { name: 'GitHub Token', pattern: /ghp_[A-Za-z0-9]{30,}/ },
  { name: 'Slack Token', pattern: /xox[baprs]-[A-Za-z0-9-]+/ },
  { name: 'Secret Value', pattern: /(?:secret|key)\s*[=:]\s*['"][A-Za-z0-9_-]{20,}['"]/i },
];

export class SecretDetector {
  scan(content: string, filePath?: string): SecurityScanResult {
    const threats: Threat[] = [];

    for (const { name, pattern } of SECRET_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        threats.push({
          id: generateId(),
          type: 'secret',
          severity: 'CRITICAL',
          description: `Potential ${name} found`,
          location: filePath,
          recommendation: `Remove or rotate ${name}`,
        });
      }
    }

    return {
      id: generateId(),
      scanner: 'secret-detector',
      target: filePath || 'inline',
      threats,
      score: threats.length === 0 ? 100 : Math.max(0, 100 - threats.length * 25),
      passed: threats.length === 0,
      timestamp: now().toISOString(),
    };
  }

  scanMultiple(files: Array<{ path: string; content: string }>): SecurityScanResult {
    const allThreats: Threat[] = [];
    for (const file of files) {
      const result = this.scan(file.content, file.path);
      allThreats.push(...result.threats);
    }
    return {
      id: generateId(),
      scanner: 'secret-detector',
      target: `${files.length} files`,
      threats: allThreats,
      score: allThreats.length === 0 ? 100 : Math.max(0, 100 - allThreats.length * 10),
      passed: allThreats.length === 0,
      timestamp: now().toISOString(),
    };
  }
}
