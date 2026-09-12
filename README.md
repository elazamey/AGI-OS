# AGI OS — Autonomous Operating System Framework

An offline-first, zero-cost ($0 MAX_SPEND) local agentic framework built with strict governance interception, local vector memory (RAG), and a self-correcting cognitive loop.

## Core Architecture & Package Matrix

AGI OS consists of 11 modular TypeScript packages built on top of Node.js and `pnpm` workspaces:

| Package | Responsibility | Invariants & Benchmarks |
| :--- | :--- | :--- |
| **`@agi-os/kernel`** | Core event loop, system interfaces, and execution primitives | Deterministic tick execution |
| **`@agi-os/missions`** | Mission lifecycle, task state machines, and DAG retries | Zero orphan state transitions |
| **`@agi-os/tools`** | Local tool registry, authorization, and capability limits | Isolated sandboxed execution |
| **`@agi-os/memory`** | Local vector embeddings (`LocalVectorEngine`), RAG, & working store | Search latency < 20ms for 1K docs |
| **`@agi-os/cognition`** | Multi-hypothesis planning and goal decomposition | Fallback to deterministic planner |
| **`@agi-os/reflection`** | Post-execution analysis, root cause extraction, and lesson decay | Cascading failure isolation |
| **`@agi-os/orchestrator`** | Event loop orchestration and E2E pipeline synchronization | 5-interface contract enforcement |
| **`@agi-os/providers`** | Model adapter routing with `CostGuard` enforcement | $0 MAX_SPEND strict boundary |
| **`@agi-os/governance`** | Policy interception, risk evaluation, and human approval gates | Intercept latency < 5ms per intent |
| **`@agi-os/self-model`** | Capability tracking, confidence scoring, and telemetry snapshots | Continuous reliability metrics |
| **`@agi-os/generalization`** | Cross-domain knowledge transfer and task pattern matching | 7-domain evaluation matrix |

## Strict System Invariants

1. **$0 Budget Ceiling (`$0 MAX_SPEND`):** `CostGuard` blocks non-zero cost adapters at runtime registration.
2. **Irrevocable Governance (`PolicyEngine`):** Every intent passes through `GovernanceGateway`. Actions attempting path traversal (`../.env`, system directories) return `BLOCK` instantly.
3. **Audit Ledger Transparency:** All intercepted operations emit append-only audit records before execution.
4. **Local Zero-Cost RAG:** Uses deterministic L2-normalized feature vectors for semantic matching without paid API calls.

## Quick Start

### Local Development & Testing

```bash
# Install workspace dependencies
pnpm install

# Run complete test suite (885 tests across 11 packages)
pnpm test
```

### Running with Docker

```bash
# Run automated test suite inside Docker
docker compose up agi-os-test

# Launch interactive CLI Dashboard
docker compose up agi-os -d
docker attach agi-os-runtime
```

## Verification Metrics

| Metric | Target | Achieved |
| :--- | :--- | :--- |
| **Total Test Cases** | 885+ | 885 / 885 Passing |
| **Governance Intercept Latency** | < 5ms | < 5ms per intent |
| **Vector Search Latency** | < 20ms | < 20ms (1,000 documents) |
| **Memory Overhead** | < 50MB | < 35MB for 2,000 vectors |
| **Cost Ceiling** | $0 | $0 MAX_SPEND enforced |
| **Package Count** | 11 | 11 packages |

## Project Structure

```
agi-os/
├── packages/
│   ├── kernel/            # Core primitives (Entity, Event, State, Evidence, Decision)
│   ├── missions/          # Mission lifecycle and task state machines
│   ├── tools/             # Tool registry, capabilities, policy, authorization
│   ├── memory/            # Working, Episodic, Semantic, Procedural, Meta + Vector RAG
│   ├── cognition/         # World model, context, hypotheses, planner
│   ├── reflection/        # Outcome analysis, root cause, lessons, decay
│   ├── orchestrator/      # EventLoop with Perceive→Plan→Execute→Reflect→Memorize
│   ├── providers/         # CostGuard, Router, adapters (Ollama, Gemini, etc.)
│   ├── governance/        # Risk, Policy, Audit, Approval, Gateway
│   ├── self-model/        # Capabilities, Limitations, Confidence, Reliability, Patterns
│   └── generalization/    # Cross-domain testing harness (7 domains)
├── .github/workflows/     # CI/CD pipeline
├── Dockerfile             # Production container
├── docker-compose.yml     # Runtime + test services
└── package.json           # Root workspace config
```

## Governance Pipeline

Every action passes through this deterministic pipeline:

```
Intent → RiskEvaluator → PolicyEngine → Risk Override → AuditLedger → ApprovalManager
```

- **Risk Evaluator**: Scores blast radius (1-4 scale) based on module, operation, and target
- **Policy Engine**: First-match rule evaluation (POL-001 through POL-007)
- **Risk Override**: CRITICAL/HIGH risk + ALLOW gets forced to REQUIRE_APPROVAL
- **Audit Ledger**: Append-only, queryable, never mutated after creation
- **Approval Manager**: Human-in-the-loop for HIGH/CRITICAL operations

## License

MIT
