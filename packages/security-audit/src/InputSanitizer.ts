export interface SanitizeResult {
  sanitized: string;
  wasModified: boolean;
  removedPatterns: string[];
}

export class InputSanitizer {
  private static patterns: Array<{ pattern: RegExp; replacement: string; description: string }> = [
    { pattern: /<script[^>]*>.*?<\/script>/gi, replacement: '', description: 'Script tags' },
    { pattern: /javascript:/gi, replacement: '', description: 'JavaScript protocol' },
    { pattern: /on\w+\s*=\s*['"][^'"]*['"]/gi, replacement: '', description: 'Event handlers' },
    { pattern: /data:text\/html/gi, replacement: '', description: 'Data URI HTML' },
    { pattern: /<!--[\s\S]*?-->/g, replacement: '', description: 'HTML comments' },
    { pattern: /;--/g, replacement: '', description: 'SQL comment markers' },
    { pattern: /'/g, replacement: "''", description: 'Single quotes' },
  ];

  static sanitize(input: string): SanitizeResult {
    let sanitized = input;
    const removedPatterns: string[] = [];

    for (const { pattern, replacement, description } of this.patterns) {
      if (pattern.test(sanitized)) {
        removedPatterns.push(description);
        sanitized = sanitized.replace(pattern, replacement);
      }
    }

    return {
      sanitized,
      wasModified: sanitized !== input,
      removedPatterns,
    };
  }

  static sanitizePath(path: string): SanitizeResult {
    let sanitized = path;
    const removedPatterns: string[] = [];

    const pathTraversal = /\.\.[\/\\]/g;
    if (pathTraversal.test(sanitized)) {
      removedPatterns.push('Path traversal');
      sanitized = sanitized.replace(pathTraversal, '');
    }

    const nullBytes = /\0/g;
    if (nullBytes.test(sanitized)) {
      removedPatterns.push('Null bytes');
      sanitized = sanitized.replace(nullBytes, '');
    }

    return {
      sanitized,
      wasModified: sanitized !== path,
      removedPatterns,
    };
  }

  static sanitizeSql(input: string): SanitizeResult {
    let sanitized = input;
    const removedPatterns: string[] = [];

    const sqlKeywords = /\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|EXEC|EXECUTE|TRUNCATE|GRANT|REVOKE)\b/gi;
    if (sqlKeywords.test(sanitized)) {
      removedPatterns.push('SQL keywords');
      sanitized = sanitized.replace(sqlKeywords, '');
    }

    const unionSelect = /UNION\s+SELECT/gi;
    if (unionSelect.test(sanitized)) {
      removedPatterns.push('UNION SELECT');
      sanitized = sanitized.replace(unionSelect, '');
    }

    return {
      sanitized,
      wasModified: sanitized !== input,
      removedPatterns,
    };
  }

  static isSafe(input: string): boolean {
    const result = this.sanitize(input);
    return !result.wasModified;
  }
}
