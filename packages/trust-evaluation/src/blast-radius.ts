import type { BlastRadiusResult } from './types.js';

export class BlastRadiusAnalyzer {
  analyze(filesChanged: string[], configChanged: boolean, depsChanged: boolean): BlastRadiusResult {
    const affectedModules = [...new Set(filesChanged.map(f => f.split('/').slice(0, 3).join('/')))];
    const affectedTests = filesChanged.some(f => f.includes('test') || f.includes('spec'));

    let radius: BlastRadiusResult['radius'];
    if (filesChanged.length <= 2 && affectedModules.length <= 1) radius = 'LOCAL';
    else if (affectedModules.length <= 2) radius = 'MODULE';
    else if (filesChanged.length <= 10) radius = 'PROJECT';
    else radius = 'SYSTEM';

    let protectionLevel: BlastRadiusResult['protectionLevel'];
    if (radius === 'LOCAL') protectionLevel = 'BASIC';
    else if (radius === 'MODULE') protectionLevel = 'ENHANCED';
    else protectionLevel = 'MAXIMUM';
    if (configChanged || depsChanged) protectionLevel = 'MAXIMUM';

    return {
      affectedFiles: filesChanged,
      affectedModules,
      affectedConfig: configChanged,
      affectedDependencies: depsChanged,
      affectedTests,
      radius,
      protectionLevel,
    };
  }

  requiresApproval(radius: BlastRadiusResult['radius']): boolean {
    return radius === 'PROJECT' || radius === 'SYSTEM';
  }

  requiresBackup(radius: BlastRadiusResult['radius']): boolean {
    return radius === 'SYSTEM' || radius === 'PROJECT';
  }
}
