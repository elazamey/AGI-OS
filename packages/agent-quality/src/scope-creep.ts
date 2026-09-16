import type { ScopeCreepResult, FileChange } from './types.js';

export class ScopeCreepDetector {
  private authorizedPaths: string[] = [];
  private maxFilesChanged: number = 5;
  private maxLinesChanged: number = 200;

  configure(opts: { authorizedPaths?: string[]; maxFiles?: number; maxLines?: number }): void {
    if (opts.authorizedPaths) this.authorizedPaths = opts.authorizedPaths;
    if (opts.maxFiles) this.maxFilesChanged = opts.maxFiles;
    if (opts.maxLines) this.maxLinesChanged = opts.maxLines;
  }

  evaluate(requestedScope: string, actualChanges: FileChange[]): ScopeCreepResult {
    const unauthorizedChanges: FileChange[] = [];

    for (const change of actualChanges) {
      const isAuthorized = this.authorizedPaths.length === 0 ||
        this.authorizedPaths.some(p => change.path.startsWith(p));
      if (!isAuthorized) {
        unauthorizedChanges.push(change);
      }
    }

    const totalLines = actualChanges.reduce((sum, c) => sum + c.linesChanged, 0);
    const fileCountExceeded = actualChanges.length > this.maxFilesChanged;
    const linesExceeded = totalLines > this.maxLinesChanged;
    const hasUnauthorized = unauthorizedChanges.length > 0;

    let severity: ScopeCreepResult['severity'] = 'NONE';
    if (hasUnauthorized || (fileCountExceeded && linesExceeded)) severity = 'HIGH';
    else if (fileCountExceeded || linesExceeded) severity = 'MEDIUM';
    else if (actualChanges.length > this.maxFilesChanged / 2) severity = 'LOW';

    const withinScope = !hasUnauthorized && !fileCountExceeded && !linesExceeded;

    return {
      requestedScope,
      actualChanges,
      withinScope,
      unauthorizedChanges,
      changeCount: actualChanges.length,
      severity,
    };
  }

  countDependencyChanges(changes: FileChange[]): number {
    return changes.filter(c =>
      c.path.includes('package.json') ||
      c.path.includes('lock') ||
      c.path.includes('pnpm-lock') ||
      c.path.includes('requirements') ||
      c.path.includes('Cargo.toml')
    ).length;
  }

  countConfigChanges(changes: FileChange[]): number {
    return changes.filter(c =>
      c.path.includes('config') ||
      c.path.includes('.env') ||
      c.path.includes('tsconfig') ||
      c.path.includes('eslint') ||
      c.path.includes('prettier')
    ).length;
  }
}
