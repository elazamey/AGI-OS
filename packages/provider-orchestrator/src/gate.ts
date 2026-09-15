// ============================================================================
// Gate: the only place allowed to say a deployment may be trusted.
// ----------------------------------------------------------------------------
// The rule this whole module exists to enforce:
//
//     DEPLOYED ≠ VERIFIED
//
// A platform reporting "Ready", a build that exists, and 66 passing unit tests are
// three *inputs* to a verdict, never the verdict itself. Anything unproven returns
// BLOCKED or DEGRADED — it may not default to success, which is precisely how the
// "775/775 green while nothing answers /health" state survived this long.
// ============================================================================

import type { GateStatus, VerificationVerdict } from './types.ts';
import type { ObserveResult } from './deployment.ts';

export interface CertificationSummary {
  gate: 'PASSED' | 'DEGRADED' | 'BLOCKED' | string;
  runId?: string;
  passed?: number;
  failed?: number;
  skipped?: number;
  assertions?: number;
  reason?: string;
  baseUrl?: string;
}

export interface GateInput {
  deployments: ObserveResult[];
  verifications: Array<{ target: string; verdict: VerificationVerdict }>;
  certification: CertificationSummary | null;
  /** DEGRADED also withholds certification (CI default: true). */
  strict?: boolean;
}

export interface GateDecision {
  status: GateStatus;
  reasons: string[];
  /** Provenance of the decision, so a reviewer can re-derive it from the artefact. */
  inputs: GateInput;
  exitCode: number;
  decidedAt: string;
}

const RANK: Record<GateStatus, number> = { VERIFIED: 0, DEGRADED: 1, BLOCKED: 2 };

function worse(a: GateStatus, b: GateStatus): GateStatus {
  return RANK[b] > RANK[a] ? b : a;
}

export function evaluateGate(input: GateInput): GateDecision {
  const reasons: string[] = [];
  let status: GateStatus = 'VERIFIED';

  if (input.deployments.length === 0) {
    reasons.push('no deployment target was observed — nothing to certify');
    status = 'BLOCKED';
  }

  for (const deployment of input.deployments) {
    if (deployment.status !== 'DEPLOYED') {
      status = worse(status, 'BLOCKED');
      reasons.push(`${deployment.provider}: platform reports "${deployment.platformState}" (status=${deployment.status})`);
    }
  }

  if (input.verifications.length === 0) {
    status = worse(status, 'BLOCKED');
    reasons.push('no functional verification ran — a deployment id without a probe proves nothing');
  }
  for (const { target, verdict } of input.verifications) {
    const failed = verdict.checks.filter((c) => !c.ok && !c.skipped);
    const skipped = verdict.checks.filter((c) => c.skipped);
    if (verdict.deployment !== 'VERIFIED') {
      status = worse(status, verdict.deployment === 'BLOCKED' ? 'BLOCKED' : 'DEGRADED');
      const detail = failed.length
        ? ` — failed: ${failed.map((f) => f.label).join(', ')}`
        : skipped.length
          ? ` — unproven: ${skipped.map((c) => c.label).join(', ')}`
          : '';
      reasons.push(`${target}: functional verification ${verdict.deployment}${detail}`);
    } else if (skipped.length > 0) {
      status = worse(status, 'DEGRADED');
      reasons.push(`${target}: ${skipped.length} verification step(s) skipped (${skipped.map((s) => s.label).join(', ')})`);
    }
  }

  if (!input.certification) {
    status = worse(status, 'BLOCKED');
    reasons.push('production certification (tests/production) has no result for this run');
  } else if (input.certification.gate !== 'PASSED') {
    const next = input.certification.gate === 'BLOCKED' ? 'BLOCKED' : input.strict ? 'BLOCKED' : 'DEGRADED';
    status = worse(status, next);
    reasons.push(
      `certification gate=${input.certification.gate} (${input.certification.passed ?? '?'} passed, ${input.certification.failed ?? '?'} failed, ${input.certification.skipped ?? '?'} skipped)` +
        (input.certification.reason ? ` — ${String(input.certification.reason).slice(0, 400)}` : ''),
    );
  }

  return {
    status,
    reasons,
    inputs: input,
    exitCode: status === 'VERIFIED' ? 0 : status === 'DEGRADED' && !input.strict ? 1 : 2,
    decidedAt: new Date().toISOString(),
  };
}

export function renderGateReport(decision: GateDecision): string {
  const lines = [
    `# AGI-OS Deployment Gate — ${decision.status}`,
    '',
    `- decided: \`${decision.decidedAt}\``,
    `- strict: \`${Boolean(decision.inputs.strict)}\``,
    '',
    '## Plane status',
    '',
    '| plane | target | status | note |',
    '|---|---|---|---|',
  ];
  for (const deployment of decision.inputs.deployments) {
    lines.push(`| deployment | ${deployment.provider} | ${deployment.status} | ${deployment.platformState} (\`${deployment.deploymentId}\`) |`);
  }
  for (const { target, verdict } of decision.inputs.verifications) {
    lines.push(
      `| verification | ${target} | ${verdict.deployment} | http=${verdict.frontend_http}/${verdict.backend_health} · contract=${verdict.api_contract} · ${verdict.checks.filter((c) => c.ok && !c.skipped).length}/${verdict.checks.length} checks |`,
    );
  }
  const certification = decision.inputs.certification;
  lines.push(
    `| certification | tests/production | ${certification?.gate ?? 'MISSING'} | ${certification ? `${certification.passed} passed · ${certification.failed} failed · ${certification.skipped} skipped` : 'not run'} |`,
  );
  if (decision.reasons.length > 0) {
    lines.push('', '## Reasons', '');
    for (const reason of decision.reasons) lines.push(`- ${reason}`);
  }
  lines.push(
    '',
    '## Reading this report',
    '',
    '- **VERIFIED** — published *and* behaving as advertised on the surfaces we test.',
    '- **DEGRADED** — shipped, but at least one claim is unproven. Not a certification.',
    '- **BLOCKED** — do not trust this deployment: a plane failed or produced no evidence.',
    '',
    `Exit code \`${decision.exitCode}\`.`,
    '',
  );
  return lines.join('\n');
}
