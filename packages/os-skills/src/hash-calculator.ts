import type { HashResult } from './types.js';

export class HashCalculator {
  calculate(data: string, algorithm: string = 'sha256'): HashResult {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return { file: 'inline', algorithm, hash: `${algorithm}:${hex}` };
  }

  calculateFile(path: string, content: string, algorithm: string = 'sha256'): HashResult {
    const result = this.calculate(content, algorithm);
    return { ...result, file: path };
  }

  compare(hash1: string, hash2: string): boolean {
    return hash1 === hash2;
  }
}
