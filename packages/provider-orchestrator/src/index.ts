// ============================================================================
// @agi-os/provider-orchestrator — the control plane.
// ----------------------------------------------------------------------------
// Three planes, one gate:
//
//   agent plane      registry → router → failover      (who thinks)
//   deployment plane deployment.ts                      (who publishes)
//   verification     verification.ts                     (who proves it works)
//   gate             gate.ts                             (VERIFIED only if all agree)
//
// The planes are separate on purpose: "Ready" is a deployment-plane word and
// "VERIFIED" is a verification-plane word. Conflating them is how a Space that
// answers nothing gets reported as healthy.
// ============================================================================

export * from './types.ts';
export { applyProbe, cooldownFor, healthPenalty, isCoolingDown, isUsable, stateFromStatus, type CooldownOptions } from './health.ts';
export { checkQuota, consumeQuota, costUsd, estimateTokens, type QuotaVerdict, type UsageEstimate } from './quota.ts';
export { KINDS, parseRegistry, ProviderRegistry, loadRegistry, registryFromManifest, type Manifest, type RegistryIssue, type RegistrySnapshot } from './registry.ts';
export { formatDecision, routeAgents, routeModels, routeProviders, type Rejection, type RouteDecision, type RouteInput, type ScoredProvider, type Stage } from './router.ts';
export { allowanceRemaining, consumeAllowance, evaluateFreeFirst, NO_FREE_PROVIDER_AVAILABLE, paidOverrideGranted, type FreeFirstInput, type FreeStage, type FreeVerdict } from './free-first.ts';
export { formatScores, scoreProvider, WEIGHTS, type ScoreContext, type ScoreParts } from './score.ts';
export { formatPlan, planMission, type MissionPlan, type MissionPlanInput } from './orchestrator.ts';
export { classifyError, runLadder, type Hop, type LadderInput, type LadderResult } from './failover.ts';
export { huggingFaceTarget, unboundTarget, vercelProductionTarget, type DeploymentTarget, type ObserveResult, type PublishResult } from './deployment.ts';
export { probe, verifyDeployment, verdictSummary, type HttpProbeResult, type ProbeOptions, type VerifyInput } from './verification.ts';
export { evaluateGate, renderGateReport, type CertificationSummary, type GateDecision, type GateInput } from './gate.ts';
export { JsonlLedger, defaultLedgerPath, redact, truncate, type LedgerOptions } from './evidence.ts';
export { expandEnv, loadControlPlaneConfig, type ControlPlaneConfig, type DeploymentConfig, type VerificationConfig } from './config.ts';
export { main as cliMain, parseArgs } from './cli.ts';
