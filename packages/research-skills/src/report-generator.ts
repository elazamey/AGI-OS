import { generateId, now } from '@agi-os/kernel';
import type { ResearchReport, Claim, ResearchSource } from './types.js';

export class ReportGenerator {
  generate(params: {
    query: string;
    claims: Claim[];
    sources: ResearchSource[];
  }): ResearchReport {
    const contradictions = this.findContradictions(params.claims);
    const overallConfidence = params.claims.length > 0
      ? params.claims.reduce((s, c) => s + c.confidence, 0) / params.claims.length
      : 0;

    return {
      id: generateId(),
      query: params.query,
      claims: params.claims,
      contradictions,
      overallConfidence,
      sources: params.sources,
      synthesizedAt: now().toISOString(),
    };
  }

  private findContradictions(claims: Claim[]): Array<{ claim1: string; claim2: string; reason: string }> {
    const contradictions: Array<{ claim1: string; claim2: string; reason: string }> = [];
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        if (claims[i].confidence > 0.7 && claims[j].confidence > 0.7 &&
            claims[i].text.toLowerCase().includes('not') !== claims[j].text.toLowerCase().includes('not')) {
          contradictions.push({ claim1: claims[i].id, claim2: claims[j].id, reason: 'High-confidence disagreement' });
        }
      }
    }
    return contradictions;
  }

  formatMarkdown(report: ResearchReport): string {
    let md = `# Research: ${report.query}\n\n`;
    md += `**Confidence:** ${(report.overallConfidence * 100).toFixed(1)}%\n\n`;
    md += `## Claims\n\n`;
    for (const claim of report.claims) {
      md += `- ${claim.text} (confidence: ${(claim.confidence * 100).toFixed(0)}%)\n`;
    }
    if (report.contradictions.length > 0) {
      md += `\n## Contradictions\n\n`;
      for (const c of report.contradictions) {
        md += `- ${c.claim1} vs ${c.claim2}: ${c.reason}\n`;
      }
    }
    md += `\n## Sources\n\n`;
    for (const s of report.sources) {
      md += `- [${s.title}](${s.url}) (${s.domain})\n`;
    }
    return md;
  }
}
