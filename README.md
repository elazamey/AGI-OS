# AGI OS — Agent Operating System

A zero-cost ($0 MAX_SPEND) autonomous agent operating system with strict governance, local-first AI, skill registry, connector hub, and production certification.

## v1.5.0 — Trust & Production Gate

```
AGI-OS v1.5.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNIT                 1307 PASS
CERTIFICATION        220 TESTS
ADVERSARIAL          20 ESCAPES BLOCKED
RECOVERY             100% RATE
CONNECTORS           6 ISOLATED
SECURITY             27 GATES
CI                   GITHUB ACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Architecture

```
                    ┌─────────────────────┐
                    │   Mission Command    │
                    │      Center UI       │
                    └──────────┬──────────┘
                               ↓
                    ┌─────────────────────┐
                    │    Orchestrator     │
                    └──────────┬──────────┘
                               ↓
              ┌────────────────────────────────┐
              │        Skill Registry           │
              └───────────────┬────────────────┘
                              ↓
     ┌────────────────────────┼─────────────────────────┐
     ↓                        ↓                         ↓
 Connectors                Security                 Memory
 GitHub/REST/OAuth         Secret/Path/etc.         Store/Retrieve
 Webhooks
     ↓                        ↓                        ↓
     └────────────────────────┼─────────────────────────┘
                              ↓
                     Verification Layer
                              ↓
                    Recovery / Checkpoint
                              ↓
                    Evidence / RedTeam
                              ↓
                     Production Gates
                              ↓
                      Release Gate (Kernel-enforced)
```

## Package Matrix (30 packages)

| Package | Tests | Responsibility |
| :--- | ---: | :--- |
| **kernel** | — | Core primitives, event loop, ID generation |
| **missions** | — | Mission lifecycle, task state machines |
| **tools** | — | Tool registry, authorization, capabilities |
| **memory** | — | Vector RAG, working/episodic/semantic memory |
| **cognition** | — | World model, planner, hypothesis engine |
| **reflection** | — | Outcome analysis, root cause, lessons |
| **orchestrator** | 28 | EventLoop, E2E pipeline synchronization |
| **providers** | 79 | CostGuard, model routing, Ollama/Gemini adapters |
| **governance** | 97 | POL-001–POL-007, risk evaluation, audit, approval |
| **self-model** | — | Capability tracking, confidence, reliability |
| **generalization** | 35 | 7-domain cross-evaluation (23 scenarios) |
| **skills** | 11 | SkillRegistry: register/enable/disable/execute |
| **core-skills** | 11 | IntentAnalyzer, GoalExtractor, DAGPlanner |
| **verification-skills** | 10 | ActionVerifier, FileVerifier, EvidenceCollector |
| **recovery-skills** | 13 | Checkpoint, Rollback, Retry managers |
| **security-skills** | 17 | Secret, Command, Path, Injection detectors |
| **memory-skills** | 11 | MemoryStore, Retriever, Consolidator |
| **browser-skills** | 16 | BrowserSession, PageInspector, TabManager |
| **os-skills** | 16 | FileManager, Terminal, Hash, Diff |
| **coding-skills** | 11 | CodeAnalyzer, Patcher, TestRunner, BuildVerifier |
| **git-skills** | 7 | GitManager |
| **research-skills** | 9 | SourceDiscovery, ClaimExtractor, ReportGenerator |
| **artifact-skills** | 7 | ArtifactManager |
| **connectors** | 22 | ConnectorRouter, GitHub, REST, OAuth, Webhooks |
| **security-gates** | 33 | EvidenceChain, CostAuditor, RedTeam, ReleaseGate |
| **swarm** | 73 | Dark Swarm, Agent Registry, Delegation |
| **sandbox** | — | Code Sandbox |
| **benchmark** | 23 | BenchmarkOrchestrator, RegressionTracker |
| **production-gates** | 22 | SBOM, DependencyAudit, Regression, ReleaseGate |
| **sandbox-adversarial** | 20 | 19 escape attempts, SandboxEnforcer |
| **connector-isolation** | 21 | CapabilityScope, SecretVault, RateLimiter, Audit |
| **resilience-tests** | 13 | Replay, CrashRecovery, RaceConditions |
| **certification** | 26 | EvidenceCollector, Scorecard, Runner |
| **dashboard** | — | Next.js 14 Mission Workspace |

## Governance Pipeline

Every action passes through:

```
Intent → RiskEvaluator → PolicyEngine → Risk Override → AuditLedger → ApprovalManager
```

| Policy | Rule |
| :--- | :--- |
| **POL-001** | Block access to sensitive files (.env, .ssh, /etc/) |
| **POL-002** | Require approval for database modifications |
| **POL-003** | Block destructive git operations (force-push, reset --hard) |
| **POL-004** | Require approval for outbound network calls |
| **POL-005** | Block dangerous commands (rm -rf, eval, crontab, docker --privileged) |
| **POL-006** | Block filesystem writes outside workspace |
| **POL-007** | Allow read operations by default |

## Security Gates

| Gate | Description |
| :--- | :--- |
| **G1-Sandbox** | 12 sandbox escape attempts tested |
| **G3-Cost** | Paid provider blocking |
| **G7-RedTeam** | 12 adversarial attack vectors (10 BLOCK, 2 REQUIRE_APPROVAL) |
| **G-Release** | Full audit before release |

## Certification (v1.5.0)

```text
G0  Foundation           15 tests
G1  Reasoning            15 tests
G2  Tool & Skills        18 tests
G3  Browser              18 tests
G4  OS / Sandbox         14 tests
G5  Coding Agent         22 tests
G6  Research             15 tests
G7  Memory               16 tests
G8  Autonomy             20 tests
G9  Security             27 tests
G10 Recovery             18 tests
G11 Performance          10 tests
G12 Frontend             12 tests
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL                   220 tests
```

## Quick Start

```bash
# Install
pnpm install

# Run unit tests (1307+)
pnpm test

# Run certification suite (220)
cd packages/certification && pnpm test

# Run adversarial suite (19 escape attempts)
cd packages/sandbox-adversarial && pnpm test

# Run resilience tests (replay, crash, race)
cd packages/resilience-tests && pnpm test

# Launch dashboard
pnpm dashboard
```

## Dashboard Pages

| Route | Description |
| :--- | :--- |
| `/` | Mission Command Center |
| `/missions/[id]` | 3-column Mission Workspace cockpit |
| `/governance` | Audit explorer |
| `/loop` | EventLoop telemetry |
| `/memory` | Vector RAG browser |
| `/self-model` | Reliability tracker |
| `/reflection` | Lesson history |

## Verification Metrics

| Metric | Target | Achieved |
| :--- | :--- | :--- |
| Unit Tests | 1300+ | 1307 |
| Certification Tests | 220 | 220 |
| Adversarial Escapes | 0 | 0 |
| Recovery Rate | 100% | 100% |
| Governance Intercept | < 5ms | < 1ms |
| Cost Ceiling | $0 | $0 enforced |
| Packages | 30 | 30 |

## License

MIT
